import { type NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { apiError } from "@/lib/api-error";
import {
  getActiveDropLink,
  releaseDropUploadSlot,
  reserveDropUploadSlot,
} from "@/lib/dal/drops";
import { recordOperation } from "@/lib/dal/operations";
import { getSource } from "@/lib/dal/sources";
import { effectiveMaxUploadBytes } from "@/lib/drops/limits";
import { isDropUnlocked } from "@/lib/drops/unlock";
import { collisionFreeName, sanitizeUploadFilename } from "@/lib/paths";
import { getFilesClient } from "@/lib/storage/client";

// Hard ceiling on one deposit — the S3 single-PUT object limit, the same as the
// authenticated upload route. A link's own maxSizeMb only ever lowers this.
const GLOBAL_MAX_UPLOAD_BYTES = 5 * 1024 ** 3; // 5 GiB

// Bound on the collision-suffix probe: after this many taken names we give up
// rather than hammering the store — practically unreachable.
const MAX_COLLISION_ATTEMPTS = 50;

class UploadTooLargeError extends Error {}

/** Passes the body through while counting bytes; errors past `maxBytes`. */
function limitBytes(body: ReadableStream<Uint8Array>, maxBytes: number) {
  let received = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > maxBytes) {
          controller.error(new UploadTooLargeError());
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

/**
 * Public deposit endpoint for a drop (reverse-share) link. The token is the
 * whole authorization: no session, uniform 404 for unknown/expired/revoked, a
 * 401 when a password is set but the unlock cookie is missing. Enforces the
 * file-count cap (atomically, race-free) and the per-file size cap, sanitizes
 * the guest filename against traversal/control characters, and never
 * overwrites — a colliding name is suffixed " (1)", " (2)"… The guest never
 * sees, and this route never returns, anything about the prefix's contents.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/d/[token]/upload">,
) {
  const { token } = await ctx.params;
  const t = await getTranslations("drops.errors");

  const drop = await getActiveDropLink(token);
  if (!drop) return apiError(404, t("notFound"));
  if (drop.passwordHash && !(await isDropUnlocked(token))) {
    return apiError(401, t("passwordRequired"));
  }
  const source = await getSource(drop.sourceId);
  if (!source) return apiError(404, t("notFound"));

  if (!request.body) return apiError(400, t("missingBody"));

  const safeName = sanitizeUploadFilename(
    request.nextUrl.searchParams.get("name") ?? "",
  );

  const maxBytes = effectiveMaxUploadBytes(
    drop.maxSizeMb,
    GLOBAL_MAX_UPLOAD_BYTES,
  );
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return apiError(413, t("tooLarge"));
  }

  // Reserve a slot before touching the store — atomic + conditional, so
  // concurrent deposits can never push past maxFiles. A full link reads here
  // exactly like an expired one from the guest's side.
  if (!(await reserveDropUploadSlot(drop.id))) {
    return apiError(409, t("limitReached"));
  }

  const files = getFilesClient(source);
  try {
    // Resolve a non-colliding key so a deposit never overwrites an existing
    // object (or a file dropped moments earlier in the same batch).
    let key = "";
    let finalName = safeName;
    let placed = false;
    for (let attempt = 0; attempt < MAX_COLLISION_ATTEMPTS; attempt++) {
      const candidate = collisionFreeName(safeName, attempt);
      const candidateKey = `${drop.prefix}${candidate}`;
      if (!(await files.exists(candidateKey))) {
        key = candidateKey;
        finalName = candidate;
        placed = true;
        break;
      }
    }
    if (!placed) {
      await releaseDropUploadSlot(drop.id);
      return apiError(409, t("nameConflict"));
    }

    await files.upload(key, limitBytes(request.body, maxBytes), {
      contentType: request.headers.get("content-type") ?? undefined,
    });

    await recordOperation({
      action: "drop-upload",
      sourceId: source.id,
      sourceName: source.name,
      target: key,
      detail: "drop-link",
      // No session on a public deposit — attribute to the (truncated) token.
      actor: `drop:${token.slice(0, 8)}`,
    });
    return NextResponse.json({ ok: true, name: finalName }, { status: 201 });
  } catch (error) {
    // The deposit never landed — hand the reserved slot back.
    await releaseDropUploadSlot(drop.id);
    if (error instanceof UploadTooLargeError) {
      return apiError(413, t("tooLarge"));
    }
    console.error(
      `[drop-upload] failed (drop=${drop.id}, provider=${source.provider}):`,
      error,
    );
    return apiError(502, t("uploadFailed"));
  }
}
