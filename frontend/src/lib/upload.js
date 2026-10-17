// Photo upload. Uses Cloudinary when VITE_CLOUDINARY_* are set, otherwise the
// built-in backend endpoint (POST /uploads, stored in MongoDB). Either way the
// result is a URL that gets saved on the issue.
import { api } from "./api.js";

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const uploadConfigured = true;

async function uploadToCloudinary(file) {
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", PRESET);
  body.append("folder", "civicfix");

  let res;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: "POST", body });
  } catch {
    throw new Error("Photo upload failed. Check your connection.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.secure_url) {
    throw new Error(data?.error?.message || "Photo upload failed.");
  }
  return data.secure_url;
}

export async function uploadPhoto(file) {
  if (CLOUD && PRESET) return uploadToCloudinary(file);
  const body = new FormData();
  body.append("file", file);
  const data = await api.post("/uploads", body);
  return data.url;
}
