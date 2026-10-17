import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

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
    yield
    if app.state.client:
        app.state.client.close()


app = FastAPI(title="Civic Fix API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
