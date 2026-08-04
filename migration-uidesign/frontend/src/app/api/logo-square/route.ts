import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");

function isAllowedSource(src: URL) {
  const apiHost = API_BASE ? new URL(API_BASE).hostname : "";
  return apiHost ? src.hostname === apiHost && src.pathname.startsWith("/uploads/") : false;
}

export async function GET(request: NextRequest) {
  const sourceValue = request.nextUrl.searchParams.get("src");

  if (!sourceValue) {
    return NextResponse.json({ error: "Missing src parameter" }, { status: 400 });
  }

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(sourceValue);
  } catch {
    return NextResponse.json({ error: "Invalid src parameter" }, { status: 400 });
  }

  if (!isAllowedSource(sourceUrl)) {
    return NextResponse.json({ error: "Unsupported image source" }, { status: 400 });
  }

  const response = await fetch(sourceUrl.toString());
  if (!response.ok) {
    return NextResponse.json({ error: "Failed to load image" }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Source is not an image" }, { status: 400 });
  }

  const inputBuffer = Buffer.from(await response.arrayBuffer());
  const outputBuffer = await sharp(inputBuffer, { failOn: "none" })
    .resize({
      width: 256,
      height: 256,
      fit: "cover",
      position: "centre",
      withoutEnlargement: false,
    })
    .webp({ quality: 92 })
    .toBuffer();

  return new NextResponse(outputBuffer, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
