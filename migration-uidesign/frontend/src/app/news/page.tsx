import Link from "next/link";
import type { Metadata } from "next";
import { getNews } from "@/lib/api/news";

export const metadata: Metadata = {
  title: "News",
  description: "Latest news and updates from GGL.",
};

export const dynamic = "force-dynamic";

async function getNewsData() {
  try {
    const news = await getNews();
    return news.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  } catch (error) {
    console.error("Failed to fetch news:", error);
    return [];
  }
}

export default async function NewsPage() {
  const news = await getNewsData();

  return (
    <article>
      <header>
        <h1>News</h1>
        <p>Latest updates from GGL.</p>
      </header>

      {news.length > 0 ? (
        <section aria-label="Published news">
          {news.map((item) => (
            <article key={item.id}>
              <h2><Link href={`/news/${item.id}`}>{item.title}</Link></h2>
              <p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString("en-US")}</time></p>
              {item.imageUrl ? <img src={item.imageUrl} alt="" width={960} height={540} /> : null}
              <p><Link href={`/news/${item.id}`}>Read article</Link></p>
            </article>
          ))}
        </section>
      ) : (
        <section aria-labelledby="news-empty">
          <h2 id="news-empty">No news yet</h2>
          <p>Check back later for league updates.</p>
        </section>
      )}
    </article>
  );
}
