import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNews } from "@/lib/api/news";
import {
  MarkdownContent,
  stripMarkdown,
} from "@/components/news/MarkdownContent";
import styles from "@/components/news/news.module.css";

interface ArticlePageProps {
  params: Promise<{ articleId: string }>;
}

async function getArticle(articleId: number) {
  try {
    const news = await getNews();
    return news.find((n) => n.id === articleId) || null;
  } catch (error) {
    console.error("Failed to fetch article:", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const articleId = parseInt(resolvedParams.articleId, 10);
  const article = await getArticle(articleId);

  if (!article) {
    return { title: "Article Not Found" };
  }

  return {
    title: article.title,
    description: stripMarkdown(article.content, 160),
  };
}

function formatLongDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function readingMinutes(content: string) {
  const words = stripMarkdown(content, 100000).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const resolvedParams = await params;
  const articleId = parseInt(resolvedParams.articleId, 10);

  if (isNaN(articleId)) {
    notFound();
  }

  const article = await getArticle(articleId);

  if (!article) {
    notFound();
  }

  const publishedDate = new Date(article.createdAt);
  const updatedDate = new Date(article.updatedAt);
  const wasUpdated = updatedDate.getTime() - publishedDate.getTime() > 60_000;
  const minutes = readingMinutes(article.content);

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/news"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to News
      </Link>

      <article className={styles.articleShell}>
        {article.imageUrl ? (
          <div className={styles.articleHero}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.imageUrl}
              alt=""
              className={styles.articleHeroImage}
            />
            <div className={styles.articleHeroOverlay}>
              <span className={styles.articleEyebrow}>
                <span className={styles.articleEyebrowDot} />
                League News
              </span>
              <h1 className={styles.articleTitle}>{article.title}</h1>
              <div className={styles.articleMeta}>
                <span className={styles.articleMetaItem}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <time dateTime={article.createdAt}>
                    {formatLongDate(article.createdAt)}
                  </time>
                </span>
                <span className={styles.articleMetaItem}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {minutes} min read
                </span>
                {wasUpdated && (
                  <span className={styles.articleMetaItem}>
                    Updated{" "}
                    {updatedDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <header className={styles.articleHeader}>
            <span className={styles.articleEyebrow}>
              <span className={styles.articleEyebrowDot} />
              League News
            </span>
            <h1 className={styles.articleTitle}>{article.title}</h1>
            <div className={styles.articleMeta}>
              <time dateTime={article.createdAt}>
                {formatLongDate(article.createdAt)}
              </time>
              <span>·</span>
              <span>{minutes} min read</span>
              {wasUpdated && (
                <>
                  <span>·</span>
                  <span>
                    Updated{" "}
                    {updatedDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </>
              )}
            </div>
          </header>
        )}

        <MarkdownContent content={article.content} />

        <div className="mt-10 pt-6 border-t border-border flex items-center justify-between">
          <Link
            href="/news"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            ← View all news
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Article #{article.id}</span>
          </div>
        </div>
      </article>
    </div>
  );
}
