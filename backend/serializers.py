from constants import CATEGORIES
from scoring import haversine_m, priority
from utils import iso, utcnow


def public_user(u: dict) -> dict:
    return {
        "id": str(u["_id"]),
        "name": u["name"],
        "email": u["email"],
        "role": u["role"],
        "team": u.get("team"),
    }


def serialize_issue(doc: dict, user: dict | None = None, now=None, center=None) -> dict:
    now = now or utcnow()
    uid = str(user["_id"]) if user else None
    created, resolved = doc["created_at"], doc.get("resolved_at")
    out = {
        "id": str(doc["_id"]),
        "title": doc["title"],
        "description": doc["description"],
        "category": doc["category"],
        "category_label": CATEGORIES.get(doc["category"], {}).get("label", doc["category"]),
        "severity": doc.get("severity", 3),
        "photo_url": doc.get("photo_url"),
        "location": doc["location"],
        "status": doc["status"],
        "reporter_name": doc.get("reporter_name"),
        "upvotes": doc.get("upvotes", 0),
        "duplicate_count": doc.get("duplicate_count", 0),
        "duplicate_of": doc.get("duplicate_of"),
        "possible_duplicate_of": doc.get("possible_duplicate_of"),
        "possible_duplicates": doc.get("possible_duplicates", []),
        "suggested_team": doc.get("suggested_team"),
        "assigned_team": doc.get("assigned_team"),
        "created_at": iso(created),
        "updated_at": iso(doc.get("updated_at")),
        "resolved_at": iso(resolved),
        "resolution_hours": round((resolved - created).total_seconds() / 3600, 1)
        if resolved
        else None,
        "timeline": [
            {"status": t["status"], "note": t.get("note"), "by": t.get("by"), "at": iso(t["at"])}
            for t in doc.get("timeline", [])
        ],
        "priority": priority(doc, now),
        "upvoted_by_me": bool(uid and uid in doc.get("upvoters", [])),
        "is_mine": bool(uid and uid == doc.get("reporter_id")),
    }
    if center:
        out["distance_m"] = round(
            haversine_m(center[0], center[1], doc["location"]["lat"], doc["location"]["lng"])
        )
    return out


def match_summary(match: dict) -> dict:
    d = match["issue"]
    return {
        "id": str(d["_id"]),
        "title": d["title"],
        "description": d["description"],
        "category": d["category"],
        "status": d["status"],
        "upvotes": d.get("upvotes", 0),
        "location": d["location"],
        "created_at": iso(d["created_at"]),
        "distance_m": match["distance_m"],
        "confidence": match["confidence"],
    }
