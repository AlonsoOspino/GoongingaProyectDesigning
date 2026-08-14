"use client";

import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/api/client";
import { saveNetworkToken } from "@/lib/networkSession";

const LOGIN_NEXT_KEY = "goonginga.network.login.next";
function rememberedNextPath() { try { return window.sessionStorage.getItem(LOGIN_NEXT_KEY); } catch { return null; } }
function rememberNextPath(path: string) { try { window.sessionStorage.setItem(LOGIN_NEXT_KEY, path); } catch { /* OAuth still works without redirect memory. */ } }
function forgetNextPath() { try { window.sessionStorage.removeItem(LOGIN_NEXT_KEY); } catch { /* Nothing to clear. */ } }

export default function LoginPage() {
  const [message, setMessage] = useState("Checking your Goonginga account...");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get("network_token");
    const query = new URLSearchParams(window.location.search);
    const error = query.get("discord_error");
    const next = query.get("next");
    const storedNext = rememberedNextPath();
    const requestedNext = next || storedNext;
    const nextPath = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/feud";
    if (token) {
      if (saveNetworkToken(token)) {
        forgetNextPath();
        window.history.replaceState({}, "", "/login");
        window.location.replace(nextPath);
        return;
      }
      setMessage("The Discord session could not be verified. Please sign in again.");
    } else if (error) {
      setMessage(error);
    } else {
      setMessage("Use the Discord account linked to the Goonginga server.");
    }
  }, []);

  const continueWithGoonginga = () => {
    const query = new URLSearchParams(window.location.search);
    const requested = query.get("next");
    const nextPath = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/feud";
    const networkOrigin = (process.env.NEXT_PUBLIC_GOONGINGA_URL || "http://localhost:3000").replace(/\/$/, "");
    window.location.assign(`${networkOrigin}/minigames?next=${encodeURIComponent(nextPath)}`);
  };

  const startDiscordSignIn = () => {
    const query = new URLSearchParams(window.location.search);
    const requested = query.get("next");
    const nextPath = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/feud";
    rememberNextPath(nextPath);
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.assign(`${getApiBase()}/network-auth/discord?return_to=${returnTo}`);
  };

  return (
    <section className="staff-only">
      <p className="eyebrow">Goonginga account</p>
      <h1 className="font-display">Continue with your Goonginga account</h1>
      <p>{message}</p>
      <button className="primary-button" onClick={continueWithGoonginga}>Continue from Goonginga</button>
      <button className="secondary-button" onClick={startDiscordSignIn}>Sign in with Discord instead</button>
    </section>
  );
}
