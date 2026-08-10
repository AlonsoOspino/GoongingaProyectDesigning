"use client";

import { useEffect, useState } from "react";
import { getActiveAnnouncement } from "@/lib/api/announcement";
import type { ActiveAnnouncement, JeopardyAnnouncementPayload, TournamentAnnouncementPayload } from "@/announcements/types";
import { TournamentMode } from "@/announcements/TournamentMode";
import { JeopardyMode } from "@/announcements/JeopardyMode";
import styles from "@/announcements/announcements.module.css";

export function AnnouncementRenderer({ standalone = false }: { standalone?: boolean }) {
  const [announcement, setAnnouncement] = useState<ActiveAnnouncement | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;
    const load = () => getActiveAnnouncement().then((data) => { if (mounted) setAnnouncement(data); }).catch(() => undefined);
    void load();
    const poll = window.setInterval(load, 12000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { mounted = false; window.clearInterval(poll); window.clearInterval(clock); };
  }, []);

  if (!announcement) return standalone ? <div className={styles.loading}>Loading announcement mode...</div> : null;
  if (!announcement.enabled) return standalone ? <div className={styles.loading}>Announcement modes are currently disabled.</div> : null;

  if (announcement.mode === "JEOPARDY") {
    return <JeopardyMode payload={announcement.payload as JeopardyAnnouncementPayload} standalone={standalone} />;
  }
  return <TournamentMode payload={announcement.payload as TournamentAnnouncementPayload} now={now} standalone={standalone} />;
}
