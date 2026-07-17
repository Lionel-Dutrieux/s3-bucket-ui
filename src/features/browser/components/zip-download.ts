"use client";

// A form POST is the one browser mechanism that both streams the response
// straight to disk (like a link click) and carries hundreds of keys without
// URL-length limits — fetch would buffer the archive in memory.

export interface ZipSelection {
  /** The folder the selection lives in — entries archive relative to it. */
  base: string;
  keys: string[];
  prefixes: string[];
}

/** Submits a transient hidden form POSTing the selection to the ZIP route. */
export function submitZipDownload(action: string, selection: ZipSelection) {
  const form = document.createElement("form");
  form.method = "post";
  form.action = action;
  const add = (name: string, value: string) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };
  add("base", selection.base);
  for (const key of selection.keys) add("key", key);
  for (const prefix of selection.prefixes) add("prefix", prefix);
  document.body.appendChild(form);
  form.submit();
  form.remove();
}
