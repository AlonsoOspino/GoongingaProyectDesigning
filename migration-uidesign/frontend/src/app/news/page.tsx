import Link from "next/link";
import type { Metadata } from "next";
import { getNews } from "@/lib/api/news";
import BrandField from "@/components/landing/atmosphere/BrandField";
import { ArrowIcon, DISCORD_INVITE } from "@/components/landing/brandAssets";
import styles from "./news.module.css";

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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function NewsPage() {
  const news = await getNewsData();

  return (
    <div className={styles.page}>
      {/* El mismo tablero que el resto del sitio, fijo detras del listado. */}
      <BrandField variant="section" className={styles.board} intensity={0.7} seedOffset={4242} />

      <header className={styles.hero}>
        <p className={styles.eyebrow}>Overtime Productions · Dispatches</p>
        <h1 className={styles.h1}>News</h1>
        <p className={styles.standfirst}>
          Season announcements, roster moves, event recaps and everything the league publishes
          between broadcasts.
        </p>
      </header>

      <div className={styles.list}>
        {news.length > 0 ? (
          <section className={styles.grid} aria-label="Published news">
            {news.map((item, index) => (
              <article
                key={item.id}
                /* La primera va a doble ancho: es la unica jerarquia que hace
                   falta para que se vea cual es la ultima noticia. */
                className={`${styles.card} ${index === 0 ? styles.cardLead : ""}`}
              >
                <div className={styles.cardMediaWrap}>
                  {item.imageUrl ? (
                    <img
                      className={styles.cardMedia}
                      src={item.imageUrl}
                      alt=""
                      width={960}
                      height={540}
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                    />
                  ) : (
                    <span className={styles.cardMediaEmpty} aria-hidden="true" />
                  )}
                </div>

                <div className={styles.cardBody}>
                  <p className={styles.cardDate}>
                    <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                  </p>
                  <h2 className={styles.cardTitle}>{item.title}</h2>
                  <span className={styles.cardMore} aria-hidden="true">
                    Read article <ArrowIcon size={13} />
                  </span>
                </div>

                {/* Cubre la tarjeta entera para que el objetivo tactil sea la
                    tarjeta y no dos palabras. Lleva el titulo como texto
                    accesible; el visible va en aria-hidden para no repetirlo. */}
                <Link href={`/news/${item.id}`} className={styles.cardLink}>
                  {item.title}
                </Link>
              </article>
            ))}
          </section>
        ) : (
          <section className={styles.empty} aria-labelledby="news-empty">
            <div className={styles.emptyCopy}>
              <h2 className={styles.emptyTitle} id="news-empty">
                Nothing published yet
              </h2>
              <p className={styles.emptyText}>
                When there is nothing here, the league is still talking — it just happens in Discord
                first. Announcements land there before they become an article.
              </p>
            </div>
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.cta}
            >
              Join the Discord <ArrowIcon size={14} />
            </a>
          </section>
        )}
      </div>
    </div>
  );
}
