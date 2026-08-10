"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";
import { getDiscordLoginUrl } from "@/lib/api/networkMember";
import { saveNetworkToken } from "@/features/networkSession/storage";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedPath = searchParams.get("next") || "/";
  const nextPath = requestedPath.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/";

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = new URLSearchParams(url.hash.slice(1)).get("network_token");
    const discordError = url.searchParams.get("discord_error");

    if (token) {
      const user = saveNetworkToken(token);
      url.hash = "";
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      if (user) {
        setMessage(`Connected as ${user.username}.`);
        window.location.replace(nextPath);
        return;
      }
    }
    if (discordError) {
      setError(discordError);
      url.searchParams.delete("discord_error");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
  }, [nextPath, router]);

  return (
    <div className="login-page">
      <div className="login-stage">
        <div className="login-art" aria-hidden="true" />
        <div className="login-content">
          <div className="login-copy">
            <Link href="/" className="login-back"><ArrowLeft size={17} /> Back</Link>
            <div className="login-heading"><span className="ow-eyebrow"></span><h1 className="display-title">Register for Goonginga</h1></div>
            <p>Use Discord to create or access your Goonginga Network Member profile.</p>

            {message && <div className="login-notice flex items-center gap-2"><CheckCircle2 size={17} className="text-[#72d39d]" />{message}</div>}
            {error && <div className="login-notice !border-danger text-[#ffd5d5]">{error}</div>}

            <button type="button" className="discord-action" onClick={() => window.location.assign(getDiscordLoginUrl())}>
              <MessageCircle size={22} /> Continue with Discord
            </button>
            <div className="login-notice flex items-start gap-2"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#9ce5f3]" /><span>You must be a member of the GGL Discord server. No separate password is stored by Goonginga.</span></div>
            <p className="login-server-link">Not in the server? <a href="https://discord.gg/QMukTWr32f">Join GGL on Discord</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
