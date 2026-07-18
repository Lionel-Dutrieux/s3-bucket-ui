/** Window event asking the current source browser to open its source-wide
 * search. Dispatched by the Ctrl/Cmd+K palette, which lives in another tree —
 * same decoupling pattern as OPEN_COMMAND_PALETTE_EVENT. */
export const OPEN_SOURCE_SEARCH_EVENT = "bucket-ui:source-search";
