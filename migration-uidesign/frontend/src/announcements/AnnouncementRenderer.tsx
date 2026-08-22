"use client";
import { useEffect, useState } from "react";
import { getActiveAnnouncements } from "@/lib/api/announcement";
import { getAnnouncementTemplate } from "@/announcements/registry";
import type { ActiveAnnouncements } from "@/announcements/types";
import styles from "@/announcements/announcements.module.css";

export function AnnouncementRenderer({
  standalone = false,
  limit,
}: {
  standalone?: boolean;
  limit?: number;
}) {
  const [state, setState] = useState<ActiveAnnouncements | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let mounted = true;
    const load = () =>
      getActiveAnnouncements()
        .then((next) => {
          if (mounted) setState(next);
        })
        .catch(() => undefined);
    void load();
    const poll = window.setInterval(load, 12000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted = false;
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, []);
  if (!state)
    return standalone ? (
      <div className={styles.loading}>Loading announcements...</div>
    ) : null;
  if (!state.enabled || state.announcements.length === 0)
    return standalone ? (
      <div className={styles.loading}>No active league announcements.</div>
    ) : null;
  const announcements =
    typeof limit === "number"
      ? state.announcements.slice(0, Math.max(0, limit))
      : state.announcements;
  return (
    <div className={styles.announcementList}>
      {announcements.map((announcement, index) => {
        const { View } = getAnnouncementTemplate(announcement.type);
        return (
          <View
            key={announcement.id}
            content={announcement.content}
            payload={announcement.payload}
            countdownAt={announcement.countdownAt}
            now={now}
            standalone={standalone && index === 0}
            secondary={index > 0}
          />
        );
      })}
    </div>
  );
}
