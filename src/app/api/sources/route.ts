import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { apiError } from "@/lib/api-error";
import { getSession } from "@/lib/auth/session";
import { listWritableSourcesFor } from "@/lib/dal/sources";

/**
 * Sources the signed-in user can write into — feeds the destination picker
 * of the cross-source copy dialog. Names/buckets only, never credentials.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    const t = await getTranslations("api.errors");
    return apiError(401, t("signInRequired"));
  }
  const sources = await listWritableSourcesFor(session.user);
  return NextResponse.json({ sources });
}
