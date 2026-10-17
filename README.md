# Civic Fix — Civic Issue Reporting Platform

> ACM Online Buildathon 2026 · Civic Tech / Urban Planning

**Live app:** _TODO — add Vercel URL_
**Demo video (3–5 min):** _TODO — add YouTube (unlisted) / Drive link_
**API docs:** _TODO — add Render URL_`/docs`

## Problem

Citizens struggle to report local civic issues (potholes, water leaks, overflowing garbage, broken streetlights), find the right authority, and track whether their complaint was ever resolved.

## Solution

Civic Fix lets citizens report local issues with a photo, category and map location, warns them about duplicate reports before they submit, ranks everything by an automatic priority score, and gives city staff an admin console to assign teams, update status and review duplicates.

## Features

| Requirement | Where it lives |
|---|---|
| Submit issues with photo, description, category, location | `/report` (map pin + GPS + address search, photo upload via `POST /uploads`) |
| View nearby reports, identify duplicates | `/issues` ("Near me" + radius), `/map`, live duplicate warning while reporting (`POST /issues/check-duplicates`) |
| Assign issues to teams, update status | Issue page "Staff actions", `/manage` (teams only see their own issues), `/admin/issues` |
| Citizen dashboard | `/dashboard` (progress bars, "new update" badges, personal stats) |
| Statistics and resolution times | `/stats` (public) and `/admin` overview (rate, average/median fix time, team workload) |
| Auto-priority + duplicate detection | `backend/scoring.py`, `backend/duplicates.py` |
| Admin | `/admin/login` then `/admin`: overview, all reports (search/filter/sort, notes, delete), duplicate review queue (merge / "not a duplicate"), user management (roles, ban/unban) |

### Priority score (0-100)

`40% severity + 35% community impact + 25% time unresolved`. Severity averages the category's base danger with the reporter's 1-5 rating; impact is upvotes plus 2x similar reports (saturates at 10); age saturates at 14 days. Labels: Critical (65+), High (45+), Medium (28+), Low.

### Duplicate detection

Same category, open, within 100 m, last 60 days. Confidence = 65% proximity + 35% text similarity (token overlap and character ratio). Matches of 30%+ are shown to the reporter and flagged for admin review.

## Demo logins (after `python seed.py`)

| Role | Email | Password |
|---|---|---|
| Admin | admin@civicfix.app | admin123 |
| Citizen | citizen@civicfix.app | citizen123 |
| Roads team | roads@civicfix.app | team123 |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | MongoDB Atlas |
| Hosting | Vercel (frontend), Render (backend) |

### Why this stack

_TODO_

## Setup & Usage

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in MONGODB_URI and a strong JWT_SECRET
python seed.py          # demo users + ~45 sample issues (wipes users/issues)
uvicorn main:app --reload
```

API runs at http://localhost:8000 (docs at `/docs`).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL
npm run dev
```

App runs at http://localhost:5173.

## Team

_TODO — names_
