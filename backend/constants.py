"""Shared constants: categories, teams, statuses."""

TEAMS = ["Roads", "Water", "Sanitation", "Electricity"]

# base_severity (1-5) is the inherent danger/urgency of the category.
# team is the default team issues in this category are routed to.
CATEGORIES = {
    "pothole": {"label": "Pothole", "team": "Roads", "base_severity": 3},
    "water_leak": {"label": "Water leak", "team": "Water", "base_severity": 4},
    "garbage": {"label": "Overflowing garbage", "team": "Sanitation", "base_severity": 3},
    "streetlight": {"label": "Broken streetlight", "team": "Electricity", "base_severity": 2},
    "other": {"label": "Other", "team": None, "base_severity": 2},
}

OPEN_STATUSES = ["reported", "assigned", "in_progress"]
CLOSED_STATUSES = ["resolved", "duplicate"]
ALL_STATUSES = OPEN_STATUSES + CLOSED_STATUSES
