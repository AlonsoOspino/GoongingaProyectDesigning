import { readNetworkSessionToken } from "@/features/networkSession/storage";
import { readSessionFromStorage } from "@/features/session/storage";

export type BlobImageType = "logo" | "roster";

function uploadAuthHeaders() {
  const token = readNetworkSessionToken() || readSessionFromStorage().token;
  if (!token) throw new Error("Sign in before uploading images.");
  return { Authorization: `Bearer ${token}` };
}

export function isManagedUploadUrl(value?: string | null) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return /\/uploads\/[^/]+$/.test(url.pathname);
  } catch {
    return false;
  }
}

export async function uploadToBlob(file: File, type: BlobImageType) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const response = await fetch("/api/upload", {
    method: "POST",
    headers: uploadAuthHeaders(),
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "Upload failed");
  }

  if (!payload?.url || typeof payload.url !== "string") {
    throw new Error("Upload response did not include a URL");
  }

  return payload.url;
}

export async function uploadImageToBlob(file: File, type: BlobImageType) {
  return uploadToBlob(file, type);
}

export async function deleteBlobImage(url?: string | null) {
  if (!isManagedUploadUrl(url)) return;

  const response = await fetch("/api/upload", {
    method: "DELETE",
    headers: { ...uploadAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || "Failed to delete old upload");
  }
}
