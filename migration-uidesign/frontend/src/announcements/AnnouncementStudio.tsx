"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  Plus,
  Power,
  RefreshCw,
  Save,
  Trash2,
  Trophy,
  Wand2,
} from "lucide-react";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncementSettings,
  listAnnouncements,
  updateAnnouncement,
  updateAnnouncementSettings,
} from "@/lib/api/announcement";
import { getAnnouncementTemplate } from "@/announcements/registry";
import type { Announcement, AnnouncementContent, AnnouncementFace } from "@/announcements/types";
import { readNetworkSessionToken } from "@/features/networkSession/storage";
import styles from "@/announcements/studio.module.css";

/*
 * Two modes, nothing else.
 *
 *   Tournament     automatic. Activating it is the whole action — the homepage
 *                  block is driven by the live season, not by anything written
 *                  here.
 *   Personalized   a menu to write announcements and pick the one that goes
 *                  live.
 *
 * The old studio mixed several announcement templates, a live preview and a
 * reorderable list into one screen. All of that collapsed into these two.
 */

const CUSTOM_DEFAULT: AnnouncementContent = {
  eyebrow: "",
  headline: "",
  body: "",
  imageUrl: "",
  ctaLabel: "",
  ctaHref: "",
} as AnnouncementContent;

type Draft = {
  id: number | null;
  name: string;
  content: AnnouncementContent;
  published: boolean;
};

const toDraft = (item: Announcement): Draft => ({
  id: item.id,
  name: item.name,
  content: item.content,
  published: item.published,
});

export function AnnouncementStudio() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<AnnouncementFace>("TOURNAMENT");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const load = useCallback(async () => {
    const token = readNetworkSessionToken();
    if (!token) return;
    try {
      const [list, settings] = await Promise.all([
        listAnnouncements(token),
        getAnnouncementSettings(token),
      ]);
      setItems(list);
      setEnabled(settings.enabled);
      setMode(settings.mode);
      setActiveId(settings.activeAnnouncementId);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the studio.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchSettings = useCallback(
    async (patch: { enabled?: boolean; mode?: AnnouncementFace; activeAnnouncementId?: number | null }) => {
      const token = readNetworkSessionToken();
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        const next = await updateAnnouncementSettings(token, patch);
        setEnabled(next.enabled);
        setMode(next.mode);
        setActiveId(next.activeAnnouncementId);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not update the mode.");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  async function save() {
    const token = readNetworkSessionToken();
    if (!token || !draft) return;
    if (!draft.name.trim()) {
      setError("Give the announcement a name so you can find it in the list.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: draft.name,
        type: "CUSTOM" as const,
        content: draft.content,
        countdownAt: null,
        published: true,
      };
      const saved = draft.id
        ? await updateAnnouncement(token, draft.id, payload)
        : await createAnnouncement(token, payload);
      // A freshly written announcement becomes the live one, so writing it is
      // enough — no separate "set live" step for the common case.
      await patchSettings({ activeAnnouncementId: saved.id });
      await load();
      setDraft(null);
      setMessage("Announcement saved and set live.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the announcement.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    const token = readNetworkSessionToken();
    if (!token) return;
    setBusy(true);
    try {
      await deleteAnnouncement(token, id);
      if (draft?.id === id) setDraft(null);
      setConfirmDelete(null);
      await load();
      setMessage("Announcement deleted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete the announcement.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className={styles.message}>
        <RefreshCw size={16} className={styles.spin} /> Loading the studio
      </p>
    );
  }

  // ---- editor ---------------------------------------------------------------

  const template = getAnnouncementTemplate("CUSTOM");
  if (draft && template) {
    const { Editor, View: Preview } = template;
    return (
      <section className={styles.studio}>
        <button type="button" className={styles.secondary} onClick={() => setDraft(null)}>
          <ArrowLeft size={16} /> All announcements
        </button>
        <div className={styles.header}>
          <div>
            <h2>{draft.id ? "Edit announcement" : "New announcement"}</h2>
            <p>Saving sets this one live on the homepage.</p>
          </div>
        </div>

        <div className={styles.workbench}>
          <div className={styles.editor}>
            <label className={styles.field}>
              <span>Internal name</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <Editor content={draft.content} onChange={(content) => setDraft({ ...draft, content })} />
          </div>

          <aside className={styles.preview}>
            <div className={styles.previewHead}>
              <span className={styles.previewLabel}>Live preview</span>
              <span className={styles.previewHint}>Updates as you type</span>
            </div>
            <div className={styles.previewStage}>
              <Preview content={draft.content} payload={null} countdownAt={null} now={Date.now()} standalone />
            </div>
          </aside>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.primary} onClick={() => void save()} disabled={busy}>
            <Save size={16} /> Save &amp; set live
          </button>
          {error ? (
            <span className={styles.error} aria-live="polite">{error}</span>
          ) : (
            <span className={styles.message} aria-live="polite">{message}</span>
          )}
        </div>
      </section>
    );
  }

  // ---- two modes ------------------------------------------------------------

  return (
    <section className={styles.studio}>
      <div className={styles.header}>
        <div>
          <h2>Homepage announcement</h2>
          <p>Pick what the homepage shows. Tournament mode runs itself.</p>
        </div>
        <div className={styles.actions}>
          <Link href="/announcements" target="_blank" className={styles.secondary}>
            Open output <ExternalLink size={15} />
          </Link>
          <button
            type="button"
            className={`${styles.toggle} ${enabled ? styles.toggleOn : ""}`}
            onClick={() => void patchSettings({ enabled: !enabled })}
            role="switch"
            aria-checked={enabled}
            disabled={busy}
          >
            <Power size={16} /> {enabled ? "Visible" : "Hidden"}
          </button>
        </div>
      </div>

      <div className={styles.modeCards}>
        <button
          type="button"
          className={styles.modeCard}
          data-active={mode === "TOURNAMENT" ? "true" : "false"}
          onClick={() => void patchSettings({ mode: "TOURNAMENT" })}
          disabled={busy}
          aria-pressed={mode === "TOURNAMENT"}
        >
          <span className={styles.modeIcon}><Trophy size={26} /></span>
          <span className={styles.modeName}>Tournament mode</span>
          <span className={styles.modeCopy}>
            Automatic. The homepage follows the live season on its own — season countdown, next
            match, latest result, grand final. Nothing to write.
          </span>
          <span className={styles.modeState}>{mode === "TOURNAMENT" ? "Active" : "Activate"}</span>
        </button>

        <button
          type="button"
          className={styles.modeCard}
          data-active={mode === "CUSTOM" ? "true" : "false"}
          onClick={() => void patchSettings({ mode: "CUSTOM" })}
          disabled={busy}
          aria-pressed={mode === "CUSTOM"}
        >
          <span className={styles.modeIcon}><Wand2 size={26} /></span>
          <span className={styles.modeName}>Personalized announcement</span>
          <span className={styles.modeCopy}>
            Write your own — a headline, message, image and button — and choose which one is live.
          </span>
          <span className={styles.modeState}>{mode === "CUSTOM" ? "Active" : "Activate"}</span>
        </button>
      </div>

      {/* The creation menu only exists in personalized mode. */}
      {mode === "CUSTOM" ? (
        <div className={styles.customPanel}>
          <div className={styles.customHead}>
            <h3>Your announcements</h3>
            <button
              type="button"
              className={styles.primary}
              onClick={() => setDraft({ id: null, name: "", content: { ...CUSTOM_DEFAULT }, published: true })}
            >
              <Plus size={15} /> New announcement
            </button>
          </div>

          {items.length === 0 ? (
            <p className={styles.message}>Nothing written yet. Create one and it goes live.</p>
          ) : (
            <div className={styles.list}>
              {items.map((item) => {
                const live = activeId === item.id;
                return (
                  <article key={item.id} className={`${styles.row} ${live ? styles.rowLive : ""}`}>
                    <button
                      type="button"
                      className={styles.livePick}
                      onClick={() => void patchSettings({ activeAnnouncementId: live ? null : item.id })}
                      aria-pressed={live}
                      title={live ? "Live on the homepage" : "Set live"}
                    >
                      {live ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <button type="button" className={styles.rowMeta} onClick={() => setDraft(toDraft(item))}>
                      <strong>{item.name || "Untitled"}</strong>
                      <small>{live ? "Live" : "Draft"}</small>
                    </button>
                    <div className={styles.rowActions}>
                      <button type="button" className={styles.secondary} onClick={() => setDraft(toDraft(item))}>
                        Edit
                      </button>
                      <button type="button" className={styles.danger} onClick={() => void remove(item.id)}>
                        <Trash2 size={15} />
                        {confirmDelete === item.id ? "Confirm" : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <p className={styles.error} aria-live="polite">{error}</p>
      ) : message ? (
        <p className={styles.message} aria-live="polite">{message}</p>
      ) : null}
    </section>
  );
}
