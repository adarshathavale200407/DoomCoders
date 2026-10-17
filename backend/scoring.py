"""Priority scoring, distance and text-similarity helpers."""
import difflib
import math
import re

from constants import CATEGORIES
from utils import utcnow

# Priority weights (documented in README)
W_SEVERITY = 0.40
W_IMPACT = 0.35
W_AGE = 0.25

IMPACT_SATURATION = 10  # upvotes + 2*duplicates at which impact maxes out
AGE_SATURATION_DAYS = 14  # days unresolved at which age maxes out

_STOPWORDS = {
    "the", "a", "an", "is", "are", "in", "on", "at", "near", "of", "and", "to",
    "for", "with", "this", "that", "it", "has", "have", "been", "very", "there",
}


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in _STOPWORDS}


def text_similarity(a: str, b: str) -> float:
    """0..1 — average of token Jaccard overlap and character-level ratio."""
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    jaccard = len(ta & tb) / len(ta | tb)
    ratio = difflib.SequenceMatcher(None, " ".join(sorted(ta)), " ".join(sorted(tb))).ratio()
    return round((jaccard + ratio) / 2, 4)


def priority_label(score: float) -> str:
    if score >= 65:
        return "Critical"
    if score >= 45:
        return "High"
    if score >= 28:
        return "Medium"
    return "Low"


def priority(issue: dict, now=None) -> dict:
    """Priority 0-100 from severity, community impact and time unresolved."""
    if issue["status"] in ("resolved", "duplicate"):
        return {
            "score": 0,
            "label": "Closed",
            "breakdown": {"severity": 0, "impact": 0, "age": 0},
        }
    now = now or utcnow()
    base = CATEGORIES.get(issue["category"], {}).get("base_severity", 2)
    severity = (base + issue.get("severity", 3)) / 10  # avg of two 1-5 values, /5
    impact_raw = issue.get("upvotes", 0) + 2 * issue.get("duplicate_count", 0)
    impact = min(1.0, impact_raw / IMPACT_SATURATION)
    age_days = max(0.0, (now - issue["created_at"]).total_seconds() / 86400)
    age = min(1.0, age_days / AGE_SATURATION_DAYS)

    score = round(100 * (W_SEVERITY * severity + W_IMPACT * impact + W_AGE * age), 1)
    return {
        "score": score,
        "label": priority_label(score),
        "breakdown": {
            "severity": round(severity, 2),
            "impact": round(impact, 2),
            "age": round(age, 2),
        },
    }
