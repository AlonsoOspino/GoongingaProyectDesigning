"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ExternalLink,
  Plus,
  Power,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncementSettings,
  listAnnouncements,
  reorderAnnouncements,
  updateAnnouncement,
  updateAnnouncementSettings,
} from "@/lib/api/announcement";
import {
  announcementTemplates,
  getAnnouncementTemplate,
} from "@/announcements/registry";
import type {
  Announcement,
  AnnouncementContent,
  AnnouncementType,
} from "@/announcements/types";
import { readNetworkSessionToken } from "@/features/networkSession/storage";
import styles from "@/announcements/studio.module.css";

type Draft = {
  id: number | null;
  name: string;
  type: AnnouncementType;
  content: AnnouncementContent;
  countdownAt: string;
  published: boolean;
};
const toInput = (value: string | null) =>
  value
    ? new Date(
        new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
const toIso = (value: string) =>
  value && Number.isFinite(new Date(value).getTime())
    ? new Date(value).toISOString()
    : null;
const fromAnnouncement = (item: Announcement): Draft => ({
  id: item.id,
  name: item.name,
  type: item.type,
  content: item.content,
  countdownAt: toInput(item.countdownAt),
  published: item.published,
});

export function AnnouncementStudio() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [enabled, setEnabled] = useState(true);
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
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not load announcements.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const template = useMemo(
    () => (draft ? getAnnouncementTemplate(draft.type) : null),
    [draft],
  );
  function startNew(type: AnnouncementType) {
    const selected = getAnnouncementTemplate(type);
    setDraft({
      id: null,
      name: selected.label,
      type,
      content: selected.defaultContent,
      countdownAt: "",
      published: false,
    });
    setMessage("");
    setError("");
  }
  async function save() {
    const token = readNetworkSessionToken();
    if (!token || !draft) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: draft.name,
        type: draft.type,
        content: draft.content,
        countdownAt: toIso(draft.countdownAt),
        published: draft.published,
      };
      const saved = draft.id
        ? await updateAnnouncement(token, draft.id, payload)
        : await createAnnouncement(token, payload);
      setDraft(fromAnnouncement(saved));
      await load();
      setMessage("Announcement saved.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save announcement.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function togglePublished(item: Announcement) {
    const token = readNetworkSessionToken();
    if (!token) return;
    setBusy(true);
    try {
      await updateAnnouncement(token, item.id, { published: !item.published });
      await load();
      setMessage(
        item.published
          ? "Announcement moved to drafts."
          : "Announcement published.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not change publication.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggleEnabled() {
    const token = readNetworkSessionToken();
    if (!token) return;
    setBusy(true);
    try {
      const next = await updateAnnouncementSettings(token, !enabled);
      setEnabled(next.enabled);
      setMessage(
        next.enabled
          ? "Announcement section visible."
          : "Announcement section hidden.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not change visibility.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    const token = readNetworkSessionToken();
    if (!token) return;
    try {
      await reorderAnnouncements(
        token,
        next.map((item) => item.id),
      );
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not reorder announcements.",
      );
      await load();
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
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not delete announcement.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <p className={styles.message}>
        <RefreshCw size={16} className="animate-spin" /> Loading announcements
      </p>
    );
  if (draft && template) {
    const { Editor } = template;
    return (
      <section className={styles.studio}>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => setDraft(null)}
        >
          <ArrowLeft size={16} /> All announcements
        </button>
        <div className={styles.header}>
          <div>
            <h2>{draft.id ? "Edit announcement" : "New announcement"}</h2>
            <p>{template.description}</p>
          </div>
        </div>
        <div className={styles.editor}>
          <label className={styles.field}>
            <span>Internal name</span>
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <Editor
            content={draft.content}
            onChange={(content) => setDraft({ ...draft, content })}
          />
          <label className={styles.field}>
            <span>Countdown or closing time</span>
            <input
              type="datetime-local"
              value={draft.countdownAt}
              onChange={(e) =>
                setDraft({ ...draft, countdownAt: e.target.value })
              }
            />
          </label>
          <button
            type="button"
            className={`${styles.toggle} ${draft.published ? styles.toggleOn : ""}`}
            role="switch"
            aria-checked={draft.published}
            onClick={() => setDraft({ ...draft, published: !draft.published })}
          >
            {draft.published ? "Published" : "Draft"}
          </button>
        </div>
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => void save()}
            disabled={busy}
          >
            <Save size={16} /> Save
          </button>
          {error ? (
            <span className={styles.error} aria-live="polite">
              {error}
            </span>
          ) : (
            <span className={styles.message} aria-live="polite">
              {message}
            </span>
          )}
        </div>
      </section>
    );
  }
  return (
    <section className={styles.studio}>
      <div className={styles.header}>
        <div>
          <h2>Announcement Builder</h2>
          <p>Create, publish, and order homepage announcements.</p>
        </div>
        <div className={styles.actions}>
          <Link
            href="/announcements"
            target="_blank"
            className={styles.secondary}
          >
            Open output <ExternalLink size={15} />
          </Link>
          <button
            type="button"
            className={`${styles.toggle} ${enabled ? styles.toggleOn : ""}`}
            onClick={() => void toggleEnabled()}
            role="switch"
            aria-checked={enabled}
            disabled={busy}
          >
            <Power size={16} /> {enabled ? "Visible" : "Hidden"}
          </button>
        </div>
      </div>
      <div className={styles.actions}>
        {announcementTemplates.map(({ type, label, icon: Icon }) => (
          <button
            type="button"
            key={type}
            className={styles.secondary}
            onClick={() => startNew(type)}
          >
            <Plus size={15} />
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      <div className={styles.list}>
        {items.map((item, index) => {
          const meta = getAnnouncementTemplate(item.type);
          return (
            <article
              key={item.id}
              className={`${styles.row} ${item.published ? styles.rowLive : ""}`}
            >
              <button
                type="button"
                className={styles.rowMeta}
                onClick={() => setDraft(fromAnnouncement(item))}
              >
                <strong>{item.name}</strong>
                <small>
                  {meta.label} · {item.published ? "Published" : "Draft"}
                </small>
              </button>
              <div className={styles.rowActions}>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => void move(index, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="Move down"
                  disabled={index === items.length - 1}
                  onClick={() => void move(index, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => void togglePublished(item)}
                >
                  {item.published ? "Unpublish" : "Publish"}
                </button>
                <button
                  type="button"
                  className={styles.danger}
                  onClick={() => void remove(item.id)}
                >
                  <Trash2 size={15} />
                  {confirmDelete === item.id ? "Confirm" : "Delete"}
                </button>
              </div>
            </article>
          );
        })}
        {items.length === 0 ? (
          <p className={styles.message}>No announcements yet.</p>
        ) : null}
      </div>
      {error ? (
        <p className={styles.error} aria-live="polite">
          {error}
        </p>
      ) : message ? (
        <p className={styles.message} aria-live="polite">
          {message}
        </p>
      ) : null}
    </section>
  );
}
