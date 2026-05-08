export type BlobImageType = "logo" | "roster" | "banner" | "profile" | "map" | "hero" | "image";

export function isVercelBlobUrl(value?: string | null) {
  if (!value) return false;

  try {
    return new URL(value).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function uploadImageToBlob(file: File, type: BlobImageType) {
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
