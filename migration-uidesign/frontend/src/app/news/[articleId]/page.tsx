import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNews } from "@/lib/api/news";
import { MarkdownContent, stripMarkdown } from "@/components/news/MarkdownContent";
import BrandField from "@/components/landing/atmosphere/BrandField";
import styles from "../news.module.css";

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

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
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
  /* Un minuto de margen: guardar un articulo toca updatedAt aunque no se haya
     cambiado nada, y no tiene sentido anunciar "actualizado" por eso. */
  const wasUpdated = updatedDate.getTime() - publishedDate.getTime() > 60_000;
  const minutes = readingMinutes(article.content);

  return (
    <div className={styles.page}>
      <BrandField variant="section" className={styles.board} intensity={0.62} seedOffset={4343} />

      <article className={styles.article}>
        <Link href="/news" className={styles.backLink}>
          <span aria-hidden="true">←</span> All news
        </Link>

        {article.imageUrl ? (
          <div className={styles.articleHero}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.articleHeroImage} src={article.imageUrl} alt="" />
          </div>
        ) : null}

        <header className={styles.articleHead}>
          <p className={styles.articleEyebrow}>
            <i aria-hidden="true" /> League news
          </p>
          <h1 className={styles.articleTitle}>{article.title}</h1>

          <p className={styles.articleMeta}>
            <time dateTime={article.createdAt}>{formatLongDate(article.createdAt)}</time>
            <i aria-hidden="true" />
            <span>{minutes} min read</span>
            {wasUpdated ? (
              <>
                <i aria-hidden="true" />
                <span>
                  Updated{" "}
                  {updatedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </>
            ) : null}
          </p>
        </header>

        {/* La prosa la sigue pintando components/news/news.module.css; aqui solo
            se le impone la tipografia de OTP. */}
        <MarkdownContent content={article.content} className={styles.prose} />

        <footer className={styles.articleFoot}>
          <Link href="/news" className={styles.backLink}>
            <span aria-hidden="true">←</span> View all news
          </Link>
          <span>Article #{article.id}</span>
        </footer>
      </article>
    </div>
  );
}
