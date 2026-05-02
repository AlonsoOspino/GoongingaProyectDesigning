import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { stripMarkdown } from "@/components/news/MarkdownContent";
import type { NewsItem } from "@/lib/api/types";

interface NewsCardProps {
  article: NewsItem;
  variant?: "default" | "compact";
}

export function NewsCard({ article, variant = "default" }: NewsCardProps) {
  const publishedDate = new Date(article.createdAt);
  const previewText = stripMarkdown(article.content, 220);

  if (variant === "compact") {
    return (
      <Link href={`/news/${article.id}`}>
        <div className="flex gap-4 p-3 rounded-lg hover:bg-surface-elevated transition-colors">
          {article.imageUrl && (
            <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-surface-elevated">
              <img
                src={article.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-foreground line-clamp-2">{article.title}</h4>
            <p className="text-xs text-muted mt-1">
              {publishedDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/news/${article.id}`}>
      <Card
        variant="featured"
        className="overflow-hidden hover:scale-[1.02]"
      >
        {article.imageUrl && (
          <div className="aspect-video bg-surface-elevated overflow-hidden">
            <img
              src={article.imageUrl}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            />
          </div>
        )}
        <CardContent className="p-4">
          <p className="text-xs text-muted mb-2">
            {publishedDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <h3 className="font-semibold text-foreground line-clamp-2 mb-2">
            {article.title}
          </h3>
          <p className="text-sm text-muted line-clamp-3">{previewText}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
