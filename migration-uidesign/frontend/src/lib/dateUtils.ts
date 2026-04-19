/**
 * Date utilities for EST (Eastern Standard Time) handling
 * All dates in the app should be handled in EST timezone
 */

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
