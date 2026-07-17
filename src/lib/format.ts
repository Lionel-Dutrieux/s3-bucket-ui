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

const DEFAULT_LOCALE = "en";

// Intl formatters are expensive to construct — cache one per locale.
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();

function dateFormatter(locale: string): Intl.DateTimeFormat {
  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    dateFormatters.set(locale, formatter);
  }
  return formatter;
}

function dateTimeFormatter(locale: string): Intl.DateTimeFormat {
  let formatter = dateTimeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    dateTimeFormatters.set(locale, formatter);
  }
  return formatter;
}

function relativeFormatter(locale: string): Intl.RelativeTimeFormat {
  let formatter = relativeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    relativeFormatters.set(locale, formatter);
  }
  return formatter;
}

export function formatDate(
  timestamp?: number,
  locale: string = DEFAULT_LOCALE,
): string {
  if (!timestamp) return "—";
  return dateFormatter(locale).format(new Date(timestamp));
}

// Timestamps come from Postgres as Date instances (timestamptz). Guard against
// an invalid date rather than throwing in the render path.
export function formatDateTime(
  value: Date,
  locale: string = DEFAULT_LOCALE,
): string {
  return Number.isNaN(value.getTime())
    ? "—"
    : dateTimeFormatter(locale).format(value);
}

/**
 * "2 hours ago" / "yesterday" for anything under a week, the plain date
 * beyond that — pair it with the exact date in a title/tooltip.
 */
export function formatRelative(
  input?: number | Date,
  locale: string = DEFAULT_LOCALE,
): string {
  if (input === undefined) return "—";
  const time = input instanceof Date ? input.getTime() : input;
  if (Number.isNaN(time)) return "—";
  const seconds = Math.round((time - Date.now()) / 1000);
  const elapsed = Math.abs(seconds);
  const relative = relativeFormatter(locale);
  if (elapsed < 60) return relative.format(0, "second");
  if (elapsed < 3600)
    return relative.format(Math.trunc(seconds / 60), "minute");
  if (elapsed < 86400)
    return relative.format(Math.trunc(seconds / 3600), "hour");
  if (elapsed < 7 * 86400) {
    return relative.format(Math.trunc(seconds / 86400), "day");
  }
  return dateFormatter(locale).format(new Date(time));
}
