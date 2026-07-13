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

// SQLite's datetime('now') is "YYYY-MM-DD HH:MM:SS" in UTC with no zone —
// normalize to an ISO instant before formatting so it's not read as local.
export function formatDateTime(value: string): string {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}
