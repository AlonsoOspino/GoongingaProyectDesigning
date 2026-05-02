import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clsx } from "clsx";
import styles from "./news.module.css";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Renders Markdown news content with safe defaults:
 * - GFM (tables, task lists, autolinks, strikethrough)
 * - External links open in a new tab with rel=noopener,noreferrer
 * - Images get loading="lazy" and alt fallback
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={clsx(styles.markdownBody, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...rest }) => {
            const isExternal = href?.startsWith("http");
            return (
              <a
                href={href}
                {...(isExternal
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                {...rest}
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} loading="lazy" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Strips Markdown syntax for use in card previews / meta descriptions.
 */
export function stripMarkdown(input: string, maxLen = 240): string {
  let text = input;
  // Remove fenced code blocks
  text = text.replace(/```[\s\S]*?```/g, " ");
  // Inline code
  text = text.replace(/`([^`]+)`/g, "$1");
  // Images ![alt](url) -> alt
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Headings, blockquotes, list markers at line starts
  text = text.replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "");
  // Horizontal rules
  text = text.replace(/^\s*([-*_])\1\1+\s*$/gm, " ");
  // Bold / italic markers
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");
  // Strikethrough
  text = text.replace(/~~(.*?)~~/g, "$1");
  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();
  if (text.length > maxLen) {
    text = text.slice(0, maxLen).trimEnd() + "…";
  }
  return text;
}
