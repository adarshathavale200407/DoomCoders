import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from security import decode_token
from utils import to_oid

bearer = HTTPBearer(auto_error=False)


def get_db(request: Request):
    db = request.app.state.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured")
    return db


async def current_user_optional(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db=Depends(get_db),
):
    if creds is None:
        return None
    try:
        payload = decode_token(creds.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"_id": to_oid(payload["sub"], "User")})
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user

    if user.get("banned"):
        raise HTTPException(status_code=403, detail="Your account has been suspended")
    return user


async def current_user(user=Depends(current_user_optional)):
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Login required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_roles(*roles: str):
    async def dependency(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="You are not allowed to do this")
        return user

    return dependency

require_admin = require_roles("admin")