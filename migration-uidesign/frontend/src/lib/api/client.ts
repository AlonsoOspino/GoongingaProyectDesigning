import { setServerTimeFromDateHeader } from "@/lib/serverTime";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
  formData?: FormData;
  cache?: RequestCache;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const hasFormData = Boolean(options.formData);
  if (!hasFormData) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    cache: options.cache,
  });

  // Piggy-back on the standard HTTP `Date` response header to keep the
  // client↔server clock offset in sync. See src/lib/serverTime.ts.
  setServerTimeFromDateHeader(response.headers.get("date"));

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    const messageFromPayload =
      typeof payload === "object" && payload
        ? "message" in payload
          ? String((payload as { message: string }).message)
          : "error" in payload
          ? String((payload as { error: string }).error)
          : null
        : null;
    const message = messageFromPayload || `HTTP ${response.status} ${response.statusText}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}
