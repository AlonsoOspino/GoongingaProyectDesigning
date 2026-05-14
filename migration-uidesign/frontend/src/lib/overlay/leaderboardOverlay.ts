import type { LeaderboardOverlaySettings } from "@/lib/api/types";

export const OVERLAY_FONT_OPTIONS = [
  { label: "Bebas Neue", value: "var(--font-overlay-display), sans-serif" },
  { label: "Bebas Neue Bold", value: "var(--font-overlay-display), sans-serif" },
  { label: "League Gothic", value: "var(--font-league-gothic), sans-serif" },
  { label: "Oswald", value: "var(--font-overlay-body), sans-serif" },
  { label: "Big Noodle Titling", value: "BigNoodleTitling, sans-serif" },
  { label: "Trebuchet", value: "Trebuchet MS, sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
] as const;

export const DEFAULT_LEADERBOARD_OVERLAY_SETTINGS: LeaderboardOverlaySettings = {
  weekNumber: 1,
  title: {
    color: "#FFFFFF",
    fontFamily: "var(--font-overlay-display), sans-serif",
    fontSize: 74,
    offsetX: 0,
    offsetY: 0,
  },
  leaderboard: {
    color: "#FFFFFF",
    fontFamily: "var(--font-overlay-body), sans-serif",
    fontSize: 42,
    columnGap: 34,
    rowGap: 14,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  },
  matches: {
    color: "#FFFFFF",
    fontFamily: "var(--font-overlay-body), sans-serif",
    fontSize: 42,
    columnGap: 24,
    rowGap: 20,
    logoSize: 84,
    logoGap: 24,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  },
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const safeNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
};

const safeColor = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed;
};

const safeFont = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed;
};

export function normalizeLeaderboardOverlaySettings(value: unknown): LeaderboardOverlaySettings {
  const source = typeof value === "object" && value !== null ? (value as Partial<LeaderboardOverlaySettings>) : {};

  const title: Partial<LeaderboardOverlaySettings["title"]> = source.title ?? {};
  const leaderboard: Partial<LeaderboardOverlaySettings["leaderboard"]> = source.leaderboard ?? {};
  const matches: Partial<LeaderboardOverlaySettings["matches"]> = source.matches ?? {};

  return {
    weekNumber: safeNumber(source.weekNumber, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.weekNumber, 1, 99),
    title: {
      color: safeColor(title.color, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.title.color),
      fontFamily: safeFont(title.fontFamily, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.title.fontFamily),
      fontSize: safeNumber(title.fontSize, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.title.fontSize, 20, 180),
      offsetX: safeNumber(title.offsetX, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.title.offsetX, -900, 900),
      offsetY: safeNumber(title.offsetY, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.title.offsetY, -500, 500),
    },
    leaderboard: {
      color: safeColor(leaderboard.color, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.leaderboard.color),
      fontFamily: safeFont(leaderboard.fontFamily, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.leaderboard.fontFamily),
      fontSize: safeNumber(leaderboard.fontSize, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.leaderboard.fontSize, 16, 120),
      columnGap: safeNumber(leaderboard.columnGap, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.leaderboard.columnGap, 0, 140),
      rowGap: safeNumber(leaderboard.rowGap, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.leaderboard.rowGap, 0, 100),
      scale: safeNumber(leaderboard.scale, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.leaderboard.scale, 0.3, 2),
      offsetX: safeNumber(leaderboard.offsetX, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.leaderboard.offsetX, -900, 900),
      offsetY: safeNumber(leaderboard.offsetY, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.leaderboard.offsetY, -500, 500),
    },
    matches: {
      color: safeColor(matches.color, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.matches.color),
      fontFamily: safeFont(matches.fontFamily, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.matches.fontFamily),
      fontSize: safeNumber(matches.fontSize, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.matches.fontSize, 16, 120),
      columnGap: safeNumber(matches.columnGap, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.matches.columnGap, 0, 140),
      rowGap: safeNumber(matches.rowGap, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.matches.rowGap, 0, 120),
      logoSize: safeNumber(matches.logoSize, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.matches.logoSize, 40, 200),
      logoGap: safeNumber(matches.logoGap, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.matches.logoGap, 0, 140),
      scale: safeNumber(matches.scale, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.matches.scale, 0.3, 2),
      offsetX: safeNumber(matches.offsetX, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.matches.offsetX, -900, 900),
      offsetY: safeNumber(matches.offsetY, DEFAULT_LEADERBOARD_OVERLAY_SETTINGS.matches.offsetY, -500, 500),
    },
  };
}

export function teamAbbreviation(name: string) {
  const cleaned = String(name || "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim();

  const lettersOnly = cleaned.replace(/\s+/g, "");
  if (!lettersOnly) return "XXX";

  return lettersOnly.slice(0, 3).padEnd(3, "X").toUpperCase();
}
