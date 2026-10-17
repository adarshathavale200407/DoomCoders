from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException

from constants import CATEGORIES
from deps import current_user, current_user_optional, get_db, require_roles
from duplicates import find_duplicates
from models import AssignIn, DuplicateCheckIn, IssueIn, MergeIn, StatusIn
from serializers import match_summary, serialize_issue
from utils import to_oid, utcnow

router = APIRouter(prefix="/issues", tags=["issues"])


async def get_issue_or_404(db, issue_id: str) -> dict:
    doc = await db.issues.find_one({"_id": to_oid(issue_id, "Issue")})
    if doc is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    return doc


@router.post("/check-duplicates")
async def check_duplicates(body: DuplicateCheckIn, db=Depends(get_db)):
    """Called by the report form before submitting: similar open issues nearby."""
    matches = await find_duplicates(
        db, body.category, body.lat, body.lng, body.title, body.description
    )
    return [match_summary(m) for m in matches]


@router.get("/mine")
async def my_issues(db=Depends(get_db), user=Depends(current_user)):
    docs = await db.issues.find({"reporter_id": str(user["_id"])}).to_list(500)
    items = [serialize_issue(d, user) for d in docs]
    items.sort(key=lambda i: i["created_at"], reverse=True)
    return items


@router.post("", status_code=201)
async def create_issue(body: IssueIn, db=Depends(get_db), user=Depends(current_user)):
    now = utcnow()
    matches = await find_duplicates(
        db, body.category, body.lat, body.lng, body.title, body.description
    )
    top = matches[0] if matches else None

    doc = {
        "title": body.title.strip(),
        "description": body.description.strip(),
        "category": body.category,
        "severity": body.severity,
        "photo_url": body.photo_url,
        "location": {"lat": body.lat, "lng": body.lng, "address": body.address},
        "status": "reported",
        "reporter_id": str(user["_id"]),
        "reporter_name": user["name"],
        "upvotes": 0,
        "upvoters": [],
        "duplicate_count": 0,
        "duplicate_of": None,
        "possible_duplicate_of": str(top["issue"]["_id"]) if top else None,
        "possible_duplicates": [
            {"id": str(m["issue"]["_id"]), "confidence": m["confidence"]} for m in matches[:3]
        ],
        "suggested_team": CATEGORIES[body.category]["team"],
        "assigned_team": None,
        "assigned_at": None,
        "created_at": now,
        "updated_at": now,
        "resolved_at": None,
        "timeline": [
            {"status": "reported", "note": "Issue reported", "by": user["name"], "at": now}
        ],
    }
    res = await db.issues.insert_one(doc)
    doc["_id"] = res.inserted_id

    # A likely duplicate adds weight to the original report's community impact.
    if top:
        await db.issues.update_one(
            {"_id": top["issue"]["_id"]}, {"$inc": {"duplicate_count": 1}}
        )
    return serialize_issue(doc, user)


@router.get("")
async def list_issues(
    status: str | None = None,
    category: str | None = None,
    team: str | None = None,
    sort: str = "priority",
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = 5,
    limit: int = 200,
    include_duplicates: bool = False,
    db=Depends(get_db),
    user=Depends(current_user_optional),
):
    query: dict = {}
    if status:
        query["status"] = {"$in": [s.strip() for s in status.split(",")]}
    elif not include_duplicates:
        query["status"] = {"$ne": "duplicate"}
    if category:
        query["category"] = category
    if team:
        query["assigned_team"] = team

    docs = await db.issues.find(query).to_list(2000)
    now = utcnow()
    center = (lat, lng) if lat is not None and lng is not None else None
    items = [serialize_issue(d, user, now, center) for d in docs]

    if center:
        items = [i for i in items if i["distance_m"] <= radius_km * 1000]

    if sort == "recent":
        items.sort(key=lambda i: i["created_at"], reverse=True)
    elif sort == "upvotes":
        items.sort(key=lambda i: i["upvotes"], reverse=True)
    elif sort == "nearest" and center:
        items.sort(key=lambda i: i["distance_m"])
    else:
        items.sort(key=lambda i: i["priority"]["score"], reverse=True)
    return items[: max(1, min(limit, 500))]


@router.get("/manage")
async def manage_list(
    db=Depends(get_db),
    user=Depends(require_roles("admin", "team")),
):
    """Feed for the staff console, sorted by priority.

    Admins receive every issue; team members only ever receive issues assigned
    to their own team (enforced here, not just hidden in the UI). Merged
    duplicates are left out, and each issue carries `suggested_matches` with
    readable titles so staff can review and merge them.
    """
    query: dict = {"status": {"$ne": "duplicate"}}
    if user["role"] == "team":
        if not user.get("team"):
            return []
        query["assigned_team"] = user["team"]

    docs = await db.issues.find(query).to_list(2000)
    now = utcnow()
    items = [serialize_issue(d, user, now) for d in docs]

    wanted = {m["id"] for i in items for m in i["possible_duplicates"]}
    oids = []
    for raw in wanted:
        try:
            oids.append(ObjectId(raw))
        except (InvalidId, TypeError):
            pass
    targets = {}
    if oids:
        for t in await db.issues.find({"_id": {"$in": oids}}).to_list(len(oids)):
            targets[str(t["_id"])] = t

    for i in items:
        i["suggested_matches"] = [
            {
                "id": m["id"],
                "confidence": m["confidence"],
                "title": targets[m["id"]]["title"],
                "status": targets[m["id"]]["status"],
                "upvotes": targets[m["id"]].get("upvotes", 0),
            }
            for m in i["possible_duplicates"]
            if m["id"] in targets and targets[m["id"]]["status"] != "duplicate"
        ]

    items.sort(key=lambda i: i["priority"]["score"], reverse=True)
    return items


@router.get("/{issue_id}")
async def get_issue(
    issue_id: str, db=Depends(get_db), user=Depends(current_user_optional)
):
    return serialize_issue(await get_issue_or_404(db, issue_id), user)


@router.post("/{issue_id}/upvote")
async def toggle_upvote(issue_id: str, db=Depends(get_db), user=Depends(current_user)):
    """'Me too' — adds (or removes) the caller's upvote."""
    doc = await get_issue_or_404(db, issue_id)
    uid = str(user["_id"])
    if doc["reporter_id"] == uid:
        raise HTTPException(status_code=400, detail="You reported this issue already")
    if doc["status"] in ("resolved", "duplicate"):
        raise HTTPException(status_code=400, detail="This issue is closed")

    if uid in doc.get("upvoters", []):
        op = {"$pull": {"upvoters": uid}, "$inc": {"upvotes": -1}}
    else:
        op = {"$addToSet": {"upvoters": uid}, "$inc": {"upvotes": 1}}
    await db.issues.update_one({"_id": doc["_id"]}, {**op, "$set": {"updated_at": utcnow()}})
    return serialize_issue(await get_issue_or_404(db, issue_id), user)


@router.patch("/{issue_id}/assign")
async def assign_issue(
    issue_id: str,
    body: AssignIn,
    db=Depends(get_db),
    user=Depends(require_roles("admin")),
):
    doc = await get_issue_or_404(db, issue_id)
    if doc["status"] in ("resolved", "duplicate"):
        raise HTTPException(status_code=400, detail="Issue is already closed")
    now = utcnow()
    new_status = "assigned" if doc["status"] == "reported" else doc["status"]
    entry = {
        "status": new_status,
        "note": f"Assigned to {body.team} team",
        "by": user["name"],
        "at": now,
    }
    await db.issues.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "assigned_team": body.team,
                "status": new_status,
                "assigned_at": now,
                "updated_at": now,
            },
            "$push": {"timeline": entry},
        },
    )
    return serialize_issue(await get_issue_or_404(db, issue_id), user)


@router.patch("/{issue_id}/status")
async def update_status(
    issue_id: str,
    body: StatusIn,
    db=Depends(get_db),
    user=Depends(require_roles("admin", "team")),
):
    doc = await get_issue_or_404(db, issue_id)
    if doc["status"] == "duplicate":
        raise HTTPException(status_code=400, detail="Merged issues cannot be updated")
    if not doc.get("assigned_team"):
        raise HTTPException(status_code=400, detail="Assign a team before updating status")
    if user["role"] == "team" and user.get("team") != doc["assigned_team"]:
        raise HTTPException(status_code=403, detail="This issue belongs to another team")

    now = utcnow()
    entry = {"status": body.status, "note": body.note, "by": user["name"], "at": now}
    await db.issues.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "status": body.status,
                "resolved_at": now if body.status == "resolved" else None,
                "updated_at": now,
            },
            "$push": {"timeline": entry},
        },
    )
    return serialize_issue(await get_issue_or_404(db, issue_id), user)


@router.post("/{issue_id}/merge")
async def merge_duplicate(
    issue_id: str,
    body: MergeIn,
    db=Depends(get_db),
    user=Depends(require_roles("admin")),
):
    """Admin confirms this report duplicates another and folds it into that one."""
    doc = await get_issue_or_404(db, issue_id)
    target = await get_issue_or_404(db, body.duplicate_of)
    if doc["_id"] == target["_id"]:
        raise HTTPException(status_code=400, detail="Cannot merge an issue into itself")
    if target["status"] == "duplicate":
        raise HTTPException(status_code=400, detail="Target is itself a merged duplicate")
    if doc["status"] in ("resolved", "duplicate"):
        raise HTTPException(status_code=400, detail="Issue is already closed")

    now = utcnow()
    entry = {
        "status": "duplicate",
        "note": f"Merged into: {target['title']}",
        "by": user["name"],
        "at": now,
    }
    await db.issues.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "status": "duplicate",
                "duplicate_of": str(target["_id"]),
                "updated_at": now,
            },
            "$push": {"timeline": entry},
        },
    )
    # Don't double count if it was already auto-linked to this same target.
    if doc.get("possible_duplicate_of") != str(target["_id"]):
        await db.issues.update_one({"_id": target["_id"]}, {"$inc": {"duplicate_count": 1}})
    return serialize_issue(await get_issue_or_404(db, issue_id), user)
