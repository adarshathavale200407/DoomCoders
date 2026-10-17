from fastapi import APIRouter, Depends, HTTPException

from deps import current_user, get_db
from models import LoginIn, RegisterIn
from security import create_token, hash_password, verify_password
from serializers import public_user
from utils import utcnow

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
async def register(body: RegisterIn, db=Depends(get_db)):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already registered")
    doc = {
        "name": body.name.strip(),
        "email": email,
        "password_hash": hash_password(body.password),
        "role": "citizen",
        "team": None,
        "created_at": utcnow(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"token": create_token(str(res.inserted_id), "citizen"), "user": public_user(doc)}


@router.post("/login")
async def login(body: LoginIn, db=Depends(get_db)):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"token": create_token(str(user["_id"]), user["role"]), "user": public_user(user)}
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if user.get("banned"):
        raise HTTPException(status_code=403, detail="Your account has been suspended")


@router.get("/me")
async def me(user=Depends(current_user)):
    return public_user(user)
