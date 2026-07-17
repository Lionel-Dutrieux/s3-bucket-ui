"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/i18n/config";
import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { localeSchema } from "./lib/locale-schema";

export async function setLocale(input: unknown): Promise<ActionResult> {
  const parsed = localeSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid locale");
  const store = await cookies();
  store.set(LOCALE_COOKIE, parsed.data.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return actionOk();
}
