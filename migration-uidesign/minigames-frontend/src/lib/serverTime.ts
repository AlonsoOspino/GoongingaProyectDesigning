/**
 * Server time synchronization.
 *
 * The backend's clock is the source of truth. Client clocks can be:
 *  - wrong (manually set by the user)
 *  - skewed (NTP out of sync)
 *  - in any timezone (but this module deals in absolute UTC milliseconds,
 *    so timezone is irrelevant here — EST formatting is done at the display
 *    layer via Intl.DateTimeFormat with timeZone: "America/New_York").
 *
 * We piggy-back on the standard HTTP `Date` response header (RFC 9110 §6.6.1),
 * which every HTTP/1.1 server returns. On every API response we compute:
 *     offset = serverDate - clientDate
 * and expose `getServerNow()` which returns `Date.now() + offset`.
 *
 * This requires no new backend endpoint; any API call refreshes the offset.
 *
 * Notes:
 *  - The HTTP Date header has 1-second precision, so offset has ±500ms error.
 *    That's fine for match/tournament/draft-phase countdowns.
 *  - Before the first API response arrives, offset = 0, so `getServerNow()`
 *    falls back to the client clock.
 */

let serverOffsetMs = 0;
let lastSyncAt = 0;

/**
 * Update the server/client clock offset from an HTTP `Date` response header.
 * Safe to call with null/undefined/invalid values — it will be ignored.
 */
export function setServerTimeFromDateHeader(header: string | null | undefined): void {
  if (!header) return;
  const parsed = Date.parse(header);
  if (Number.isNaN(parsed)) return;
  serverOffsetMs = parsed - Date.now();
  lastSyncAt = Date.now();
}

/**
 * Current time according to the server clock, in UTC milliseconds since epoch.
 * Falls back to client `Date.now()` if no API call has happened yet.
 */
export function getServerNow(): number {
  return Date.now() + serverOffsetMs;
}

/**
 * Offset in milliseconds: serverTime - clientTime.
 * Positive means the client clock is behind the server.
 */
export function getServerOffsetMs(): number {
  return serverOffsetMs;
}

/**
 * Timestamp (client clock) of the last successful sync.
 * 0 means we've never synced.
 */
export function getLastSyncAt(): number {
  return lastSyncAt;
}
