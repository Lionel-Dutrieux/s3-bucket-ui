const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  // One decimal under 10 units, none otherwise — and never a trailing ".0".
  const rounded =
    value >= 10 || exponent === 0
      ? Math.round(value)
      : Math.round(value * 10) / 10;
  return `${rounded} ${UNITS[exponent]}`;
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatDate(timestamp?: number): string {
  if (!timestamp) return "—";
  return dateFormatter.format(new Date(timestamp));
}

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

// Timestamps come from Postgres as Date instances (timestamptz). Guard against
// an invalid date rather than throwing in the render path.
export function formatDateTime(value: Date): string {
  return Number.isNaN(value.getTime()) ? "—" : dateTimeFormatter.format(value);
}

const relativeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

/**
 * "2 hours ago" / "yesterday" for anything under a week, the plain date
 * beyond that — pair it with the exact date in a title/tooltip.
 */
export function formatRelative(input?: number | Date): string {
  if (input === undefined) return "—";
  const time = input instanceof Date ? input.getTime() : input;
  if (Number.isNaN(time)) return "—";
  const seconds = Math.round((time - Date.now()) / 1000);
  const elapsed = Math.abs(seconds);
  if (elapsed < 60) return "just now";
  if (elapsed < 3600) {
    return relativeFormatter.format(Math.trunc(seconds / 60), "minute");
  }
  if (elapsed < 86400) {
    return relativeFormatter.format(Math.trunc(seconds / 3600), "hour");
  }
  if (elapsed < 7 * 86400) {
    return relativeFormatter.format(Math.trunc(seconds / 86400), "day");
  }
  return dateFormatter.format(new Date(time));
}
