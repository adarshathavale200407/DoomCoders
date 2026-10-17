import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()  # must run before anything reads os.environ (security.py reads JWT_SECRET)

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from routers import admin, auth, issues, stats, uploads  # noqa: E402

MONGODB_URI = os.getenv("MONGODB_URI", "")
DB_NAME = os.getenv("DB_NAME", "civicfix")
# Comma-separated list of allowed frontend origins
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.client = AsyncIOMotorClient(MONGODB_URI) if MONGODB_URI else None
    app.state.db = app.state.client[DB_NAME] if app.state.client else None
    if app.state.db is not None:
        try:
            await app.state.db.users.create_index("email", unique=True)
            await app.state.db.issues.create_index([("status", 1), ("category", 1)])
            await app.state.db.issues.create_index("reporter_id")
            await app.state.db.issues.create_index("assigned_team")
        except Exception:  # noqa: BLE001 - never block startup on index creation
            pass
    yield
    if app.state.client:
        app.state.client.close()


app = FastAPI(title="Civic Fix API", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(issues.router)
app.include_router(stats.router)
app.include_router(admin.router)
app.include_router(uploads.router)


@app.get("/")
async def root():
    return {"service": "Civic Fix API", "docs": "/docs"}


@app.get("/health")
async def health():
    """Liveness + database connectivity check."""
    if app.state.db is None:
        return {"status": "ok", "database": "not configured"}
    try:
        await app.state.client.admin.command("ping")
        return {"status": "ok", "database": "connected"}
    except Exception as exc:  # noqa: BLE001
        return {"status": "degraded", "database": f"error: {type(exc).__name__}"}
