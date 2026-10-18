import { NextResponse } from "next/server";
import { createTwitchClipFeed } from "@/lib/twitch/clips";
import { TWITCH_CHANNEL } from "@/components/landing/brandAssets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getClips = createTwitchClipFeed({
  channel: TWITCH_CHANNEL,
  clientId: process.env.TWITCH_CLIENT_ID,
  clientSecret: process.env.TWITCH_CLIENT_SECRET,
});

export async function GET() {
  try {
    const result = await getClips();
    return NextResponse.json(result, {
      headers: { "Cache-Control": result.stale ? "public, max-age=30" : "public, max-age=60" },
    });
  } catch {
    return NextResponse.json({ clips: [] }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }
}
