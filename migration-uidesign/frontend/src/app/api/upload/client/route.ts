import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");

type MediaType = "video" | "audio";
type MediaRule = { allowedContentTypes: string[]; maximumSizeInBytes: number };

const MEDIA_RULES: Record<MediaType, MediaRule> = {
  video: {
    allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime"],
    maximumSizeInBytes: 100 * 1024 * 1024,
  },
  audio: {
    allowedContentTypes: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/aac"],
    maximumSizeInBytes: 25 * 1024 * 1024,
  },
};

function getMediaType(clientPayload: string | null): MediaType {
  try {
    const payload = JSON.parse(clientPayload || "{}") as { type?: unknown };
    if (payload.type === "video" || payload.type === "audio") return payload.type;
  } catch {
    // The generic error below avoids exposing token-generation details.
  }
  throw new Error("Unsupported media upload.");
}

async function requireWrappedManager(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json({ error: "Sign in as a manager or admin to upload media." }, { status: 401 });
  }

  const response = await fetch(`${API_BASE}/wrapped/manage`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  if (response.ok) return null;

  return NextResponse.json(
    { error: response.status === 403 ? "Managers and admins only." : "Your session is no longer valid." },
    { status: response.status === 403 ? 403 : 401 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as HandleUploadBody;

    // Blob calls this route again after a successful upload. Only the token
    // generation event originates in the dashboard and needs user validation.
    if (body.type === "blob.generate-client-token") {
      const denied = await requireWrappedManager(request);
      if (denied) return denied;
    }

    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const type = getMediaType(clientPayload);
        if (!pathname.startsWith(`wrapped/${type}/`)) {
          throw new Error("Invalid media upload path.");
        }

        return {
          ...MEDIA_RULES[type],
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Direct media upload token error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start media upload." },
      { status: 400 }
    );
  }
}
