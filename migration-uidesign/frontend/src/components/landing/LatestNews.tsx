"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getNews } from "@/lib/api/news";
import type { NewsItem } from "@/lib/api/types";
import styles from "./latest-news.module.css";

/*
 * The most recent thing the league said.
 *
 * Colour here comes from real article art rather than decoration, so the
 * section is only as bright as the content behind it.
 */

function excerpt(text: string, max = 140) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export default function LatestNews() {
  const [news, setNews] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    let mounted = true;
    getNews()
      .then((items) => {
        if (mounted) setNews(items.slice(0, 3));
      })
      .catch(() => {
        // A landing band that apologises is worse than one that is absent.
        if (mounted) setNews(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!news || news.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Latest news">
      <div className={styles.inner}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>
            <span className={styles.dot} aria-hidden="true" />
            From the desk
          </p>
          <h2 className={styles.title}>Latest word</h2>
        </header>

        <div className={styles.newsGrid}>
          {news.map((item, index) => (
            <Link
              key={item.id}
              href={`/news/${item.id}`}
              className={styles.newsCard}
              data-lead={index === 0 ? "true" : "false"}
            >
              <span className={styles.newsArt} data-empty={item.imageUrl ? "false" : "true"}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" loading="lazy" decoding="async" />
                ) : null}
              </span>
              <span className={styles.newsBody}>
                <span className={styles.newsDate}>
                  {new Date(item.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <strong className={styles.newsTitle}>{item.title}</strong>
                <span className={styles.newsExcerpt}>{excerpt(item.content)}</span>
              </span>
            </Link>
          ))}
        </div>

        <Link href="/news" className={styles.allNews}>
          All news
        </Link>
      </div>
    </section>
  );
}
