"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/i18n/config";
import { actionClient } from "@/lib/safe-action";
import { localeSchema } from "./lib/locale-schema";

/**
 * Persists the visitor's locale preference in a cookie. No auth required — the
 * preference applies to signed-out visitors too.
 */
export const setLocale = actionClient
  .metadata({ actionName: "auth.setLocale" })
  .inputSchema(localeSchema)
  .action(async ({ parsedInput: { locale } }) => {
    const store = await cookies();
    store.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  });
