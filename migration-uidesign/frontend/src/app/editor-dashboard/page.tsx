"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/features/session/SessionProvider";
import { createNews, getNews, type NewsItem } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { NewsCard } from "@/components/news/NewsCard";

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
        setSubmitError("Title and text are required.");
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Editor Dashboard</h1>
          <p className="text-muted mt-1">
            Create and publish league news with title, image URL, and full text.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <Card variant="featured">
            <CardHeader>
              <CardTitle>Create News</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Title"
                  placeholder="Example: Week 3 Bracket Update"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  maxLength={160}
                  required
                />

                <Input
                  label="Image URL"
                  placeholder="https://example.com/news-image.jpg"
                  value={form.imageUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                />

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Text
                  </label>
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder="Write the full article text here..."
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[180px] resize-y"
                    required
                  />
                </div>

                {submitError && (
                  <p className="text-sm text-danger">{submitError}</p>
                )}
                {submitSuccess && (
                  <p className="text-sm text-success">{submitSuccess}</p>
                )}

                <div className="flex justify-end">
                  <Button type="submit" isLoading={isSubmitting}>
                    {isSubmitting ? "Publishing..." : "Publish News"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card variant="featured">
              <CardHeader>
                <CardTitle>Image Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {imagePreviewUrl ? (
                  <div className="rounded-lg overflow-hidden border border-border bg-surface-elevated">
                    <img
                      src={imagePreviewUrl}
                      alt="Preview"
                      className="w-full h-56 object-cover"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    Paste an image URL to preview it before publishing.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card variant="featured">
              <CardHeader>
                <CardTitle>Latest News</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingNews ? (
                  <p className="text-sm text-muted">Loading latest posts...</p>
                ) : news.length === 0 ? (
                  <p className="text-sm text-muted">No news published yet.</p>
                ) : (
                  <div className="space-y-3">
                    {news.slice(0, 5).map((article) => (
                      <NewsCard key={article.id} article={article} variant="compact" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
