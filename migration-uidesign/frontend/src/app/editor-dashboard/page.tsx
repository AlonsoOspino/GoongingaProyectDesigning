"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/features/session/SessionProvider";
import { createNews, getNews, type NewsItem } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { NewsCard } from "@/components/news/NewsCard";
import { NewsEditor } from "@/components/news/NewsEditor";
import styles from "@/components/news/news.module.css";

type FormState = {
  title: string;
  content: string;
  imageUrl: string;
};

const initialFormState: FormState = {
  title: "",
  content: "",
  imageUrl: "",
};

const STARTER_TEMPLATE = `## Lead-in

Write an engaging introduction for your readers here.

## Key highlights

- First key point
- Second key point
- Third key point

> A great quote or callout that summarizes the article.

### Read more

Visit [the league site](https://example.com) for full coverage.
`;

export default function EditorDashboardPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated } = useSession();

  const [form, setForm] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);

  const canManageNews = user?.role === "EDITOR" || user?.role === "ADMIN";

  useEffect(() => {
    if (isHydrated && (!isAuthenticated || !canManageNews)) {
      router.push("/login");
    }
  }, [isHydrated, isAuthenticated, canManageNews, router]);

  useEffect(() => {
    if (isAuthenticated && canManageNews) {
      void loadNews();
    }
  }, [isAuthenticated, canManageNews]);

  const imagePreviewUrl = useMemo(() => {
    const trimmed = form.imageUrl.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [form.imageUrl]);

  const titlePreview = form.title.trim() || "Untitled article";
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [],
  );

  async function loadNews() {
    try {
      setIsLoadingNews(true);
      const items = await getNews();
      const sorted = [...items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNews(sorted);
    } catch {
      setNews([]);
    } finally {
      setIsLoadingNews(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const title = form.title.trim();
      const content = form.content.trim();
      const imageUrl = form.imageUrl.trim();

      if (!title || !content) {
        setSubmitError("Title and article body are required.");
        return;
      }

      await createNews(token, {
        title,
        content,
        imageUrl: imageUrl || null,
      });

      setForm(initialFormState);
      setSubmitSuccess("News published successfully.");
      await loadNews();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to publish news.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !canManageNews) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Editor Dashboard</h1>
            <p className="text-muted mt-1">
              Compose rich league news with headings, links, lists, and inline images.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Signed in as{" "}
            <span className="text-foreground font-medium">{user?.nickname}</span>
            <span className="text-muted-foreground">•</span>
            <span>{user?.role}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.editorShell}>
            {/* Editor pane */}
            <Card variant="featured">
              <CardHeader>
                <CardTitle>Create News</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-5">
                  <Input
                    label="Title"
                    placeholder="Example: Week 3 Bracket Update"
                    value={form.title}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    maxLength={160}
                    required
                  />

                  <Input
                    label="Cover image URL"
                    placeholder="https://example.com/news-cover.jpg"
                    value={form.imageUrl}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, imageUrl: e.target.value }))
                    }
                  />

                  <div>
                    <div className={styles.fieldLabel}>
                      <span>Article body</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            content: prev.content
                              ? prev.content
                              : STARTER_TEMPLATE,
                          }))
                        }
                        className={styles.fieldHint}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Insert starter template
                      </button>
                    </div>
                    <NewsEditor
                      value={form.content}
                      onChange={(content) =>
                        setForm((prev) => ({ ...prev, content }))
                      }
                      placeholder={
                        "Write your article in Markdown.\n\n## Use subtitles\n- Bullet points\n- [Add links](https://example.com)\n- ![Add images](https://example.com/image.jpg)"
                      }
                      minLength={40}
                    />
                  </div>

                  {submitError && (
                    <p className="text-sm text-danger">{submitError}</p>
                  )}
                  {submitSuccess && (
                    <p className="text-sm text-success">{submitSuccess}</p>
                  )}

                  <div className="flex justify-between items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setForm(initialFormState);
                        setSubmitError(null);
                        setSubmitSuccess(null);
                      }}
                      className="text-sm text-muted hover:text-foreground transition-colors"
                    >
                      Clear all
                    </button>
                    <Button type="submit" isLoading={isSubmitting}>
                      {isSubmitting ? "Publishing..." : "Publish News"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview / sidebar pane */}
            <div className={styles.previewPane}>
              <Card variant="featured">
                <CardHeader>
                  <CardTitle>Live cover preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={styles.coverFrame}>
                    {imagePreviewUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagePreviewUrl}
                          alt="Cover preview"
                          className={styles.coverImage}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                        <div className={styles.coverGradient} />
                        <div className={styles.coverMeta}>
                          <span className={styles.coverMetaDate}>
                            {todayLabel}
                          </span>
                          <span className={styles.coverMetaTitle}>
                            {titlePreview}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className={styles.coverEmpty}>
                        <svg
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                          />
                        </svg>
                        <span>
                          Paste a cover image URL to preview the article hero.
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Cover image is optional. If left blank, the article will use a
                    decorative gradient hero instead.
                  </p>
                </CardContent>
              </Card>

              <Card variant="featured">
                <CardHeader>
                  <CardTitle>Latest news</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingNews ? (
                    <p className="text-sm text-muted">Loading latest posts...</p>
                  ) : news.length === 0 ? (
                    <p className="text-sm text-muted">No news published yet.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {news.slice(0, 5).map((article) => (
                        <NewsCard
                          key={article.id}
                          article={article}
                          variant="compact"
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
