// Shared between the server page (reads the cookie) and the client toggle
// (writes it). Deliberately NOT a "use client" module: importing a value from
// a client module into a server component yields an opaque client reference,
// which is how the view cookie silently ended up never being read.
export const VIEW_COOKIE = "view";

export type ViewMode = "list" | "grid";
