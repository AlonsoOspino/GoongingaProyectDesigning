export type BlobImageType = "logo" | "roster" | "banner" | "profile" | "map" | "hero" | "image";
export type BlobMediaType = "video" | "audio";
export type BlobUploadType = BlobImageType | BlobMediaType;

export function isManagedUploadUrl(value?: string | null) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.pathname.startsWith("/uploads/");
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

export async function uploadMediaToBlob(file: File, type: BlobMediaType, _token: string) {
  return uploadToBlob(file, type);
}

export async function deleteBlobImage(url?: string | null) {
  if (!isManagedUploadUrl(url)) return;

  const response = await fetch("/api/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || "Failed to delete old upload");
  }
}

export async function deleteReplacedBlobImage(previousUrl?: string | null, nextUrl?: string | null) {
  if (!previousUrl || previousUrl === nextUrl) return;
  await deleteBlobImage(previousUrl);
}
