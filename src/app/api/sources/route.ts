import { NextResponse } from "next/server";
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
    return apiError(401, "Sign in to list sources.");
  }
  const sources = await listWritableSourcesFor(session.user);
  return NextResponse.json({ sources });
}
