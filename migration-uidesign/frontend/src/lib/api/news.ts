import { apiRequest } from "@/lib/api/client";
import type { NewsItem } from "@/lib/api/types";

export async function getNews() {
  return apiRequest<NewsItem[]>("/news");
}

export async function createNews(
  token: string,
  payload: { title: string; content: string; imageUrl?: string | null }
) {
  return apiRequest<NewsItem>("/news/create", {
    method: "POST",
    token,
    body: payload,
  });
}
