// Pure size-limit logic for a drop link's per-file cap, shared by the public
// upload route (server enforcement) and the deposit UI (client hint). No I/O so
// Vitest can import it directly.

const BYTES_PER_MB = 1024 * 1024;

/**
 * The effective per-file byte ceiling for a deposit: the smaller of the link's
 * own `maxSizeMb` cap (null = none) and the instance-wide upload ceiling. The
 * global ceiling always wins when it is stricter, so a generous link can never
 * exceed what the app allows.
 */
export function effectiveMaxUploadBytes(
  maxSizeMb: number | null,
  globalMaxBytes: number,
): number {
  if (maxSizeMb === null || !Number.isFinite(maxSizeMb) || maxSizeMb <= 0) {
    return globalMaxBytes;
  }
  return Math.min(Math.floor(maxSizeMb) * BYTES_PER_MB, globalMaxBytes);
}

/**
 * Whether a declared or measured byte count is within the effective ceiling.
 * A non-finite/negative length (unknown Content-Length) is treated as within
 * bounds here — the streaming counter re-enforces the real ceiling as bytes
 * arrive, so a chunked body can't slip past.
 */
export function isWithinSizeLimit(
  bytes: number,
  maxSizeMb: number | null,
  globalMaxBytes: number,
): boolean {
  if (!Number.isFinite(bytes) || bytes < 0) return true;
  return bytes <= effectiveMaxUploadBytes(maxSizeMb, globalMaxBytes);
}
