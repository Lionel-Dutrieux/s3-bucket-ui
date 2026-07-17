import { type NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { apiError } from "@/lib/api-error";
import { requireSourceAccess } from "@/lib/auth/access";
import { recordOperation } from "@/lib/dal/operations";
import { getFilesClient } from "@/lib/storage/client";

// Hard ceiling on one upload — the S3 single-PUT object limit. Checked on the
// declared Content-Length and re-enforced on the actual stream, so a chunked
// body can't sidestep it.
const MAX_UPLOAD_BYTES = 5 * 1024 ** 3; // 5 GiB
const TOO_LARGE = "File is too large — 5 GiB max.";

class UploadTooLargeError extends Error {}

/** Passes the body through while counting bytes; errors past the ceiling. */
function limitBytes(body: ReadableStream<Uint8Array>) {
  let received = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > MAX_UPLOAD_BYTES) {
          controller.error(new UploadTooLargeError(TOO_LARGE));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

/**
 * Receives one file body and streams it into the bucket. The client uses
 * XMLHttpRequest against this route because fetch() has no upload progress —
 * and going through the app (instead of a presigned PUT straight to the
 * bucket) avoids requiring CORS configuration on every bucket.
 *
 * The edit capability is enforced here, server-side — hiding the upload UI
 * is cosmetic, this check is the real gate.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/sources/[id]/upload">,
) {
  const { id } = await ctx.params;
  const key = request.nextUrl.searchParams.get("key");
  if (!key || key.endsWith("/")) {
    const t = await getTranslations("api.errors");
    return apiError(400, t("invalidKey"));
  }

  // 404 whether the source is missing or the user has no read grant.
  const result = await requireSourceAccess(id);
  if (!result) {
    const t = await getTranslations("browser.errors");
    return apiError(404, t("sourceNotFound"));
  }
  const { source, access } = result;
  if (!access.canEdit) {
    const t = await getTranslations("api.errors");
    return apiError(403, t("uploadNotAllowed"));
  }

  if (!request.body) {
    const t = await getTranslations("api.errors");
    return apiError(400, t("missingBody"));
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    const t = await getTranslations("api.errors");
    return apiError(413, t("uploadTooLarge"));
  }

  try {
    await getFilesClient(source).upload(key, limitBytes(request.body), {
      contentType: request.headers.get("content-type") ?? undefined,
    });
    await recordOperation({
      action: "upload",
      sourceId: source.id,
      sourceName: source.name,
      target: key,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadTooLargeError) {
      const t = await getTranslations("api.errors");
      return apiError(413, t("uploadTooLarge"));
    }
    console.error(
      `[upload] failed (source=${source.id}, provider=${source.provider}):`,
      error,
    );
    const t = await getTranslations("api.errors");
    return apiError(502, t("uploadFailed"));
  }
}
