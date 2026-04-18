import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNews } from "@/lib/api/news";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

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
    description: article.content.slice(0, 160),
  };
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
  const wasUpdated = updatedDate.getTime() > publishedDate.getTime();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Link */}
      <Link
        href="/news"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to News
      </Link>

      <article className="max-w-3xl mx-auto">
        {/* Article Header */}
        <header className="mb-8">
          {/* Date */}
          <div className="flex items-center gap-3 text-sm text-muted mb-4">
            <time dateTime={article.createdAt}>
              {publishedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
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

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6 text-balance">
            {article.title}
          </h1>
        </header>

        {/* Featured Image */}
        {article.imageUrl && (
          <div className="mb-8 rounded-xl overflow-hidden bg-surface-elevated">
            <img
              src={article.imageUrl}
              alt=""
              className="w-full aspect-video object-cover"
            />
          </div>
        )}

        {/* Content */}
        <Card variant="bordered">
          <CardContent className="p-6 md:p-8">
            <div className="prose prose-invert max-w-none">
              {article.content.split("\n").map((paragraph, idx) => (
                <p key={idx} className="text-foreground leading-relaxed mb-4 last:mb-0">
                  {paragraph}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Share/Actions */}
        <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
          <Link
            href="/news"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            View all news
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted">
            <span>Article #{article.id}</span>
          </div>
        </div>
      </article>
    </div>
  );
}
