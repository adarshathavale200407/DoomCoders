"""Potential-duplicate detection: same category + close by + similar text."""
import math
from datetime import timedelta

from constants import OPEN_STATUSES
from scoring import haversine_m, text_similarity
from utils import utcnow

DEFAULT_RADIUS_M = 100
W_PROXIMITY = 0.65
W_TEXT = 0.35


async def find_duplicates(
    db,
    category: str,
    lat: float,
    lng: float,
    title: str = "",
    description: str = "",
    radius_m: int = DEFAULT_RADIUS_M,
    min_confidence: float = 0.3,
    limit: int = 5,
    max_age_days: int = 60,
) -> list[dict]:
    dlat = radius_m / 111_000
    dlng = radius_m / (111_000 * max(0.1, math.cos(math.radians(lat))))
    cutoff = utcnow() - timedelta(days=max_age_days)

    cursor = db.issues.find(
        {
            "category": category,
            "status": {"$in": OPEN_STATUSES},
            "duplicate_of": None,
            "location.lat": {"$gte": lat - dlat, "$lte": lat + dlat},
            "location.lng": {"$gte": lng - dlng, "$lte": lng + dlng},
            "created_at": {"$gte": cutoff},
        }
    )
    candidates = await cursor.to_list(200)

    new_text = f"{title} {description}"
    matches = []
    for doc in candidates:
        dist = haversine_m(lat, lng, doc["location"]["lat"], doc["location"]["lng"])
        if dist > radius_m:
            continue
        proximity = 1 - dist / radius_m
        text = text_similarity(new_text, f"{doc['title']} {doc['description']}")
        confidence = round(W_PROXIMITY * proximity + W_TEXT * text, 2)
        if confidence >= min_confidence:
            matches.append({"issue": doc, "distance_m": round(dist), "confidence": confidence})

    matches.sort(key=lambda m: -m["confidence"])
    return matches[:limit]
