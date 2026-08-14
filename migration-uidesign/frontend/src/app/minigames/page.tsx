import { redirect } from "next/navigation";

export default function LegacyMinigamesRoute() {
  const gameNightsOrigin = (process.env.NEXT_PUBLIC_MINIGAMES_FRONTEND_URL || "http://localhost:3001").replace(/\/$/, "");
  redirect(`${gameNightsOrigin}/feud`);
}
