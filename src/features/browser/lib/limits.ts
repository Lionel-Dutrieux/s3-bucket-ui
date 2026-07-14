// Tunable limits for the browser feature — presigned-URL lifetimes, preview
// sizes, and the safety caps that keep a single server action from churning
// through an unbounded prefix. Centralized so they're discoverable and
// adjustable in one place.

/** Listing page size for one folder level (`service.listFolder`). */
export const PAGE_SIZE = 200;

/** Presigned share-link lifetime (forced download) — 1 hour. */
export const SHARE_TTL_SECONDS = 3600;
/** Presigned preview-link lifetime (inline) — 10 minutes. */
export const PREVIEW_TTL_SECONDS = 600;
/** Presigned grid-thumbnail lifetime (inline) — 10 minutes. */
export const THUMBNAIL_TTL_SECONDS = 600;

/** Bytes fetched for the inline text preview (first 1 MiB of the file). */
export const TEXT_PREVIEW_MAX_BYTES = 1024 * 1024;

/** Renaming/moving a folder moves each object (copy + delete) — bounded so a
 * server action can't churn through a giant prefix. */
export const FOLDER_MOVE_MAX_OBJECTS = 1000;
/** Objects moved in parallel while renaming/moving a folder. */
export const FOLDER_MOVE_CONCURRENCY = 10;
/** Keys listed per page while collecting a folder's contents to move. */
export const FOLDER_MOVE_LIST_BATCH = 1000;

/** Matches returned by one source-wide search. */
export const SEARCH_MAX_RESULTS = 50;
/** Wall-clock budget for one search walk — a huge bucket returns partial
 * results instead of hanging the request. */
export const SEARCH_TIMEOUT_MS = 15_000;

/** Entries allowed in one folder-ZIP download (classic ZIP caps at 65 535;
 * this keeps a single request's runtime sane well before that). */
export const ZIP_MAX_ENTRIES = 5000;

/** Objects deleted per bulk call (S3 caps bulk delete at 1000 keys). */
export const DELETE_FOLDER_BATCH = 1000;
/** Re-list/delete rounds before giving up on a colossal prefix. */
export const DELETE_FOLDER_MAX_ROUNDS = 50;
/** Maximum items in one multi-select delete. */
export const DELETE_ENTRIES_MAX = 500;
/** Maximum items in one drag-and-drop move. */
export const MOVE_ENTRIES_MAX = 500;
