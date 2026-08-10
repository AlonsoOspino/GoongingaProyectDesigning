"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Power, RefreshCw, Save } from "lucide-react";
import { announcementModes } from "@/announcements/registry";
import type { AnnouncementMode, AnnouncementSettings } from "@/announcements/types";
import { getAnnouncementSettings, updateAnnouncementSettings } from "@/lib/api/announcement";
import { readNetworkSessionToken } from "@/features/networkSession/storage";
import styles from "@/app/social-media-dashboard/social-dashboard.module.css";

export function AnnouncementModeControl() {
  const [settings, setSettings] = useState<AnnouncementSettings | null>(null);
  const [selectedMode, setSelectedMode] = useState<AnnouncementMode>("TOURNAMENT");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const token = readNetworkSessionToken();
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const next = await getAnnouncementSettings(token);
      setSettings(next);
      setSelectedMode(next.activeMode);
      setEnabled(next.enabled);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load announcement settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    const token = readNetworkSessionToken();
    if (!token) return;
    setSaving(true);
    setMessage("");
    try {
      const next = await updateAnnouncementSettings(token, { activeMode: selectedMode, enabled });
      setSettings(next);
      setMessage(enabled ? `${announcementModes.find((mode) => mode.id === selectedMode)?.title} is live.` : "Announcement area is hidden.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not publish this mode.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className={styles.controlLoading}><RefreshCw size={18} className="animate-spin" /> Loading announcement settings</div>;
  }

  return (
    <section className={styles.announcementControl}>
      <div className={styles.controlHeader}>
        <div>
          <span className={styles.kicker}>Homepage mode</span>
          <h2>Announcements</h2>
          <p>Select the module shown below the homepage hero.</p>
        </div>
        <Link href="/announcements" target="_blank" className={styles.outlineAction}>
          Open output <ExternalLink size={16} />
        </Link>
      </div>

      <div className={styles.modeOptions}>
        {announcementModes.map(({ id, title, description, icon: Icon }) => {
          const selected = selectedMode === id;
          return (
            <button
              type="button"
              key={id}
              className={`${styles.modeOption} ${selected ? styles.modeSelected : ""}`}
              onClick={() => setSelectedMode(id)}
              aria-pressed={selected}
            >
              <span className={styles.modeIcon}><Icon size={22} /></span>
              <span><strong>{title}</strong><small>{description}</small></span>
              {selected ? <Check size={19} className={styles.modeCheck} /> : null}
            </button>
          );
        })}
      </div>

      <div className={styles.controlFooter}>
        <button
          type="button"
          className={`${styles.visibilityToggle} ${enabled ? styles.toggleEnabled : ""}`}
          onClick={() => setEnabled((value) => !value)}
          role="switch"
          aria-checked={enabled}
        >
          <Power size={17} /> {enabled ? "Visible on homepage" : "Hidden from homepage"}
        </button>
        <div className={styles.publishArea}>
          {message ? <span className={styles.saveMessage} aria-live="polite">{message}</span> : null}
          <button type="button" className={styles.publishButton} onClick={save} disabled={saving}>
            {saving ? <RefreshCw size={17} className="animate-spin" /> : <Save size={17} />}
            {saving ? "Publishing" : "Publish mode"}
          </button>
        </div>
      </div>

      {settings ? <p className={styles.lastUpdated}>Current output: {settings.activeMode === "TOURNAMENT" ? "Tournament" : "Jeopardy Minigame"}</p> : null}
    </section>
  );
}
