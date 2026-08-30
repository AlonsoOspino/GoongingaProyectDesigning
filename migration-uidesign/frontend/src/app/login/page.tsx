"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, MessageCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import { getDiscordLoginUrl } from "@/lib/api/networkMember";
import { saveNetworkToken } from "@/features/networkSession/storage";
import styles from "./login.module.css";

const LOGIN_NEXT_KEY = "goonginga.network.login.next";
function rememberedNextPath() { try { return window.sessionStorage.getItem(LOGIN_NEXT_KEY); } catch { return null; } }
function rememberNextPath(path: string) { try { window.sessionStorage.setItem(LOGIN_NEXT_KEY, path); } catch { /* OAuth still works without redirect memory. */ } }
function forgetNextPath() { try { window.sessionStorage.removeItem(LOGIN_NEXT_KEY); } catch { /* Nothing to clear. */ } }

const STEPS = [
  "Authorize with the Discord account you use in the server.",
  "We read your username, avatar and server roles. Nothing else.",
  "Your profile and dashboards unlock straight away.",
];

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
    const storedPath = rememberedNextPath();
    const resolvedPath = nextPath === "/" && storedPath?.startsWith("/") && !storedPath.startsWith("//") ? storedPath : nextPath;

    if (token) {
      const user = saveNetworkToken(token);
      url.hash = "";
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      if (user) {
        forgetNextPath();
        setMessage(`Connected as ${user.username}.`);
        window.location.replace(resolvedPath);
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
    <div className={styles.page}>
      <div className={styles.field} aria-hidden />

      <div className={styles.art}>
        <img
          className={styles.artImage}
          src="/ramattra-login-cropped.webp"
          alt=""
          aria-hidden
        />
        <div className={styles.artVeil} aria-hidden />
        <div className={styles.artMark}>
          <span className={styles.artMarkLabel}>Overtime Productions</span>
          <span className={styles.artMarkText}>Registration</span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.copy}>
          <Link href="/" className={styles.back}>
            <ArrowLeft size={15} /> Back to the league
          </Link>

          <span className={styles.kicker}>Member registration</span>

          <h1 className={styles.title}>
            Join <span className={styles.titleAccent}>Overtime</span> Productions
          </h1>

          <p className={styles.lede}>
            One Discord sign-in creates your profile, links you to your team and opens whichever
            dashboards your roles allow.
          </p>

          {message && (
            <div className={`${styles.notice} ${styles.noticeGood}`}>
              <CheckCircle2 size={17} className={styles.noticeIcon} />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className={`${styles.notice} ${styles.noticeBad}`}>
              <TriangleAlert size={17} className={styles.noticeIcon} />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.steps}>
            {STEPS.map((step, index) => (
              <p key={step} className={styles.step}>
                <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
                <span>{step}</span>
              </p>
            ))}
          </div>

          <button
            type="button"
            className={styles.action}
            onClick={() => {
              rememberNextPath(nextPath);
              window.location.assign(getDiscordLoginUrl());
            }}
          >
            <MessageCircle size={20} /> Continue with Discord
          </button>

          <div className={styles.notice}>
            <ShieldCheck size={17} className={styles.noticeIcon} />
            <span>
              You must already be a member of the GGL Discord server. Overtime Productions never
              stores a separate password.
            </span>
          </div>

          <p className={styles.serverLink}>
            Not in the server yet? <a href="https://discord.gg/QMukTWr32f">Join GGL on Discord</a>
          </p>
        </div>
      </div>
    </div>
  );
}
