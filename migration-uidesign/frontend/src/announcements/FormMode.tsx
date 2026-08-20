import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import type { EditorProps, ViewProps } from "@/announcements/templateTypes";
import type { FormContent } from "@/announcements/types";
import {
  AnnouncementCountdown,
  isAnnouncementCountdownExpired,
} from "@/announcements/AnnouncementCountdown";
import styles from "@/announcements/announcements.module.css";
import studio from "@/announcements/studio.module.css";
export function FormEditor({ content, onChange }: EditorProps) {
  const value = content as FormContent;
  const set = (next: Partial<FormContent>) => onChange({ ...value, ...next });

  return (
    <div className={studio.fields}>
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
        <span>What the form is for</span>
        <textarea
          value={value.body}
          maxLength={600}
          onChange={(event) => set({ body: event.target.value })}
        />
      </label>
      <label className={studio.field}>
        <span>Form URL</span>
        <input
          required
          value={value.formUrl}
          onChange={(event) => set({ formUrl: event.target.value })}
        />
      </label>
      <label className={studio.field}>
        <span>Button label</span>
        <input
          value={value.ctaLabel}
          maxLength={40}
          onChange={(event) => set({ ctaLabel: event.target.value })}
        />
      </label>
    </div>
  );
}

export function FormMode({
  content: rawContent,
  countdownAt,
  now,
  standalone = false,
  secondary = false,
}: ViewProps) {
  const content = rawContent as FormContent;
  const expired = isAnnouncementCountdownExpired(countdownAt, now);

  return (
    <section
      className={`${styles.announcement} ${standalone ? styles.standalone : ""} ${secondary ? styles.secondaryAnnouncement : ""}`}
    >
      <div className={styles.inner}>
        <div className={styles.modeLabel}>
          <ClipboardList size={16} /> GGL form
        </div>
        <div className={styles.panelContent}>
          <div>
            <h2>{content.headline || "GGL form"}</h2>
            {content.body ? <p>{content.body}</p> : null}
          </div>
          <div className={styles.panelActions}>
            <AnnouncementCountdown
              target={countdownAt}
              now={now}
              expiredFallback={
                <p className={styles.closedNotice}>Form closed</p>
              }
            />
            {content.formUrl && !expired ? (
              <Link href={content.formUrl} className={styles.panelLink}>
                {content.ctaLabel || "Open form"} <ArrowRight size={18} />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
