import type { Metadata } from "next";
import { getNews } from "@/lib/api/news";
import { Card, CardContent } from "@/components/ui/Card";
import { NewsCard } from "@/components/news/NewsCard";
import type { NewsItem } from "@/lib/api/types";

export const metadata: Metadata = {
  title: "News",
  description: "Latest news and updates from the Goonginga League",
};

async function getNewsData() {
  try {
    const news = await getNews();
    return news.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error("Failed to fetch news:", error);
    return [];
  }
}

export default async function NewsPage() {
  const news = await getNewsData();

  return (
    <div className="container mx-auto px-4 py-8 relative">
      {/* Decorative background */}
      <div className="fixed top-24 left-1/3 w-64 h-64 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-52 h-52 bg-primary/10 rounded-full blur-[90px] pointer-events-none" />
      
      {/* Header */}
      <div className="mb-8 relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-8 bg-gradient-to-b from-accent to-primary rounded-full" />
          <h1 className="text-3xl font-bold text-foreground">News</h1>
        </div>
        <p className="text-muted pl-4">
          Stay up to date with the latest from the Goonginga League
        </p>
      </div>

      {/* News Grid */}
      {news.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {news.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <Card variant="featured">
          <CardContent className="py-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No News Yet
              </h2>
              <p className="text-muted">
                Check back later for the latest updates and announcements.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
