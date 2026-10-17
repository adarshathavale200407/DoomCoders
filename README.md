# Civic Fix — Civic Issue Reporting Platform

> ACM Online Buildathon 2026 · Civic Tech / Urban Planning

**Live app:** _TODO — add Vercel URL_
**Demo video (3–5 min):** _TODO — add YouTube (unlisted) / Drive link_
**API docs:** _TODO — add Render URL_`/docs`

## Problem

Citizens struggle to report local civic issues (potholes, water leaks, overflowing garbage, broken streetlights), find the right authority, and track whether their complaint was ever resolved.

## Solution

_TODO_

## Features

_TODO_

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
cp .env.example .env   # fill in MONGODB_URI
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
