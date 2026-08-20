"use client";
import Link from "next/link";
import { ArrowRight, Gamepad2, Radio } from "lucide-react";
import type { EditorProps, ViewProps } from "@/announcements/templateTypes";
import type { MinigameContent, MinigamePayload } from "@/announcements/types";
import { AnnouncementCountdown } from "@/announcements/AnnouncementCountdown";
import styles from "@/announcements/announcements.module.css";
import studio from "@/announcements/studio.module.css";
export function MinigameEditor({ content, onChange }: EditorProps) {
  const value = content as MinigameContent;

  return (
    <div className={studio.fields}>
      <label className={studio.field}>
        <span>Minigame slug</span>
        <input
          required
          value={value.minigameSlug}
          onChange={(event) =>
            onChange({ ...value, minigameSlug: event.target.value })
          }
        />
      </label>
      <label className={studio.field}>
        <span>Button label</span>
        <input
          value={value.ctaLabel}
          maxLength={40}
          onChange={(event) =>
            onChange({ ...value, ctaLabel: event.target.value })
          }
        />
      </label>
    </div>
  );
}

export function MinigameMode({
  content: rawContent,
  payload: rawPayload,
  countdownAt,
  now,
  standalone = false,
  secondary = false,
}: ViewProps) {
  const content = rawContent as MinigameContent;
  const payload = rawPayload as MinigamePayload | null;
  const game = payload?.game;

  return (
    <section
      className={`${styles.announcement} ${styles.minigame} ${standalone ? styles.standalone : ""} ${secondary ? styles.secondaryAnnouncement : ""}`}
    >
      {game?.coverImageUrl ? (
        <img className={styles.cover} src={game.coverImageUrl} alt="" />
      ) : null}
      <div className={styles.shade} />
      <div className={styles.inner}>
        <div className={styles.modeLabel}>
          <Gamepad2 size={16} /> Minigame
        </div>
        <div className={styles.panelContent}>
          <div>
            <span>
              {game && payload?.state === "LIVE" ? (
                <>
                  <Radio size={14} /> Live
                </>
              ) : (
                "Game Nights"
              )}
            </span>
            <h2>{game?.title || content.minigameSlug || "Upcoming game"}</h2>
            <p>
              {game?.description ||
                "This minigame will appear when it is available."}
            </p>
          </div>
          <div className={styles.panelActions}>
            <AnnouncementCountdown target={countdownAt} now={now} />
            <Link
              href={`/minigames?next=/${encodeURIComponent(content.minigameSlug)}`}
              className={styles.panelLink}
            >
              {content.ctaLabel || "Open minigame"} <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
