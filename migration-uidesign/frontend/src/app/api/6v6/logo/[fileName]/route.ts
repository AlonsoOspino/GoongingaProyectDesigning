import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { tournamentMediaDir } from "@/lib/6v6Server";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ fileName: string }> }) {
  const { fileName } = await context.params;
  if (!/^6v6-logo-[a-f\d-]{36}\.webp$/.test(fileName)) return new NextResponse(null, { status: 404 });
  try {
    const image = await readFile(path.join(tournamentMediaDir, fileName));
    return new NextResponse(image, { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
