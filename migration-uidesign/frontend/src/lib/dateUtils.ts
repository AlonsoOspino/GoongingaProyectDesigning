/**
 * Date utilities for EST (Eastern Standard Time) handling
 * All dates in the app should be handled in EST timezone
 */

import { getServerNow } from "./serverTime";

/**
 * Returns "YYYY-MM-DD" for a given absolute timestamp, rendered in EST.
 * Used to compute day boundaries based on Eastern time rather than the
 * user's local timezone.
 */
function toEstDateKey(ts: number): string {
  // en-CA gives ISO-style YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

/**
 * Whole-day difference between two timestamps, counted in EST calendar days.
 * Positive when `toMs` is after `fromMs`. e.g. if it's 11:59pm EST Monday and
 * the target is 00:01am EST Tuesday → 1 day.
 */
export function daysBetweenEST(fromMs: number, toMs: number): number {
  const [fy, fm, fd] = toEstDateKey(fromMs).split("-").map(Number);
  const [ty, tm, td] = toEstDateKey(toMs).split("-").map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
}

/**
 * Format an ISO timestamp as a relative EST-based date label.
 *  - "Today" / "Tomorrow" / "In N days" when within a week
 *  - Otherwise a short "MMM D" date in EST
 *
 * Always measured against server time (not client clock), so a user whose
 * machine clock is wrong still sees accurate labels.
 */
export function formatRelativeEST(isoString: string): string {
  if (!isoString) return "";
  const targetMs = new Date(isoString).getTime();
  const nowMs = getServerNow();
  const diffDays = daysBetweenEST(nowMs, targetMs);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 0) {
    const abs = Math.abs(diffDays);
    if (abs === 1) return "Yesterday";
    if (abs < 7) return `${abs} days ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  }).format(new Date(targetMs));
}

/**
 * Format an ISO timestamp as "h:mm AM/PM EST".
 */
export function formatTimeEST(isoString: string): string {
  if (!isoString) return "";
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(isoString)) + " EST"
  );
}

/**
 * Returns true if `isoString` is within the next `hours` hours, measured from
 * server time. Default 24h window.
 */
export function isWithinNextHoursEST(isoString: string, hours = 24): boolean {
  if (!isoString) return false;
  const diffMs = new Date(isoString).getTime() - getServerNow();
  return diffMs >= 0 && diffMs <= hours * 60 * 60 * 1000;
}

/**
 * Number of minutes that `America/New_York` is behind UTC at the given
 * instant. 300 during EST (winter), 240 during EDT (summer). Used to
 * convert wall-clock times that the admin types into an input labelled
 * "(EST)" into the absolute UTC instant we store in the database.
 */
function getNyOffsetMinutesAt(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // `hour` may come through as "24" at midnight; normalize to 0.
  const hour = get("hour") % 24;
  const nyAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return Math.round((utcMs - nyAsUtc) / 60_000);
}

/**
 * Convert a wall-clock time in `America/New_York` (EST/EDT) into the
 * absolute UTC instant, honouring DST. We iterate once near transitions so
 * e.g. "2026-03-08 02:30" (nonexistent during the spring-forward) still
 * resolves consistently.
 */
function nyWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  // Start by pretending the wall time is UTC, then shift by the NY offset
  // at that approximate instant.
  const approx = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset1 = getNyOffsetMinutesAt(approx);
  const candidate = approx + offset1 * 60_000;
  const offset2 = getNyOffsetMinutesAt(candidate);
  const utcMs = offset1 === offset2 ? candidate : approx + offset2 * 60_000;
  return new Date(utcMs);
}

/**
 * Convert a date input (from HTML date/datetime-local input) to an ISO-8601
 * UTC string, interpreting the value as wall-clock time in EST/EDT.
 *
 * The admin-facing inputs are labelled "(EST)", but the browser's
 * `datetime-local` control produces the raw string the user typed without
 * any timezone attached. A previous implementation fed those digits straight
 * into `Date.UTC(...)`, which silently stored them as UTC — so a tournament
 * scheduled for "8:00 PM EST" ended up saved as 8:00 PM UTC (4-5h earlier
 * than intended), and the header countdown reflected that wrong instant.
 *
 * @param dateString - "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM"
 */
export function convertToISODateTime(dateString: string): string {
  if (!dateString) {
    throw new Error("Date string is required");
  }

  if (dateString.includes("T")) {
    const [datePart, timePart] = dateString.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hours, minutes] = timePart.split(":").map(Number);
    return nyWallTimeToUtc(year, month, day, hours, minutes).toISOString();
  }

  // Date-only input → interpret as 00:00 America/New_York wall time.
  const [year, month, day] = dateString.split("-").map(Number);
  return nyWallTimeToUtc(year, month, day, 0, 0).toISOString();
}

/**
 * Format an ISO-8601 DateTime for display in EST
 * @param isoString - ISO-8601 DateTime string
 * @returns Formatted date string (MM/DD/YYYY)
 */
export function formatDateEST(isoString: string): string {
  if (!isoString) return "";
  
  const date = new Date(isoString);
  
  // Format to EST (US/Eastern)
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  
  return formatter.format(date);
}

/**
 * Format an ISO-8601 DateTime for display in EST with time
 * @param isoString - ISO-8601 DateTime string
 * @returns Formatted datetime string (MM/DD/YYYY HH:MM AM/PM EST)
 */
export function formatDateTimeEST(isoString: string): string {
  if (!isoString) return "";
  
  const date = new Date(isoString);
  
  // Format to EST (US/Eastern) with time
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  
  return formatter.format(date) + " EST";
}

/**
 * Convert an ISO-8601 DateTime to a date input value (YYYY-MM-DD format)
 * @param isoString - ISO-8601 DateTime string
 * @returns Date string for HTML input (YYYY-MM-DD)
 */
export function formatForDateInput(isoString: string): string {
  if (!isoString) return "";
  
  const date = new Date(isoString);
  
  // Get EST date
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  
  return formatter.format(date);
}

/**
 * Convert an ISO-8601 DateTime to a datetime-local input value (YYYY-MM-DDTHH:MM format)
 * @param isoString - ISO-8601 DateTime string
 * @returns DateTime string for HTML input (YYYY-MM-DDTHH:MM)
 */
export function formatForDateTimeInput(isoString: string): string {
  if (!isoString) return "";
  
  const date = new Date(isoString);
  
  // Get EST date and time
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;
  const hour = parts.find(p => p.type === "hour")?.value;
  const minute = parts.find(p => p.type === "minute")?.value;
  
  return `${year}-${month}-${day}T${hour}:${minute}`;
}
