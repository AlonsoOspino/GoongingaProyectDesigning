"use client";

import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/api/client";
import { saveNetworkToken } from "@/lib/networkSession";

export default function LoginPage() {
  const [message, setMessage] = useState("Connecting your Discord account...");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get("network_token");
    const error = new URLSearchParams(window.location.search).get("discord_error");
    if (token) {
      if (saveNetworkToken(token)) {
        window.history.replaceState({}, "", "/login");
        window.location.replace("/");
        return;
      }
      setMessage("The Discord session could not be verified. Please sign in again.");
    } else if (error) {
      setMessage(error);
    } else {
      setMessage("Use the Discord account linked to the Goonginga server.");
    }
  }, []);

  const startSignIn = () => {
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.assign(`${getApiBase()}/network-auth/discord?return_to=${returnTo}`);
  };

  return (
    <section className="staff-only">
      <p className="eyebrow">Goonginga account</p>
      <h1 className="font-display">Sign in with Discord</h1>
      <p>{message}</p>
      <button className="primary-button" onClick={startSignIn}>Continue with Discord</button>
    </section>
  );
}
