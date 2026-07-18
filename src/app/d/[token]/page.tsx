import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { type BrandingInfo, BrandMark } from "@/components/layout/brand-mark";
import { DropPasswordForm } from "@/features/drops/components/drop-password-form";
import { DropUploader } from "@/features/drops/components/drop-uploader";
import { getBranding } from "@/lib/branding/branding";
import { getActiveDropLink } from "@/lib/dal/drops";
import { isDropUnlocked } from "@/lib/drops/unlock";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("drops");
  return { title: t("publicUploader.metaTitle") };
}

export default async function DropPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const branding = await getBranding();

  // Uniform notFound() for unknown, revoked, expired and links whose source has
  // public sharing switched off alike — the token's existence is never leaked.
  const drop = await getActiveDropLink(token);
  if (!drop) notFound();

  if (drop.passwordHash && !(await isDropUnlocked(token))) {
    return (
      <DropShell branding={branding}>
        <DropPasswordForm token={token} />
      </DropShell>
    );
  }

  const remaining =
    drop.maxFiles === null
      ? null
      : Math.max(drop.maxFiles - drop.uploadsCount, 0);

  return (
    <DropShell branding={branding}>
      <DropUploader
        token={token}
        note={drop.note}
        maxSizeMb={drop.maxSizeMb}
        remaining={remaining}
      />
    </DropShell>
  );
}

function DropShell({
  branding,
  children,
}: {
  branding: BrandingInfo;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh justify-center bg-muted/20 p-4 sm:items-center">
      <div className="w-full max-w-lg space-y-6">
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
