import { upload } from "@vercel/blob/client";

export type BlobImageType = "logo" | "roster" | "banner" | "profile" | "map" | "hero" | "image";
export type BlobMediaType = "video" | "audio";
export type BlobUploadType = BlobImageType | BlobMediaType;

export function isVercelBlobUrl(value?: string | null) {
  if (!value) return false;

  try {
    return new URL(value).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function uploadToBlob(file: File, type: BlobUploadType) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const response = await fetch("/api/upload", {
    method: "POST",
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

export async function uploadMediaToBlob(file: File, type: BlobMediaType, token: string) {
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || (type === "video" ? "mp4" : "mp3");
  const basename = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || type;

  const blob = await upload(`wrapped/${type}/${Date.now()}-${basename}.${extension}`, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    clientPayload: JSON.stringify({ type }),
    headers: { Authorization: `Bearer ${token}` },
    // Sends the bytes from the browser directly to Blob, avoiding the platform
    // request-body limit that returns HTTP 413 for cinematic video files.
    multipart: file.size > 5 * 1024 * 1024,
  });

  return blob.url;
}

export async function deleteBlobImage(url?: string | null) {
  if (!isVercelBlobUrl(url)) return;

  const response = await fetch("/api/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || "Failed to delete old image");
  }
}

export async function deleteReplacedBlobImage(previousUrl?: string | null, nextUrl?: string | null) {
  if (!previousUrl || previousUrl === nextUrl) return;
  await deleteBlobImage(previousUrl);
}
