import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(process.cwd(), "uploads");

type MediaType = "video" | "audio";

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "image";
}

function isManagedUploadUrl(value: string) {
  try {
    const url = new URL(value);
    const apiUrl = new URL(API_BASE);
    return url.origin === apiUrl.origin && url.pathname.startsWith("/uploads/");
  } catch {
    return false;
  }
}

function storedFileName(urlValue: string) {
  if (!isManagedUploadUrl(urlValue)) return null;
  const fileName = path.basename(new URL(urlValue).pathname);
  return fileName && fileName === path.basename(fileName) ? fileName : null;
}

async function normalizeLogoFile(file: File) {
  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const outputBuffer = await sharp(inputBuffer, { failOn: "none" })
    .resize({ width: 1024, height: 1024, fit: "cover", position: "centre" })
    .webp({ quality: 92 })
    .toBuffer();

  const baseName = file.name.replace(/\.[^.]+$/, "") || "logo";
  return new File([outputBuffer], `${baseName}.webp`, { type: "image/webp" });
}

function allowedFileTypes(type: string) {
  if (type === "video") return ["video/mp4", "video/webm", "video/quicktime"];
  if (type === "audio") return ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/aac"];
  return ["image/jpeg", "image/png", "image/gif", "image/webp"];
}

function maxFileSize(type: string) {
  if (type === "video") return 100 * 1024 * 1024;
  if (type === "audio") return 25 * 1024 * 1024;
  return 5 * 1024 * 1024;
}

function extensionFor(file: File) {
  const extension = path.extname(file.name).replace(/[^a-z0-9.]/gi, "").toLowerCase();
  if (extension) return extension.slice(0, 12);
  const fallback = file.type.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
  return `.${fallback.slice(0, 10)}`;
}

async function deleteStoredFile(urlValue: string) {
  const fileName = storedFileName(urlValue);
  if (!fileName) return false;

  try {
    await unlink(path.join(MEDIA_DIR, fileName));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Upload files as multipart form data." }, { status: 400 });
    }

    const formData = await request.formData();
    const submittedFile = formData.get("file");
    const type = String(formData.get("type") || "image");
    const previousUrl = String(formData.get("previousUrl") || "");

    if (!(submittedFile instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (!allowedFileTypes(type).includes(submittedFile.type)) {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
    }

    if (submittedFile.size > maxFileSize(type)) {
      return NextResponse.json({ error: "File exceeds the permitted size for this media type." }, { status: 400 });
    }

    const uploadFile = type === "logo" ? await normalizeLogoFile(submittedFile) : submittedFile;
    const fileName = `${sanitizeSegment(type)}-${Date.now()}-${randomUUID()}${extensionFor(uploadFile)}`;

    await mkdir(MEDIA_DIR, { recursive: true });
    await writeFile(path.join(MEDIA_DIR, fileName), Buffer.from(await uploadFile.arrayBuffer()));

    const url = `${API_BASE}/uploads/${encodeURIComponent(fileName)}`;
    if (previousUrl && previousUrl !== url) {
      await deleteStoredFile(previousUrl).catch((error) => console.warn("Old local upload delete failed:", error));
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "No URL provided." }, { status: 400 });
    }

    return NextResponse.json({ success: true, deleted: await deleteStoredFile(url) });
  } catch (error) {
    console.error("Upload delete error:", error);
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
