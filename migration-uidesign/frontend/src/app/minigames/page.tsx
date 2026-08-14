"use client";

import { useEffect } from "react";
import { readNetworkSessionToken } from "@/features/networkSession/storage";

function safeGameNightsPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/feud";
}

export default function GameNightsHandoffPage() {
  useEffect(() => {
    const gameNightsOrigin = (process.env.NEXT_PUBLIC_MINIGAMES_FRONTEND_URL || "http://localhost:3001").replace(/\/$/, "");
    const params = new URLSearchParams(window.location.search);
    const nextPath = safeGameNightsPath(params.get("next"));
    const token = readNetworkSessionToken();

    if (!token) {
      const returnPath = `/minigames?next=${encodeURIComponent(nextPath)}`;
      window.location.replace(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }

    const destination = `${gameNightsOrigin}/auth/handoff?next=${encodeURIComponent(nextPath)}`;
    window.location.replace(`${destination}#network_token=${encodeURIComponent(token)}`);
  }, []);

  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
      <div>
        <p style={{ margin: 0, opacity: 0.7 }}>Goonginga</p>
        <h1 style={{ margin: "8px 0" }}>Opening Game Nights...</h1>
        <p style={{ margin: 0, opacity: 0.7 }}>Your current account will come with you.</p>
      </div>
    </main>
  );
}
