import type { Metadata } from "next";
import { getNews } from "@/lib/api/news";
import { Card, CardContent } from "@/components/ui/Card";
import { NewsCard } from "@/components/news/NewsCard";
import type { NewsItem } from "@/lib/api/types";
import styles from "@/components/news/news.module.css";

export const metadata: Metadata = {
  title: "News",
  description: "Latest news and updates from the GGL",
};

export const dynamic = "force-dynamic";

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
  const latest = news[0] ?? null;

  return (
    <div className={`container mx-auto px-4 py-10 ${styles.newsPage}`}>
      <section className={styles.newsHero}>
        <div className={styles.newsHeroBackdrop} aria-hidden />
        <div className={styles.newsHeroContent}>
          <div className={styles.newsHeroText}>
            <span className={styles.newsBadge}>League Newsroom</span>
            <h1 className={styles.newsTitle}>News</h1>
            <p className={styles.newsSubtitle}>
              Stay up to date with the latest from the GGL.
            </p>
            {latest && (
              <p className={styles.newsLatest}>
                Latest: <span>{latest.title}</span>
              </p>
            )}
          </div>
          <div className={styles.newsStats}>
            <div className={styles.newsStatCard}>
              <p className={styles.newsStatLabel}>Total posts</p>
              <p className={styles.newsStatValue}>{news.length}</p>
            </div>
            <div className={styles.newsStatCard}>
              <p className={styles.newsStatLabel}>Updated</p>
              <p className={styles.newsStatValue}>Live</p>
            </div>
          </div>
        </div>
      </section>

      {news.length > 0 ? (
        <div className={styles.newsGrid}>
          {news.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <Card variant="featured" className={styles.newsEmptyCard}>
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
