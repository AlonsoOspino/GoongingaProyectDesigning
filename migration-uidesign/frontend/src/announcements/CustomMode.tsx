import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import type { EditorProps, ViewProps } from "@/announcements/templateTypes";
import type { CustomContent } from "@/announcements/types";
import { AnnouncementCountdown } from "@/announcements/AnnouncementCountdown";
import { ImageField } from "@/announcements/ImageField";
import styles from "@/announcements/announcements.module.css";
import studio from "@/announcements/studio.module.css";
export function CustomEditor({ content, onChange }: EditorProps) {
  const value = content as CustomContent;
  const set = (next: Partial<CustomContent>) => onChange({ ...value, ...next });

  return (
    <div className={studio.fields}>
      <label className={studio.field}>
        <span>Label</span>
        <input
          value={value.eyebrow}
          maxLength={60}
          onChange={(event) => set({ eyebrow: event.target.value })}
        />
      </label>
      <label className={studio.field}>
        <span>Headline</span>
        <input
          required
          value={value.headline}
          maxLength={120}
          onChange={(event) => set({ headline: event.target.value })}
        />
      </label>
      <label className={studio.field}>
        <span>Body</span>
        <textarea
          value={value.body}
          maxLength={600}
          onChange={(event) => set({ body: event.target.value })}
        />
      </label>
      <ImageField
        value={value.imageUrl}
        name={value.headline}
        onChange={(imageUrl) => set({ imageUrl })}
      />
      <label className={studio.field}>
        <span>Button label</span>
        <input
          value={value.ctaLabel}
          maxLength={40}
          onChange={(event) => set({ ctaLabel: event.target.value })}
        />
      </label>
      <label className={studio.field}>
        <span>Destination URL or internal route</span>
        <input
          value={value.ctaHref}
          onChange={(event) => set({ ctaHref: event.target.value })}
        />
      </label>
    </div>
  );
}

export function CustomMode({
  content: rawContent,
  countdownAt,
  now,
  standalone = false,
  secondary = false,
}: ViewProps) {
  const content = rawContent as CustomContent;

  return (
    <section
      className={`${styles.announcement} ${standalone ? styles.standalone : ""} ${secondary ? styles.secondaryAnnouncement : ""}`}
    >
      {content.imageUrl ? (
        <img className={styles.cover} src={content.imageUrl} alt="" />
      ) : null}
      <div className={styles.shade} />
      <div className={styles.inner}>
        <div className={styles.modeLabel}>
          <Megaphone size={16} />
          {content.eyebrow || "Announcement"}
        </div>
        <div className={styles.panelContent}>
          <div>
            <h2>{content.headline || "New announcement"}</h2>
            {content.body ? <p>{content.body}</p> : null}
          </div>
          <div className={styles.panelActions}>
            <AnnouncementCountdown target={countdownAt} now={now} />
            {content.ctaHref ? (
              <Link href={content.ctaHref} className={styles.panelLink}>
                {content.ctaLabel || "Learn more"} <ArrowRight size={18} />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
