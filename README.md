# Civic Fix: Civic Issue Reporting Platform

> ACM Online Buildathon 2026 · Civic Tech / Urban Planning

## Team

**Team name:** Doom Coder

| # | Member |
|---|---|
| 1 | Suyash Chavan |
| 2 | Karan Kale |
| 3 | Adarsh Athavale |
| 4 | Sangram Salunkhe |

## Links

| | |
|---|---|
| **Deployed application** | _add link here_ |
| **Demo video (3-5 min)** | _add link here_ |
| **API docs** | _add link here_ (`/docs` on the deployed backend) |

## Project Overview

### The problem

Citizens struggle to report local civic issues (potholes, water leaks, overflowing garbage, broken streetlights), find the right authority, and track whether their complaint was ever resolved. On the other side, city teams receive duplicate complaints, have no clear order of urgency, and no visibility into how fast issues actually get fixed.

### Our solution

Civic Fix is a web platform that connects citizens and city teams:

- **Citizens** report an issue with a photo, description, category and map location. Before they submit, the app warns them if a similar report already exists nearby, so they can support it instead of creating a duplicate.
- **The system** ranks every open issue with an automatic priority score and flags likely duplicates for review.
- **City staff** assign issues to the right team and post status updates. An admin console gives full control over reports, duplicates and users.
- **Everyone** can see statistics on issue volume and resolution times.

### Features

| Requirement | Where it lives |
|---|---|
| Submit issues with photo, description, category and location | `/report`: map pin, GPS, address search, photo upload |
| View nearby reports and identify duplicates | `/issues` ("Near me" with radius), `/map`, live duplicate warning while reporting |
| Assign issues to teams and update their status | Staff actions on the issue page, `/manage`, `/admin/issues` |
| Track resolution through a citizen dashboard | `/dashboard`: progress bars, "new update" badges, personal stats |
| Display issue statistics and resolution times | `/stats` (public) and the admin overview |
| Automatic prioritization and duplicate detection | `backend/scoring.py`, `backend/duplicates.py` |
| Admin console | `/admin`: overview, all reports, duplicate review queue, user management |

### How automatic prioritization works

Each open issue gets a score from 0 to 100:

`priority = 40% severity + 35% community impact + 25% time unresolved`

- **Severity:** the average of the category's base danger (for example a water leak is more urgent than a streetlight) and the reporter's 1-5 rating.
- **Community impact:** upvotes ("me too") plus 2x the number of similar reports; it maxes out at 10.
- **Time unresolved:** grows daily and maxes out at 14 days.

Scores map to **Critical** (65+), **High** (45+), **Medium** (28+) and **Low**. Resolved and merged issues are closed and score 0. Priority is calculated when issues are read, so it always reflects the current votes and age.

### How duplicate detection works

A new report is compared with open reports of the **same category**, within **100 m** and the **last 60 days**:

`confidence = 65% proximity + 35% text similarity`

Text similarity combines token overlap with a character-level ratio on the title and description. Matches of 30% or more are shown to the reporter (who can support the existing report instead) and flagged for the admin, who can **merge** them or mark them **not a duplicate**.

### Roles

| Role | Can do |
|---|---|
| **Citizen** | Report issues, upvote, track own reports on the dashboard |
| **Team member** | See and update only the issues assigned to their own team |
| **Admin** | Everything: assign teams, update any status, merge duplicates, add notes, delete reports, change user roles, ban/unban users |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 (Vite), React Router, Tailwind CSS 4 |
| Maps | Leaflet + react-leaflet, OpenStreetMap tiles and Nominatim geocoding |
| Charts | Recharts |
| Backend | FastAPI (Python), Pydantic |
| Database | MongoDB Atlas (accessed with Motor, the async driver) |
| Auth | JWT tokens, bcrypt password hashing, role-based access control |
| Testing | pytest, mongomock-motor |
| Hosting | Vercel (frontend), Render (backend) |

### Why this stack

**React + Vite.** The app has many interactive screens (a live map, a form that checks for duplicates as you type, dashboards with filters). React's component model lets us reuse badges, cards and the map across citizen, staff and admin views. Vite gives fast reloads during development and a small, quick production build.

**Tailwind CSS.** Lets us build a consistent, mobile-friendly interface quickly without maintaining a large custom stylesheet. This matters because most citizens will report issues from a phone, standing next to the problem.

**Leaflet + OpenStreetMap.** Maps and address search are central to the product, and we needed them to be free and key-less so that the app works for any city without a billing account or API quota. Leaflet is lightweight and works well on phones.

**Recharts.** Declarative charts that fit naturally into React, used for the statistics page (resolution times, status and priority breakdown, daily trend).

**FastAPI.** Our backend does I/O-heavy work (database queries, duplicate search) and benefits from async support. Pydantic validates every request automatically (for example, coordinates must be real latitudes and longitudes), which prevents bad data from reaching the database. FastAPI also generates interactive API documentation at `/docs`, which helps the team test and helps reviewers explore the API. Python also made the scoring and text-similarity logic simple to write and test.

**MongoDB Atlas.** An issue is naturally one self-contained document: its location, votes, possible duplicates and full status timeline are stored together, so a page loads with a single read and we do not need joins. The flexible schema let us add fields (duplicate links, notes, bans) without migrations as requirements grew. The free Atlas tier suits a hackathon and deploys with no server to manage. Motor keeps database calls non-blocking.

**JWT + bcrypt + role checks.** Stateless tokens suit a separately hosted frontend and backend. Passwords are salted and hashed with bcrypt. Role checks are enforced **on the server**, not just hidden in the UI: team members can only fetch and update their own team's issues, and banned accounts are rejected on every request.

**pytest + mongomock.** The test suite runs without a real database, covering registration, duplicate detection, priority changes, permissions, merging, admin actions, bans and photo upload, so we could fix bugs with confidence.

**Vercel + Render.** Both have free tiers and deploy straight from GitHub, so the frontend and API can be updated independently.

## Setup & Usage

### Backend

```bash
cd backend
python -m venv .venv
# Windows (PowerShell): .venv\Scripts\Activate.ps1
# macOS/Linux:          source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # fill in MONGODB_URI and a strong JWT_SECRET
python seed.py           # demo users + about 45 sample issues (wipes users and issues)
uvicorn main:app --reload
```

The API runs at http://localhost:8000 and its docs are at http://localhost:8000/docs.

To add an admin to an existing database without wiping it, run `python create_admin.py you@example.com YourPassword "Your Name"`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env     # set VITE_API_URL
npm run dev
```

The app runs at http://localhost:5173.

### Tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest -q tests
```

### Demo logins (after `python seed.py`)

| Role | Login page | Email | Password |
|---|---|---|---|
| Admin | `/admin/login` | admin@civicfix.app | admin123 |
| Citizen | `/login` | citizen@civicfix.app | citizen123 |
| Roads team | `/login` | roads@civicfix.app | team123 |

These are demo credentials only. Change them before any real deployment.

### Environment variables

| File | Variable | Purpose |
|---|---|---|
| `backend/.env` | `MONGODB_URI` | MongoDB Atlas connection string |
| `backend/.env` | `DB_NAME` | Database name |
| `backend/.env` | `ALLOWED_ORIGINS` | Comma-separated frontend URLs allowed by CORS |
| `backend/.env` | `JWT_SECRET` | Secret used to sign login tokens |
| `frontend/.env` | `VITE_API_URL` | URL of the backend API |
| `frontend/.env` | `VITE_CLOUDINARY_*` | Optional: use Cloudinary instead of the built-in photo upload |

## Project Structure

```
backend/
  main.py, deps.py, security.py      app setup, auth dependencies, JWT/bcrypt
  scoring.py, duplicates.py          priority score, duplicate detection
  routers/                           auth, issues, admin, stats, uploads
  seed.py, create_admin.py           demo data, admin creation
  tests/                             pytest suite
frontend/src/
  pages/                             citizen, staff and admin screens
  components/                        shared UI, maps, badges, staff actions
  lib/, context/                     API client, auth state
```
