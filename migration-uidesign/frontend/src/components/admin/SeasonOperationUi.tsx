"use client";

import Link from "next/link";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import type { Team } from "@/lib/api/types";

export function OperationMessage({ error, notice }: { error: string | null; notice?: string | null }) {
  return <div aria-live="polite">
    {error && <p role="alert" className="mb-5 rounded-sm border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
    {notice && <p role="status" className="mb-5 rounded-sm border border-brand-bright/30 bg-brand-bright/10 p-3 text-sm">{notice}</p>}
  </div>;
}

export function OperationTeamLogo({ team, size = "md" }: { team?: Pick<Team, "name" | "logo">; size?: "sm" | "md" | "lg" }) {
  const dimensions = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-12 w-12";
  return <span className={`${dimensions} inline-flex shrink-0 items-center justify-center rounded-sm bg-surface-inset p-1.5 text-xl font-bold text-muted`}>
    {team?.logo ? <img src={resolveGenericBackendAsset(team.logo)} alt="" className="h-full w-full object-contain" /> : team?.name.slice(0, 2).toUpperCase() || "?"}
  </span>;
}

export function NoActiveSeason() {
  return <div className="rounded-sm border border-border bg-surface-1 p-8 text-sm text-muted">
    Create an active season to begin. <Link href="/admin-dashboard/season" className="text-accent underline">Open Season Control</Link>
  </div>;
}

export function localMatchDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
