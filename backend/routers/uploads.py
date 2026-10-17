"""Photo uploads stored in MongoDB, so they survive redeploys on hosts with
ephemeral disks (e.g. Render free tier). Max 5 MB per photo."""
from bson import Binary
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response

from deps import current_user, get_db
from utils import to_oid, utcnow

router = APIRouter(prefix="/uploads", tags=["uploads"])

MAX_BYTES = 5 * 1024 * 1024
# Magic-number sniffing: never trust the client-supplied content type.
SIGNATURES = [
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
]


def sniff(data: bytes) -> str | None:
    for sig, mime in SIGNATURES:
        if data.startswith(sig):
            return mime
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


@router.post("", status_code=201)
async def upload_photo(
    request: Request,
    file: UploadFile = File(...),
    db=Depends(get_db),
    user=Depends(current_user),
):
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Photo must be under 5 MB")
    mime = sniff(data)
    if mime is None:
        raise HTTPException(status_code=400, detail="Please upload a JPG, PNG, GIF or WebP image")
    res = await db.photos.insert_one(
        {"data": Binary(data), "content_type": mime, "owner_id": str(user["_id"]), "created_at": utcnow()}
    )
    base = str(request.base_url).rstrip("/")
    return {"url": f"{base}/uploads/{res.inserted_id}"}


@router.get("/{photo_id}")
async def get_photo(photo_id: str, db=Depends(get_db)):
    doc = await db.photos.find_one({"_id": to_oid(photo_id, "Photo")})
    if doc is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    return Response(
        content=bytes(doc["data"]),
        media_type=doc["content_type"],
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
