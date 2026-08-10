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
  return [[days, "Days"], [hours, "Hours"], [minutes, "Minutes"], [seconds, "Seconds"]] as const;
}

export function AnnouncementCountdown({ target, now }: { target?: string | null; now: number }) {
  const time = countdown(target, now);
  if (!time) return null;
  return (
    <div className={styles.countdown} aria-label="Announcement countdown">
      {time.map(([value, label]) => <div key={label}><strong>{String(value).padStart(2, "0")}</strong><span>{label}</span></div>)}
    </div>
  );
}
