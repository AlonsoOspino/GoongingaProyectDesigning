import type { ReactNode } from "react";
import styles from "@/announcements/announcements.module.css";

function countdown(target: string | null | undefined, now: number) {
  if (!target) return null;
  const targetTime = new Date(target).getTime();
  if (!Number.isFinite(targetTime)) return null;
  const remaining = Math.max(0, targetTime - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return {
    expired: remaining === 0,
    units: [
      [days, "Days"],
      [hours, "Hours"],
      [minutes, "Minutes"],
      [seconds, "Seconds"],
    ] as const,
  };
}

export function isAnnouncementCountdownExpired(
  target: string | null | undefined,
  now: number,
) {
  return countdown(target, now)?.expired ?? false;
}

export function AnnouncementCountdown({
  target,
  now,
  expiredFallback,
}: {
  target?: string | null;
  now: number;
  expiredFallback?: ReactNode;
}) {
  const time = countdown(target, now);
  if (!time) return null;
  if (time.expired && expiredFallback !== undefined) return expiredFallback;

  return (
    <div className={styles.countdown} aria-label="Announcement countdown">
      {time.units.map(([value, label]) => (
        <div key={label}>
          <strong>{String(value).padStart(2, "0")}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
