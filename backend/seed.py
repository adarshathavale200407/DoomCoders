"""Seed demo data: users (admin, team leads, citizens) and ~45 realistic issues.

Usage (from backend/, with MONGODB_URI set in .env):
    python seed.py            # wipes users + issues, then seeds
    python seed.py --keep     # adds on top of existing data (users must not clash)
"""
import argparse
import asyncio
import os
import random
from datetime import timedelta

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from constants import CATEGORIES, TEAMS
from security import hash_password
from utils import utcnow

CENTER = (17.9535, 73.8870)  # demo city centre
ROADS = [
    "Station Road", "Market Road", "Temple Street", "Lake View Road",
    "College Road", "Riverside Lane", "Old Bus Stand Road", "Garden Colony Road",
]
SPOTS = [
    "the bus stop", "the school gate", "the temple entrance", "the vegetable market",
    "the bridge", "the petrol pump", "the public garden", "the hospital gate",
]
TEMPLATES = {
    "pothole": [
        ("Deep pothole on {road}", "Large pothole near {spot} damaging two-wheelers, gets worse after every rain."),
        ("Road caved in near {spot}", "The surface has collapsed on {road} and vehicles swerve to avoid it."),
    ],
    "water_leak": [
        ("Water pipe leaking on {road}", "Continuous leak from the main pipeline near {spot}, water is wasted all day."),
        ("Burst pipe flooding the street", "A pipe burst near {spot} on {road}; the road is waterlogged."),
    ],
    "garbage": [
        ("Garbage overflowing near {spot}", "Bins have not been cleared for days near {spot}; strong smell and stray animals."),
        ("Waste dumped on {road}", "A pile of mixed waste on {road} is blocking part of the footpath."),
    ],
    "streetlight": [
        ("Streetlight not working on {road}", "The light near {spot} has been off for several nights; unsafe after dark."),
        ("Broken streetlight pole at {spot}", "The pole is damaged and the lamp flickers constantly on {road}."),
    ],
    "other": [
        ("Fallen tree branch on {road}", "A large branch fell near {spot} and is blocking one lane."),
    ],
}

STAFF_PASSWORD = "team123"
CITIZEN_PASSWORD = "citizen123"
ADMIN_PASSWORD = "admin123"

DEMO_LOGINS = {
    "citizen": ("citizen@civicfix.app", CITIZEN_PASSWORD),
    "admin": ("admin@civicfix.app", ADMIN_PASSWORD),
    "roads team": ("roads@civicfix.app", STAFF_PASSWORD),
}


async def create_users(db) -> dict:
    now = utcnow()

    def user(name, email, password, role, team=None):
        return {
            "name": name,
            "email": email,
            "password_hash": hash_password(password),
            "role": role,
            "team": team,
            "created_at": now,
        }

    docs = [user("City Admin", "admin@civicfix.app", ADMIN_PASSWORD, "admin")]
    docs += [
        user(f"{t} Team Lead", f"{t.lower()}@civicfix.app", STAFF_PASSWORD, "team", t)
        for t in TEAMS
    ]
    citizens = [
        ("Demo Citizen", "citizen@civicfix.app"),
        ("Priya Patil", "priya@civicfix.app"),
        ("Rohan Jadhav", "rohan@civicfix.app"),
        ("Sneha Kulkarni", "sneha@civicfix.app"),
        ("Amit Shinde", "amit@civicfix.app"),
    ]
    docs += [user(n, e, CITIZEN_PASSWORD, "citizen") for n, e in citizens]

    res = await db.users.insert_many(docs)
    for d, _id in zip(docs, res.inserted_ids):
        d["_id"] = _id
    return {
        "admin": docs[0],
        "teams": {d["team"]: d for d in docs if d["role"] == "team"},
        "citizens": [d for d in docs if d["role"] == "citizen"],
    }


def _text(category: str, rng: random.Random, variant: int | None = None):
    templates = TEMPLATES[category]
    title, desc = templates[variant % len(templates)] if variant is not None else rng.choice(templates)
    ctx = {"road": rng.choice(ROADS), "spot": rng.choice(SPOTS)}
    return title.format(**ctx), desc.format(**ctx)


async def create_issues(db, users: dict, count: int = 42, seed: int = 7) -> int:
    rng = random.Random(seed)
    now = utcnow()
    admin = users["admin"]
    citizens = users["citizens"]
    demo = citizens[0]

    categories = rng.choices(
        ["pothole", "water_leak", "garbage", "streetlight", "other"],
        weights=[14, 9, 10, 8, 2],
        k=count,
    )
    docs = []
    for i, cat in enumerate(categories):
        reporter = demo if i < 5 else rng.choice(citizens)
        created = now - timedelta(hours=rng.uniform(3, 28 * 24))
        age_h = (now - created).total_seconds() / 3600
        status = rng.choices(
            ["resolved", "in_progress", "assigned", "reported"], weights=[45, 20, 15, 20]
        )[0]
        if age_h < 12 and status == "resolved":
            status = "in_progress"

        team = CATEGORIES[cat]["team"] or rng.choice(TEAMS)
        title, desc = _text(cat, rng)
        upvotes = rng.choice([0, 0, 1, 2, 3, 5, 8, 12])
        timeline = [{"status": "reported", "note": "Issue reported", "by": reporter["name"], "at": created}]
        assigned_team, resolved_at = None, None

        if status != "reported":
            assigned_team = team
            timeline.append({
                "status": "assigned", "note": f"Assigned to {team} team", "by": admin["name"],
                "at": created + timedelta(hours=age_h * 0.1),
            })
        if status in ("in_progress", "resolved"):
            timeline.append({
                "status": "in_progress", "note": "Crew dispatched",
                "by": users["teams"][team]["name"], "at": created + timedelta(hours=age_h * 0.2),
            })
        if status == "resolved":
            hours = rng.uniform(8, 140)
            if hours > age_h * 0.8:
                hours = age_h * 0.6
            resolved_at = created + timedelta(hours=hours)
            timeline.append({
                "status": "resolved", "note": "Work completed",
                "by": users["teams"][team]["name"], "at": resolved_at,
            })

        lat = CENTER[0] + rng.uniform(-0.018, 0.018)
        lng = CENTER[1] + rng.uniform(-0.018, 0.018)
        docs.append({
            "title": title, "description": desc, "category": cat,
            "severity": rng.choice([1, 2, 3, 3, 4, 4, 5]),
            "photo_url": None,
            "location": {"lat": round(lat, 6), "lng": round(lng, 6),
                         "address": f"{rng.choice(ROADS)}, Ward {rng.randint(1, 9)}"},
            "status": status,
            "reporter_id": str(reporter["_id"]), "reporter_name": reporter["name"],
            "upvotes": upvotes, "upvoters": [f"seed-{i}-{n}" for n in range(upvotes)],
            "duplicate_count": 0, "duplicate_of": None,
            "possible_duplicate_of": None, "possible_duplicates": [],
            "suggested_team": CATEGORIES[cat]["team"],
            "assigned_team": assigned_team,
            "assigned_at": timeline[1]["at"] if assigned_team else None,
            "created_at": created, "updated_at": timeline[-1]["at"], "resolved_at": resolved_at,
            "timeline": timeline,
        })

    res = await db.issues.insert_many(docs)
    for d, _id in zip(docs, res.inserted_ids):
        d["_id"] = _id

    # A few near-duplicate reports so the duplicate-detection flow shows up in the demo.
    bases = [d for d in docs if d["status"] in ("reported", "assigned", "in_progress") and d["category"] != "other"]
    extra = []
    for base in rng.sample(bases, min(5, len(bases))):
        for _ in range(rng.choice([1, 2])):
            reporter = rng.choice([c for c in citizens if str(c["_id"]) != base["reporter_id"]])
            created = min(now - timedelta(minutes=30), base["created_at"] + timedelta(hours=rng.uniform(1, 30)))
            title, desc = _text(base["category"], rng, variant=rng.randint(0, 1))
            extra.append({
                **base,
                "_id": None,
                "title": title, "description": desc,
                "location": {"lat": round(base["location"]["lat"] + rng.uniform(0.0002, 0.0004), 6),
                             "lng": round(base["location"]["lng"] + rng.uniform(0.0002, 0.0004), 6),
                             "address": base["location"]["address"]},
                "status": "reported", "assigned_team": None, "assigned_at": None,
                "reporter_id": str(reporter["_id"]), "reporter_name": reporter["name"],
                "upvotes": 0, "upvoters": [], "duplicate_count": 0,
                "possible_duplicate_of": str(base["_id"]),
                "possible_duplicates": [{"id": str(base["_id"]), "confidence": round(rng.uniform(0.55, 0.9), 2)}],
                "created_at": created, "updated_at": created, "resolved_at": None,
                "timeline": [{"status": "reported", "note": "Issue reported", "by": reporter["name"], "at": created}],
            })
            base["duplicate_count"] += 1
    for e in extra:
        e.pop("_id")
    if extra:
        await db.issues.insert_many(extra)
    for base in bases:
        if base["duplicate_count"]:
            await db.issues.update_one({"_id": base["_id"]}, {"$set": {"duplicate_count": base["duplicate_count"]}})
    return len(docs) + len(extra)


async def seed(db, reset: bool = True) -> int:
    if reset:
        await db.users.delete_many({})
        await db.issues.delete_many({})
    users = await create_users(db)
    return await create_issues(db, users)


async def _main(keep: bool):
    load_dotenv()
    uri = os.getenv("MONGODB_URI")
    if not uri:
        raise SystemExit("Set MONGODB_URI in backend/.env first.")
    client = AsyncIOMotorClient(uri)
    db = client[os.getenv("DB_NAME", "civicfix")]
    await db.users.create_index("email", unique=True)
    n = await seed(db, reset=not keep)
    print(f"Seeded {n} issues. Demo logins:")
    for label, (email, pw) in DEMO_LOGINS.items():
        print(f"  {label:<11} {email} / {pw}")
    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--keep", action="store_true", help="don't wipe existing data")
    asyncio.run(_main(parser.parse_args().keep))
