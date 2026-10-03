import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { authorizeTournamentEditor, tournamentMediaDir } from "@/lib/6v6Server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!await authorizeTournamentEditor(request.headers.get("authorization") || "")) {
    return NextResponse.json({ error: "Inicia sesión con acceso de producción." }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 5_000_000 || file.size === 0) {
    return NextResponse.json({ error: "Usa PNG, JPG o WebP de hasta 5 MB." }, { status: 400 });
  }
  try {
    const image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 16_000_000 })
      .resize(320, 320, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .webp({ quality: 85 }).toBuffer();
    const fileName = `6v6-logo-${randomUUID()}.webp`;
    await mkdir(tournamentMediaDir, { recursive: true });
    await writeFile(`${tournamentMediaDir}/${fileName}`, image, { flag: "wx" });
    return NextResponse.json({ url: `/api/6v6/logo/${fileName}` });
  } catch {
    return NextResponse.json({ error: "No se pudo procesar el logo." }, { status: 400 });
  }
}
