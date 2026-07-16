import { apiError } from "@/lib/api-error";
import { getBrandingSettings } from "@/lib/dal/settings";

/**
 * Serves the admin-uploaded logo. Deliberately public: the login page and
 * public share pages render it before any session exists. The URL carries a
 * version query param (bumped on upload), so responses can be immutable.
 */
export async function GET() {
  const { logo } = await getBrandingSettings();
  if (!logo) return apiError(404, "No custom logo is configured.");

  const mime = logo.slice(5, logo.indexOf(";"));
  const body = Buffer.from(logo.slice(logo.indexOf(",") + 1), "base64");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      // Neutralises scripts inside uploaded SVGs.
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
