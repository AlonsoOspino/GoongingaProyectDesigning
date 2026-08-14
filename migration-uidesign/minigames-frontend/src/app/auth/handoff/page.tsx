"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { saveNetworkToken } from "@/lib/networkSession";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/feud";
}

export default function AccountHandoffPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("network_token");
    const nextPath = safeNextPath(new URLSearchParams(window.location.search).get("next"));

    window.history.replaceState({}, "", `/auth/handoff?next=${encodeURIComponent(nextPath)}`);
    if (token && saveNetworkToken(token)) {
      window.location.replace(nextPath);
      return;
    }
    setFailed(true);
  }, []);

  return (
    <main className="handoff-page">
      <section className="handoff-card" aria-live="polite">
        <p className="eyebrow">Goonginga account</p>
        <h1>{failed ? "We could not connect your account" : "Opening Game Nights..."}</h1>
        <p>{failed ? "The sign-in link was invalid or expired. Return to Goonginga and try again." : "Your signed-in account is being transferred securely."}</p>
        {failed ? <Link className="primary-button" href="/login?next=/feud">Try again</Link> : null}
      </section>
    </main>
  );
}
