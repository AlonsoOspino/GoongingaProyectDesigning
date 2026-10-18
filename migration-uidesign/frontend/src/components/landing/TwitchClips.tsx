"use client";

import { useEffect, useRef, useState } from "react";
import type { TwitchClip, TwitchClipResponse } from "@/lib/twitch/types";
import { TWITCH_CHANNEL, TWITCH_URL, TwitchIcon, ArrowIcon } from "./brandAssets";
import styles from "./twitch-clips.module.css";

export default function TwitchClips() {
  const host = useRef<HTMLDivElement>(null);
  const [clips, setClips] = useState<TwitchClip[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [parent, setParent] = useState("");
  const [visible, setVisible] = useState(false);
  const [wide, setWide] = useState(false);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const clip = clips[index];

  useEffect(() => {
    const controller = new AbortController();
    setParent(window.location.hostname);
    setPaused(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    fetch("/api/twitch/clips", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Clips unavailable");
        return response.json() as Promise<TwitchClipResponse>;
      })
      .then(({ clips: next }) => {
        if (controller.signal.aborted) return;
        setClips(next);
        setIndex(Math.floor(Math.random() * Math.max(1, next.length)));
      })
      .catch(() => undefined)
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.3 });
    // Twitch requires a 400px-wide player. Smaller screens get a clip preview.
    const resize = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= 400));
    const onVisibility = () => setTabVisible(!document.hidden);
    onVisibility();
    observer.observe(element);
    resize.observe(element);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!clip || clips.length < 2 || !visible || !tabVisible || paused || interacting) return;
    // Clips have no supported ended event; leave a buffer for player startup.
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % clips.length),
      (Math.max(20, clip.duration) + 8) * 1000);
    return () => window.clearTimeout(timer);
  }, [clip, clips.length, visible, tabVisible, paused, interacting]);

  const embed = clip && parent
    ? `https://clips.twitch.tv/embed?${new URLSearchParams({ clip: clip.id, parent, autoplay: "true", muted: "true" })}`
    : "";

  return (
    <div ref={host} className={styles.clips} aria-label="Clips from Overtime Productions">
      <div className={styles.player}
        onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
        onFocusCapture={() => setInteracting(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false); }}>
        {clip && embed && wide && visible && tabVisible ? (
          <iframe key={clip.id} src={embed} title={clip.title} allow="autoplay; fullscreen" allowFullScreen />
        ) : (
          <a className={`${styles.preview} ${!clip ? styles.channelPreview : ""}`}
            href={clip ? `https://clips.twitch.tv/${encodeURIComponent(clip.id)}` : `${TWITCH_URL}/clips?filter=clips&range=all`}
            target="_blank" rel="noopener noreferrer" aria-label={clip ? `Watch ${clip.title} on Twitch` : "Watch our clips on Twitch"}>
            {clip ? <img src={clip.thumbnail} alt="" loading="lazy" /> : (
              <span className={styles.channelIdentity}>
                <TwitchIcon />
                <span className={styles.channelName}>{TWITCH_CHANNEL}</span>
                <span className={styles.channelDescription}>Tournaments and game nights.</span>
              </span>
            )}
            <span className={styles.previewLabel}>
              {loading ? "Loading clips…" : clip ? "Watch on Twitch" : "Watch our clips on Twitch"}
              <ArrowIcon />
            </span>
          </a>
        )}
      </div>
      {clip ? (
        <div className={styles.caption}>
          <div className={styles.details}>
            <a href={`https://clips.twitch.tv/${encodeURIComponent(clip.id)}`} target="_blank" rel="noopener noreferrer" className={styles.clipTitle}>{clip.title}</a>
            <span className={styles.views}>{clip.views.toLocaleString("en-US")} views</span>
          </div>
          <div className={styles.controls} aria-label="Clip rotation controls">
            <button type="button" aria-label="Previous clip" onClick={() => setIndex((index + clips.length - 1) % clips.length)}>←</button>
            <span className={styles.count}>{index + 1} / {clips.length}</span>
            <button type="button" aria-label="Next clip" onClick={() => setIndex((index + 1) % clips.length)}>→</button>
            {clips.length > 1 ? <button type="button" aria-label={paused ? "Resume clip rotation" : "Pause clip rotation"} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "▶" : "Ⅱ"}</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
