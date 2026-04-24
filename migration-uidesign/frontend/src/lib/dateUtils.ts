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
 * Convert a date input (from HTML date/datetime-local input) to ISO-8601 DateTime in EST
 * @param dateString - Date string from input (YYYY-MM-DD or YYYY-MM-DDTHH:MM)
 * @returns ISO-8601 DateTime string
 */
export function convertToISODateTime(dateString: string): string {
  if (!dateString) {
    throw new Error("Date string is required");
  }

  const date = new Date(dateString);
  
  // If datetime-local input, parse it correctly
  if (dateString.includes("T")) {
    const [datePart, timePart] = dateString.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hours, minutes] = timePart.split(":").map(Number);
    
    // Create date in UTC first, then adjust for EST
    const dateUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
    
    // Convert to ISO string (this will be in UTC)
    return dateUtc.toISOString();
  } else {
    // For date-only input, set to 00:00 EST and convert to ISO
    const [year, month, day] = dateString.split("-").map(Number);
    
    // EST is UTC-5, so 00:00 EST = 05:00 UTC
    const dateUtc = new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
    
    return dateUtc.toISOString();
  }
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
