"use client";

import { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clsx } from "clsx";
import styles from "./news.module.css";

type Mode = "write" | "preview";

interface NewsEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minLength?: number;
}

const ICON = {
  bold: <span className={styles.toolbarButtonStrong}>B</span>,
  italic: <span className={styles.toolbarButtonItalic}>I</span>,
  h1: <span>H1</span>,
  h2: <span>H2</span>,
  h3: <span>H3</span>,
  quote: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
    </svg>
  ),
  ul: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  ol: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
      <path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
    </svg>
  ),
  link: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  image: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
  divider: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="3" y1="12" x2="21" y2="12"/>
    </svg>
  ),
  code: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  write: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  ),
  preview: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
};

export function NewsEditor({
  value,
  onChange,
  placeholder,
  minLength,
}: NewsEditorProps) {
  const [mode, setMode] = useState<Mode>("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Apply a transform around the current selection (or caret). */
  const applyTransform = useCallback(
    (
      transform: (selectedText: string, fullText: string, start: number, end: number) =>
        | { newText: string; newStart: number; newEnd: number }
        | null,
    ) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = value.slice(start, end);
      const result = transform(selected, value, start, end);
      if (!result) return;
      onChange(result.newText);
      // Restore selection on next paint
      requestAnimationFrame(() => {
        const node = textareaRef.current;
        if (!node) return;
        node.focus();
        node.setSelectionRange(result.newStart, result.newEnd);
      });
    },
    [onChange, value],
  );

  const wrapSelection = useCallback(
    (before: string, after: string, placeholderText = "text") => {
      applyTransform((selected, full, start, end) => {
        const inner = selected || placeholderText;
        const newText = full.slice(0, start) + before + inner + after + full.slice(end);
        const newStart = start + before.length;
        const newEnd = newStart + inner.length;
        return { newText, newStart, newEnd };
      });
    },
    [applyTransform],
  );

  const prefixLines = useCallback(
    (prefix: string, placeholderText = "") => {
      applyTransform((selected, full, start, end) => {
        // Expand to full line boundaries
        const lineStart = full.lastIndexOf("\n", start - 1) + 1;
        const lineEndSearch = full.indexOf("\n", end);
        const lineEnd = lineEndSearch === -1 ? full.length : lineEndSearch;
        const block = full.slice(lineStart, lineEnd) || placeholderText;
        const transformed = block
          .split("\n")
          .map((ln) => (ln.length === 0 ? prefix.trimEnd() : prefix + ln))
          .join("\n");
        const newText = full.slice(0, lineStart) + transformed + full.slice(lineEnd);
        const newStart = lineStart;
        const newEnd = lineStart + transformed.length;
        return { newText, newStart, newEnd };
      });
    },
    [applyTransform],
  );

  const insertBlock = useCallback(
    (block: string) => {
      applyTransform((_selected, full, start, end) => {
        const before = full.slice(0, start);
        const after = full.slice(end);
        const needsLeadingNewline = before.length > 0 && !before.endsWith("\n");
        const needsTrailingNewline = after.length > 0 && !after.startsWith("\n");
        const insertion =
          (needsLeadingNewline ? "\n" : "") +
          block +
          (needsTrailingNewline ? "\n" : "");
        const newText = before + insertion + after;
        const caret = before.length + insertion.length;
        return { newText, newStart: caret, newEnd: caret };
      });
    },
    [applyTransform],
  );

  const insertLink = useCallback(() => {
    const url = window.prompt("Link URL:", "https://");
    if (!url) return;
    applyTransform((selected, full, start, end) => {
      const label = selected || "link text";
      const md = `[${label}](${url})`;
      const newText = full.slice(0, start) + md + full.slice(end);
      const labelStart = start + 1;
      const labelEnd = labelStart + label.length;
      return { newText, newStart: labelStart, newEnd: labelEnd };
    });
  }, [applyTransform]);

  const insertImage = useCallback(() => {
    const url = window.prompt("Image URL:", "https://");
    if (!url) return;
    const alt = window.prompt("Alt text (optional):", "") || "";
    applyTransform((_sel, full, start, end) => {
      const md = `![${alt}](${url})`;
      const before = full.slice(0, start);
      const after = full.slice(end);
      const needsLead = before.length > 0 && !before.endsWith("\n");
      const needsTrail = after.length > 0 && !after.startsWith("\n");
      const insertion = (needsLead ? "\n\n" : "") + md + (needsTrail ? "\n\n" : "");
      const newText = before + insertion + after;
      const caret = before.length + insertion.length;
      return { newText, newStart: caret, newEnd: caret };
    });
  }, [applyTransform]);

  const charCount = value.length;
  const aboveMin = !minLength || charCount >= minLength;

  return (
    <div className={styles.editorPane}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className={styles.tabs} role="tablist" aria-label="Editor mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "write"}
            className={clsx(styles.tab, mode === "write" && styles.tabActive)}
            onClick={() => setMode("write")}
          >
            {ICON.write}
            Write
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preview"}
            className={clsx(styles.tab, mode === "preview" && styles.tabActive)}
            onClick={() => setMode("preview")}
          >
            {ICON.preview}
            Preview
          </button>
        </div>
        <span className={styles.fieldHint}>Markdown supported</span>
      </div>

      {mode === "write" ? (
        <div>
          <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
            <div className={styles.toolbarGroup}>
              <button
                type="button"
                className={styles.toolbarButton}
                title="Bold (Ctrl+B)"
                aria-label="Bold"
                onClick={() => wrapSelection("**", "**", "bold text")}
              >
                {ICON.bold}
              </button>
              <button
                type="button"
                className={styles.toolbarButton}
                title="Italic (Ctrl+I)"
                aria-label="Italic"
                onClick={() => wrapSelection("_", "_", "italic text")}
              >
                {ICON.italic}
              </button>
              <button
                type="button"
                className={styles.toolbarButton}
                title="Inline code"
                aria-label="Inline code"
                onClick={() => wrapSelection("`", "`", "code")}
              >
                {ICON.code}
              </button>
            </div>

            <div className={styles.toolbarDivider} aria-hidden />

            <div className={styles.toolbarGroup}>
              <button
                type="button"
                className={styles.toolbarButton}
                title="Heading 1"
                aria-label="Heading 1"
                onClick={() => prefixLines("# ", "Heading")}
              >
                {ICON.h1}
              </button>
              <button
                type="button"
                className={styles.toolbarButton}
                title="Heading 2 (subtitle)"
                aria-label="Heading 2"
                onClick={() => prefixLines("## ", "Subtitle")}
              >
                {ICON.h2}
              </button>
              <button
                type="button"
                className={styles.toolbarButton}
                title="Heading 3"
                aria-label="Heading 3"
                onClick={() => prefixLines("### ", "Section")}
              >
                {ICON.h3}
              </button>
            </div>

            <div className={styles.toolbarDivider} aria-hidden />

            <div className={styles.toolbarGroup}>
              <button
                type="button"
                className={styles.toolbarButton}
                title="Bulleted list"
                aria-label="Bulleted list"
                onClick={() => prefixLines("- ", "List item")}
              >
                {ICON.ul}
              </button>
              <button
                type="button"
                className={styles.toolbarButton}
                title="Numbered list"
                aria-label="Numbered list"
                onClick={() => prefixLines("1. ", "List item")}
              >
                {ICON.ol}
              </button>
              <button
                type="button"
                className={styles.toolbarButton}
                title="Quote"
                aria-label="Quote"
                onClick={() => prefixLines("> ", "Quoted text")}
              >
                {ICON.quote}
              </button>
            </div>

            <div className={styles.toolbarDivider} aria-hidden />

            <div className={styles.toolbarGroup}>
              <button
                type="button"
                className={styles.toolbarButton}
                title="Insert link"
                aria-label="Insert link"
                onClick={insertLink}
              >
                {ICON.link}
              </button>
              <button
                type="button"
                className={styles.toolbarButton}
                title="Insert image (URL)"
                aria-label="Insert image"
                onClick={insertImage}
              >
                {ICON.image}
              </button>
              <button
                type="button"
                className={styles.toolbarButton}
                title="Horizontal divider"
                aria-label="Insert divider"
                onClick={() => insertBlock("\n---\n")}
              >
                {ICON.divider}
              </button>
            </div>

            <span className={styles.toolbarHint}>Tip: select text, then click a button</span>
          </div>

          <div className={styles.editorBody}>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
                  e.preventDefault();
                  wrapSelection("**", "**", "bold text");
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
                  e.preventDefault();
                  wrapSelection("_", "_", "italic text");
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                  e.preventDefault();
                  insertLink();
                }
              }}
              placeholder={placeholder}
              className={styles.editorTextarea}
              spellCheck
            />
            <div className={styles.editorFootbar}>
              <span>
                Use{" "}
                <code style={{ fontFamily: "var(--font-mono)" }}>**bold**</code>,{" "}
                <code style={{ fontFamily: "var(--font-mono)" }}>## subtitle</code>,{" "}
                <code style={{ fontFamily: "var(--font-mono)" }}>[text](url)</code>,{" "}
                <code style={{ fontFamily: "var(--font-mono)" }}>![alt](image-url)</code>
              </span>
              <span className={styles.charCount}>
                {charCount} char{charCount === 1 ? "" : "s"}
                {minLength ? ` / ${minLength} min` : ""}
                {!aboveMin && (
                  <span style={{ color: "var(--color-warning)", marginLeft: 6 }}>•</span>
                )}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.markdownPreview}>
          {value.trim().length === 0 ? (
            <p className={styles.markdownPreviewEmpty}>
              Nothing to preview yet — switch to Write and start typing.
            </p>
          ) : (
            <div className={styles.markdownBody}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
