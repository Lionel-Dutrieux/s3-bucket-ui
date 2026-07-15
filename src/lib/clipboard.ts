/**
 * Copies text to the clipboard, working outside secure contexts too:
 * navigator.clipboard only exists on HTTPS/localhost, so a plain-HTTP LAN
 * deployment silently loses the modern path — fall back to the legacy
 * textarea + execCommand approach there. Returns false when both paths
 * fail, so callers can surface an explicit error instead of silence.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Blocked (permissions, insecure context lies) — try the legacy path.
    }
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}
