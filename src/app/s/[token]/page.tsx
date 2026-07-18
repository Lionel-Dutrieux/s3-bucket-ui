import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { type BrandingInfo, BrandMark } from "@/components/layout/brand-mark";
import { categoryOf } from "@/features/browser/lib/file-types";
import { listFolder } from "@/features/browser/server/service";
import { PublicShareCard } from "@/features/shares/components/public-share-card";
import { PublicShareGallery } from "@/features/shares/components/public-share-gallery";
import { SharePasswordForm } from "@/features/shares/components/share-password-form";
import {
  type PublicFile,
  type PublicFolder,
  shareCrumbs,
} from "@/features/shares/lib/gallery";
import { sharePreviewKind } from "@/features/shares/lib/preview";
import { getBranding } from "@/lib/branding/branding";
import { getActiveShare } from "@/lib/dal/shares";
import { getSource } from "@/lib/dal/sources";
import { isPrefixShare, resolveSubPrefix } from "@/lib/shares/scope";
import { isUnlocked } from "@/lib/shares/unlock";
import { getFilesClient } from "@/lib/storage/client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shares");
  return { title: t("publicViewer.metaTitle") };
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await params;
  const branding = await getBranding();
  const t = await getTranslations("shares.publicViewer");
  // Uniform notFound() for unknown, revoked and expired alike.
  const share = await getActiveShare(token);
  if (!share) notFound();

  if (share.passwordHash && !(await isUnlocked(token))) {
    return (
      <ShareShell branding={branding}>
        <SharePasswordForm token={token} />
      </ShareShell>
    );
  }

  const source = await getSource(share.sourceId);
  if (!source) notFound();

  if (isPrefixShare(share.kind)) {
    const sp = await searchParams;
    // ?p= carries the FULL prefix the visitor navigated into. Anything not at
    // or under share.key is a 404 — the boundary that keeps the link scoped.
    const requested = typeof sp.p === "string" ? sp.p : "";
    const currentPrefix = resolveSubPrefix(share.key, requested);
    if (!currentPrefix) notFound();

    const listing = await listFolder(source, currentPrefix);
    if (!listing.ok) notFound();

    const folders: PublicFolder[] = listing.folders.map((folder) => ({
      prefix: folder.prefix,
      name: folder.name,
    }));
    const files: PublicFile[] = listing.files.map((file) => ({
      key: file.key,
      name: file.name,
      size: file.size,
      preview: sharePreviewKind(categoryOf(file.name)),
    }));

    return (
      <ShareShell branding={branding} wide>
        <PublicShareGallery
          token={token}
          crumbs={shareCrumbs(share.key, currentPrefix)}
          folders={folders}
          files={files}
        />
      </ShareShell>
    );
  }

  const filename = share.key.split("/").pop() || t("unnamedFile");
  let size: number;
  try {
    size = (await getFilesClient(source).head(share.key)).size;
  } catch {
    // The object is gone (or the source is unreachable) — the link is dead.
    notFound();
  }

  return (
    <ShareShell branding={branding}>
      <PublicShareCard
        token={token}
        filename={filename}
        size={size}
        preview={sharePreviewKind(categoryOf(filename))}
      />
    </ShareShell>
  );
}

function ShareShell({
  branding,
  children,
  wide = false,
}: {
  branding: BrandingInfo;
  children: React.ReactNode;
  /** The gallery needs room; the single-file card stays narrow. */
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-dvh justify-center bg-muted/20 p-4 sm:items-center">
      <div className={`w-full space-y-6 ${wide ? "max-w-5xl" : "max-w-lg"}`}>
        <div className="flex justify-center">
          <BrandMark branding={branding} />
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
