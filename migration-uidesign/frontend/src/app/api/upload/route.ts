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
const AUTH_API_BASE = (process.env.UPLOAD_AUTH_API_BASE_URL || API_BASE).replace(/\/$/, "");
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(process.cwd(), "uploads");
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_REQUEST_SIZE = MAX_IMAGE_SIZE + 64 * 1024;
const MAX_DECODED_PIXELS = 40_000_000;
const MIME_FORMATS: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};
const TEAM_ASSET_TYPES = new Set(["logo", "roster"]);
const ADMIN_ASSET_TYPES = new Set(["map", "hero", "hero-gift"]);
const MANAGED_FILE_NAME = /^(?:logo|roster|map|hero|hero-gift|image|banner|profile|video|audio)-\d{13}-[a-f\d-]{36}\.[a-z\d]{2,10}$/i;

interface AuthenticatedMember {
  id: number;
  roles: string[];
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

class UploadTooLargeError extends Error {}

async function readBoundedFormData(request: NextRequest) {
  const declaredSize = Number(request.headers.get("content-length"));
  if (declaredSize > MAX_REQUEST_SIZE) throw new UploadTooLargeError();
  if (!request.body) throw new Error("Missing request body.");

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REQUEST_SIZE) {
      await reader.cancel();
      throw new UploadTooLargeError();
    }
    chunks.push(Buffer.from(value));
  }
  const bufferedRequest = new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": request.headers.get("content-type") || "" },
    body: Buffer.concat(chunks),
  });
  return bufferedRequest.formData();
}

async function authenticate(request: NextRequest): Promise<AuthenticatedMember | NextResponse> {
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer [^\s]+$/.test(authorization)) {
    return jsonError("Network sign-in is required.", 401);
  }

  try {
    const response = await fetch(`${AUTH_API_BASE}/network-members/me`, {
      headers: { Authorization: authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401 || response.status === 403) {
      return jsonError("Invalid or expired network session.", 401);
    }
    if (!response.ok) return jsonError("Could not verify network session.", 503);

    const member: unknown = await response.json();
    if (
      !member ||
      typeof member !== "object" ||
      !Number.isInteger((member as AuthenticatedMember).id) ||
      !Array.isArray((member as AuthenticatedMember).roles) ||
      !(member as AuthenticatedMember).roles.every((role) => typeof role === "string")
    ) {
      return jsonError("Could not verify network session.", 503);
    }
    return member as AuthenticatedMember;
  } catch (error) {
    console.error("Upload authentication failed:", error);
    return jsonError("Could not verify network session.", 503);
  }
}

async function canUpload(type: string, member: AuthenticatedMember, authorization: string) {
  if (ADMIN_ASSET_TYPES.has(type)) return member.roles.includes("ADMIN");
  if (!TEAM_ASSET_TYPES.has(type)) return false;
  if (member.roles.includes("ADMIN") || member.roles.includes("DEVELOPER")) return true;

  try {
    const response = await fetch(`${AUTH_API_BASE}/network-members/me/capabilities`, {
      headers: { Authorization: authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const capabilities: unknown = await response.json();
    return !!capabilities && typeof capabilities === "object" &&
      (capabilities as { isCaptain?: unknown }).isCaptain === true;
  } catch (error) {
    console.error("Upload captain check failed:", error);
    return false;
  }
}

function storedFileName(urlValue: string) {
  try {
    const url = new URL(urlValue);
    const apiUrl = new URL(API_BASE);
    const uploadPrefix = `${apiUrl.pathname.replace(/\/$/, "")}/uploads/`;
    if (url.origin !== apiUrl.origin || url.search || url.hash || !url.pathname.startsWith(uploadPrefix)) return null;
    const encodedName = url.pathname.slice(uploadPrefix.length);
    const fileName = decodeURIComponent(encodedName);
    if (!MANAGED_FILE_NAME.test(fileName)) return null;
    if (encodeURIComponent(fileName) !== encodedName) return null;
    return fileName;
  } catch {
    return null;
  }
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
  const member = await authenticate(request);
  if (member instanceof NextResponse) return member;
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return jsonError("Upload files as multipart form data.", 400);
  }

  try {
    const formData = await readBoundedFormData(request);
    const submittedFile = formData.get("file");
    const type = formData.get("type");
    if (typeof type !== "string" || !(TEAM_ASSET_TYPES.has(type) || ADMIN_ASSET_TYPES.has(type))) {
      return jsonError("Unsupported upload type.", 400);
    }
    if (!await canUpload(type, member, request.headers.get("authorization") || "")) {
      return jsonError("You do not have permission to upload this asset.", 403);
    }
    if (!(submittedFile instanceof File)) return jsonError("No file provided.", 400);
    if (!MIME_FORMATS[submittedFile.type]) return jsonError("Unsupported file type.", 400);
    if (submittedFile.size === 0 || submittedFile.size > MAX_IMAGE_SIZE) {
      return jsonError("File exceeds the permitted image size or is empty.", 400);
    }

    const input = Buffer.from(await submittedFile.arrayBuffer());
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(input, { limitInputPixels: MAX_DECODED_PIXELS }).metadata();
    } catch {
      return jsonError("Invalid image content.", 400);
    }
    if (metadata.format !== MIME_FORMATS[submittedFile.type]) {
      return jsonError("Image content does not match its file type.", 400);
    }
    const decodedPixels = (metadata.width || 0) * (metadata.height || 0) * (metadata.pages || 1);
    if (decodedPixels === 0 || decodedPixels > MAX_DECODED_PIXELS) {
      return jsonError("Image dimensions exceed the permitted limit.", 400);
    }

    let output = input;
    let extension = MIME_EXTENSIONS[submittedFile.type];
    if (type === "logo") {
      output = await sharp(input, { limitInputPixels: MAX_DECODED_PIXELS })
        .resize({ width: 1024, height: 1024, fit: "cover", position: "centre" })
        .webp({ quality: 92 })
        .toBuffer();
      extension = ".webp";
    }
    if (output.length > MAX_IMAGE_SIZE) return jsonError("Processed image exceeds the permitted size.", 400);

    const fileName = `${type}-${Date.now()}-${randomUUID()}${extension}`;
    await mkdir(MEDIA_DIR, { recursive: true });
    await writeFile(path.join(MEDIA_DIR, fileName), output, { flag: "wx" });
    return NextResponse.json({ url: `${API_BASE}/uploads/${encodeURIComponent(fileName)}` });
  } catch (error) {
    if (error instanceof UploadTooLargeError) return jsonError("Upload request is too large.", 413);
    if (error instanceof TypeError) return jsonError("Invalid multipart upload.", 400);
    console.error("Upload error:", error);
    return jsonError("Upload failed.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const member = await authenticate(request);
  if (member instanceof NextResponse) return member;
  if (!member.roles.includes("ADMIN") && !member.roles.includes("DEVELOPER")) {
    return jsonError("You do not have permission to delete uploads.", 403);
  }

  try {
    const body: unknown = await request.json();
    const url = body && typeof body === "object" ? (body as { url?: unknown }).url : null;
    if (typeof url !== "string" || !storedFileName(url)) return jsonError("Invalid upload URL.", 400);
    return NextResponse.json({ success: true, deleted: await deleteStoredFile(url) });
  } catch (error) {
    console.error("Upload delete error:", error);
    return jsonError("Delete failed.", 500);
  }
}
