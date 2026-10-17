"""Admin-only endpoints. Everything here requires role == "admin".

Reused from elsewhere (not repeated here):
  GET   /stats                    dashboard numbers (routers/stats.py)
  GET   /issues/{id}              issue detail
  PATCH /issues/{id}/assign       assign to team
  PATCH /issues/{id}/status       change status
  POST  /issues/{id}/merge        merge a duplicate
"""
import re
from typing import Literal, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from constants import ALL_STATUSES, OPEN_STATUSES, TEAMS
from deps import get_db, require_admin
from serializers import public_user, serialize_issue
from utils import iso, to_oid, utcnow

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------- request models ----------
class NoteIn(BaseModel):
    note: str = Field(min_length=1, max_length=500)


class BanIn(BaseModel):
    banned: bool


class RoleIn(BaseModel):
    role: Literal["citizen", "team", "admin"]
    team: Optional[str] = None


# ---------- helpers ----------
def _page(items: list, total: int, page: int, page_size: int) -> dict:
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


def _admin_user(u: dict) -> dict:
    return {**public_user(u), "banned": bool(u.get("banned")), "created_at": iso(u.get("created_at"))}


async def _issue_or_404(db, issue_id: str) -> dict:
    doc = await db.issues.find_one({"_id": to_oid(issue_id, "Issue")})
    if doc is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    return doc


# ---------- overview ----------
@router.get("/overview")
async def overview(db=Depends(get_db), admin=Depends(require_admin)):
    """Small extras the dashboard needs on top of GET /stats."""
    return {
        "unassigned_open": await db.issues.count_documents(
            {"status": {"$in": OPEN_STATUSES}, "assigned_team": None}
        ),
        "pending_duplicate_reviews": await db.issues.count_documents(
            {"status": {"$in": OPEN_STATUSES}, "possible_duplicates.0": {"$exists": True}}
        ),
        "users": {
            "citizen": await db.users.count_documents({"role": "citizen"}),
            "team": await db.users.count_documents({"role": "team"}),
            "admin": await db.users.count_documents({"role": "admin"}),
            "banned": await db.users.count_documents({"banned": True}),
        },
    }


# ---------- issues ----------
@router.get("/issues")
async def list_issues(
    status: str | None = None,          # comma-separated
    category: str | None = None,
    team: str | None = None,
    unassigned: bool = False,
    search: str | None = None,
    sort: str = "recent",               # recent | oldest | upvotes | priority
    page: int = 1,
    page_size: int = 20,
    db=Depends(get_db),
    admin=Depends(require_admin),
):
    page = max(1, page)
    page_size = max(1, min(page_size, 100))

    query: dict = {}
    if status:
        wanted = [s.strip() for s in status.split(",") if s.strip() in ALL_STATUSES]
        if wanted:
            query["status"] = {"$in": wanted}
    if category:
        query["category"] = category
    if team:
        query["assigned_team"] = team
    if unassigned:
        query["assigned_team"] = None
        query.setdefault("status", {"$in": OPEN_STATUSES})
    if search and search.strip():
        rx = {"$regex": re.escape(search.strip()), "$options": "i"}
        query["$or"] = [
            {"title": rx},
            {"description": rx},
            {"location.address": rx},
            {"reporter_name": rx},
        ]

    now = utcnow()
    total = await db.issues.count_documents(query)
    skip = (page - 1) * page_size

    if sort == "priority":
        # priority is computed, not stored, so sort in memory
        docs = await db.issues.find(query).to_list(5000)
        items = [serialize_issue(d, admin, now) for d in docs]
        items.sort(key=lambda i: i["priority"]["score"], reverse=True)
        items = items[skip : skip + page_size]
    else:
        field, direction = {
            "recent": ("created_at", -1),
            "oldest": ("created_at", 1),
            "upvotes": ("upvotes", -1),
        }.get(sort, ("created_at", -1))
        docs = await db.issues.find(query).sort(field, direction).skip(skip).limit(page_size).to_list(page_size)
        items = [serialize_issue(d, admin, now) for d in docs]

    return _page(items, total, page, page_size)


@router.post("/issues/{issue_id}/note")
async def add_note(
    issue_id: str, body: NoteIn, db=Depends(get_db), admin=Depends(require_admin)
):
    """Adds an entry to the issue timeline (visible to anyone who can see the issue)."""
    doc = await _issue_or_404(db, issue_id)
    now = utcnow()
    entry = {"status": doc["status"], "note": body.note.strip(), "by": admin["name"], "at": now}
    await db.issues.update_one(
        {"_id": doc["_id"]}, {"$push": {"timeline": entry}, "$set": {"updated_at": now}}
    )
    return serialize_issue(await _issue_or_404(db, issue_id), admin)


@router.delete("/issues/{issue_id}", status_code=204)
async def delete_issue(issue_id: str, db=Depends(get_db), admin=Depends(require_admin)):
    doc = await _issue_or_404(db, issue_id)
    if await db.issues.find_one({"duplicate_of": str(doc["_id"])}):
        raise HTTPException(
            status_code=400,
            detail="Other reports are merged into this issue. Delete or unmerge them first.",
        )
    # Undo the duplicate_count bump this issue gave its target
    target_id = doc.get("duplicate_of") or doc.get("possible_duplicate_of")
    if target_id:
        try:
            await db.issues.update_one(
                {"_id": ObjectId(target_id), "duplicate_count": {"$gt": 0}},
                {"$inc": {"duplicate_count": -1}},
            )
        except (InvalidId, TypeError):
            pass
    await db.issues.delete_one({"_id": doc["_id"]})


# ---------- duplicate review ----------
@router.get("/duplicates")
async def duplicate_queue(db=Depends(get_db), admin=Depends(require_admin)):
    """Open issues the system flagged as possible duplicates, highest confidence first."""
    docs = await db.issues.find(
        {"status": {"$in": OPEN_STATUSES}, "possible_duplicates.0": {"$exists": True}}
    ).to_list(500)

    oids = set()
    for d in docs:
        for m in d["possible_duplicates"]:
            try:
                oids.add(ObjectId(m["id"]))
            except (InvalidId, TypeError):
                pass
    targets = {}
    if oids:
        for t in await db.issues.find({"_id": {"$in": list(oids)}}).to_list(len(oids)):
            targets[str(t["_id"])] = t

    now = utcnow()
    out = []
    for d in docs:
        matches = [
            {
                "id": m["id"],
                "confidence": m["confidence"],
                "title": targets[m["id"]]["title"],
                "description": targets[m["id"]]["description"],
                "status": targets[m["id"]]["status"],
                "upvotes": targets[m["id"]].get("upvotes", 0),
                "location": targets[m["id"]]["location"],
            }
            for m in d["possible_duplicates"]
            if m["id"] in targets and targets[m["id"]]["status"] != "duplicate"
        ]
        if matches:
            item = serialize_issue(d, admin, now)
            item["suggested_matches"] = matches
            out.append(item)

    out.sort(key=lambda i: -i["suggested_matches"][0]["confidence"])
    return out


@router.post("/issues/{issue_id}/dismiss-duplicate")
async def dismiss_duplicate(
    issue_id: str, db=Depends(get_db), admin=Depends(require_admin)
):
    """Admin says: 'these are NOT duplicates'. Clears the flag and undoes the count bump."""
    doc = await _issue_or_404(db, issue_id)
    if doc["status"] == "duplicate":
        raise HTTPException(status_code=400, detail="Issue is already merged")
    if not doc.get("possible_duplicates") and not doc.get("possible_duplicate_of"):
        raise HTTPException(status_code=400, detail="No duplicate suggestion to dismiss")

    target_id = doc.get("possible_duplicate_of")
    await db.issues.update_one(
        {"_id": doc["_id"]},
        {"$set": {"possible_duplicate_of": None, "possible_duplicates": [], "updated_at": utcnow()}},
    )
    if target_id:
        try:
            await db.issues.update_one(
                {"_id": ObjectId(target_id), "duplicate_count": {"$gt": 0}},
                {"$inc": {"duplicate_count": -1}},
            )
        except (InvalidId, TypeError):
            pass
    return serialize_issue(await _issue_or_404(db, issue_id), admin)


# ---------- users ----------
@router.get("/users")
async def list_users(
    role: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db=Depends(get_db),
    admin=Depends(require_admin),
):
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    query: dict = {}
    if role in ("citizen", "team", "admin"):
        query["role"] = role
    if search and search.strip():
        rx = {"$regex": re.escape(search.strip()), "$options": "i"}
        query["$or"] = [{"name": rx}, {"email": rx}]

    total = await db.users.count_documents(query)
    docs = (
        await db.users.find(query)
        .sort("created_at", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
        .to_list(page_size)
    )
    return _page([_admin_user(u) for u in docs], total, page, page_size)


async def _user_or_404(db, user_id: str) -> dict:
    u = await db.users.find_one({"_id": to_oid(user_id, "User")})
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    return u


@router.patch("/users/{user_id}/ban")
async def set_ban(
    user_id: str, body: BanIn, db=Depends(get_db), admin=Depends(require_admin)
):
    user = await _user_or_404(db, user_id)
    if user["_id"] == admin["_id"]:
        raise HTTPException(status_code=400, detail="You cannot ban yourself")
    if user["role"] == "admin" and body.banned:
        raise HTTPException(status_code=400, detail="Demote this admin before banning")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"banned": body.banned}})
    return _admin_user(await _user_or_404(db, user_id))


@router.patch("/users/{user_id}/role")
async def set_role(
    user_id: str, body: RoleIn, db=Depends(get_db), admin=Depends(require_admin)
):
    user = await _user_or_404(db, user_id)
    if user["_id"] == admin["_id"]:
        raise HTTPException(status_code=400, detail="You cannot change your own role")
    if body.role == "team":
        if body.team not in TEAMS:
            raise HTTPException(status_code=400, detail=f"Team must be one of {TEAMS}")
        team = body.team
    else:
        team = None
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"role": body.role, "team": team}})
    return _admin_user(await _user_or_404(db, user_id))
