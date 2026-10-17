# Civic Fix

**Report it. Rank it. Fix it.** A civic issue reporting platform that connects citizens with city teams.

> ACM Online Buildathon 2026 · Civic Tech / Urban Planning

| | |
|---|---|
| **Live app** | https://doom-coders.vercel.app/ |
| **Demo video (3–5 min)** | https://youtu.be/qaXkkKtoNDg |
| **Team** | Doom Coder: Suyash Chavan, Karan Kale, Adarsh Athavale, Sangram Salunkhe |

---

## The Problem

Citizens struggle to report potholes, water leaks, overflowing garbage and broken streetlights. They don't know which authority to contact, and they can't tell if their complaint was ever resolved.

City teams face the opposite problem: duplicate complaints, no clear order of urgency, and no visibility into how fast issues actually get fixed.

## Our Solution

Civic Fix is one web platform for both sides.

- **Citizens** report an issue with a photo, description, category and map location. If a similar report already exists nearby, the app warns them so they can support it instead of creating a duplicate.
- **The system** gives every open issue an automatic priority score and flags likely duplicates.
- **City staff** assign issues to the right team and post status updates.
- **Admins** control reports, duplicates and users from one console.
- **Everyone** can see public statistics on issue volume and resolution times.

## Features

| What the challenge asks for | Where to find it |
|---|---|
| Submit issues with photo, description, category, location | `/report` (map pin, GPS, address search, photo upload) |
| View nearby reports and spot duplicates | `/issues` ("Near me" with radius), `/map`, live duplicate warning while reporting |
| Assign issues to teams and update status | Issue page, `/manage`, `/admin/issues` |
| Citizen dashboard to track resolution | `/dashboard` (progress bars, "new update" badges, personal stats) |
| Issue statistics and resolution times | `/stats` (public) and admin overview |
| Automatic prioritization and duplicate detection | `backend/scoring.py`, `backend/duplicates.py` |
| Admin console | `/admin` (overview, all reports, duplicate review, user management) |

## How It Works

### Automatic prioritization

Every open issue gets a score from 0 to 100:

```
priority = 40% severity + 35% community impact + 25% time unresolved
```

| Factor | How it is measured |
|---|---|
| Severity | Average of the category's base danger (a water leak outranks a streetlight) and the reporter's 1–5 rating |
| Community impact | Upvotes ("me too") plus 2× the number of similar reports, capped at 10 |
| Time unresolved | Grows daily, capped at 14 days |

**Levels:** Critical (65+), High (45+), Medium (28+), Low. Resolved and merged issues score 0. Scores are calculated each time issues are read, so they always reflect current votes and age.

### Duplicate detection

A new report is compared with open reports that are in the **same category**, within **100 m**, and from the **last 60 days**:

```
confidence = 65% proximity + 35% text similarity
```

Text similarity combines word overlap with a character-level match on title and description. Matches of **30% or more** are shown to the reporter (who can support the existing report) and flagged for the admin, who can **merge** them or mark them **not a duplicate**.

### User roles

| Role | Permissions |
|---|---|
| **Citizen** | Report issues, upvote, track own reports |
| **Team member** | See and update only issues assigned to their team |
| **Admin** | Everything: assign teams, update any status, merge duplicates, add notes, delete reports, change roles, ban/unban users |

Permissions are enforced on the server, not just hidden in the UI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 (Vite), React Router, Tailwind CSS 4 |
| Maps | Leaflet + react-leaflet, OpenStreetMap tiles, Nominatim geocoding |
| Charts | Recharts |
| Backend | FastAPI (Python), Pydantic |
| Database | MongoDB Atlas (Motor async driver) |
| Auth | JWT, bcrypt, role-based access control |
| Testing | pytest, mongomock-motor |
| Hosting | Vercel (frontend), Render (backend) |

### Why we chose it

| Choice | Reason |
|---|---|
| **React + Vite** | Many interactive screens (live map, duplicate check as you type, dashboards). Reusable components keep citizen, staff and admin views consistent. Vite gives fast development and small builds. |
| **Tailwind CSS** | Quick, consistent, mobile-friendly UI. Most citizens will report from a phone, next to the problem. |
| **Leaflet + OpenStreetMap** | Free and key-less, so the app works for any city with no billing account or API quota. Lightweight on phones. |
| **Recharts** | Declarative charts that fit naturally into React for resolution times, status/priority breakdowns and daily trends. |
| **FastAPI** | Async support suits database-heavy work. Pydantic validates every request (e.g. coordinates must be real), keeping bad data out. Auto-generated API docs at `/docs`. Python made scoring and text-similarity logic simple to write and test. |
| **MongoDB Atlas** | An issue is one self-contained document (location, votes, duplicates, status timeline), so a page loads with a single read and no joins. The flexible schema let us add features without migrations. Free tier, no server to manage. |
| **JWT + bcrypt + role checks** | Stateless tokens suit a separately hosted frontend and backend. Passwords are salted and hashed. Banned accounts are rejected on every request. |
| **pytest + mongomock** | Tests run without a real database and cover registration, duplicates, priority, permissions, merging, admin actions, bans and photo upload. |
| **Vercel + Render** | Free tiers, deploy straight from GitHub, frontend and API update independently. |

---

## Try It

**Fastest way:** open the [live app](https://doom-coders.vercel.app/) and log in with a demo account.

| Role | Email | Password |
|---|---|---|
| Admin | admin@civicfix.app | admin123 |
| Citizen | citizen@civicfix.app | citizen123 |
| Roads team | roads@civicfix.app | team123 |

_Demo credentials only. Change them before any real deployment._

## Run Locally

**Backend**

```bash
cd backend
python -m venv .venv
# Windows (PowerShell): .venv\Scripts\Activate.ps1
# macOS/Linux:          source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # fill in MONGODB_URI and a strong JWT_SECRET
python seed.py           # demo users + ~45 sample issues (wipes users and issues)
uvicorn main:app --reload
```

API: http://localhost:8000 · Docs: http://localhost:8000/docs

To add an admin without wiping data:
`python create_admin.py you@example.com YourPassword "Your Name"`

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env     # set VITE_API_URL
npm run dev
```

App: http://localhost:5173

**Tests**

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest -q tests
```

### Environment variables

| File | Variable | Purpose |
|---|---|---|
| `backend/.env` | `MONGODB_URI` | MongoDB Atlas connection string |
| `backend/.env` | `DB_NAME` | Database name |
| `backend/.env` | `ALLOWED_ORIGINS` | Frontend URLs allowed by CORS (comma-separated) |
| `backend/.env` | `JWT_SECRET` | Secret for signing login tokens |
| `frontend/.env` | `VITE_API_URL` | Backend API URL |
| `frontend/.env` | `VITE_CLOUDINARY_*` | Optional: use Cloudinary instead of built-in photo upload |

## Project Structure

```
backend/
  main.py, deps.py, security.py      app setup, auth, JWT/bcrypt
  scoring.py, duplicates.py          priority score, duplicate detection
  routers/                           auth, issues, admin, stats, uploads
  seed.py, create_admin.py           demo data, admin creation
  tests/                             pytest suite
frontend/src/
  pages/                             citizen, staff and admin screens
  components/                        shared UI, maps, badges, staff actions
  lib/, context/                     API client, auth state
```