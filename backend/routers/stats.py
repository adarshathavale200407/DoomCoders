import statistics
from collections import Counter
from datetime import timedelta

from fastapi import APIRouter, Depends

from constants import ALL_STATUSES, CATEGORIES, OPEN_STATUSES, TEAMS
from deps import get_db
from scoring import priority
from utils import utcnow

router = APIRouter(tags=["stats"])


def _hours(doc) -> float:
    return (doc["resolved_at"] - doc["created_at"]).total_seconds() / 3600


def _avg(values: list[float]):
    return round(sum(values) / len(values), 1) if values else None


@router.get("/meta")
async def meta():
    """Static lookup data for forms and filters."""
    return {
        "categories": [
            {"key": k, "label": v["label"], "team": v["team"]} for k, v in CATEGORIES.items()
        ],
        "teams": TEAMS,
        "statuses": ALL_STATUSES,
    }


@router.get("/stats")
async def stats(db=Depends(get_db)):
    docs = await db.issues.find({}).to_list(5000)
    now = utcnow()

    counted = [d for d in docs if d["status"] != "duplicate"]
    resolved = [d for d in counted if d["status"] == "resolved" and d.get("resolved_at")]
    res_hours = [_hours(d) for d in resolved]

    by_status = Counter(d["status"] for d in docs)
    by_category = {
        key: {
            "label": meta["label"],
            "total": sum(1 for d in counted if d["category"] == key),
            "resolved": sum(1 for d in resolved if d["category"] == key),
            "avg_resolution_hours": _avg([_hours(d) for d in resolved if d["category"] == key]),
        }
        for key, meta in CATEGORIES.items()
    }

    by_team = {}
    for team in TEAMS:
        team_docs = [d for d in counted if d.get("assigned_team") == team]
        team_resolved = [d for d in team_docs if d in resolved]
        by_team[team] = {
            "assigned": len(team_docs),
            "resolved": len(team_resolved),
            "open": len(team_docs) - len(team_resolved),
            "avg_resolution_hours": _avg([_hours(d) for d in team_resolved]),
        }

    open_docs = [d for d in counted if d["status"] in OPEN_STATUSES]
    by_priority = Counter(priority(d, now)["label"] for d in open_docs)

    today = now.date()
    series = []
    for offset in range(13, -1, -1):
        day = today - timedelta(days=offset)
        series.append(
            {
                "date": day.isoformat(),
                "reported": sum(1 for d in counted if d["created_at"].date() == day),
                "resolved": sum(1 for d in resolved if d["resolved_at"].date() == day),
            }
        )

    return {
        "total": len(counted),
        "open": len(open_docs),
        "resolved": len(resolved),
        "duplicates_merged": by_status.get("duplicate", 0),
        "resolution_rate": round(100 * len(resolved) / len(counted), 1) if counted else 0,
        "avg_resolution_hours": _avg(res_hours),
        "median_resolution_hours": round(statistics.median(res_hours), 1) if res_hours else None,
        "unassigned": sum(1 for d in open_docs if not d.get("assigned_team")),
        "by_status": {s: by_status.get(s, 0) for s in ALL_STATUSES},
        "by_category": by_category,
        "by_team": by_team,
        "open_by_priority": {
            k: by_priority.get(k, 0) for k in ("Critical", "High", "Medium", "Low")
        },
        "last_14_days": series,
    }
