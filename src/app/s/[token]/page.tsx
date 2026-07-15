import { Cylinder } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categoryOf } from "@/features/browser/lib/file-types";
import { PublicShareCard } from "@/features/shares/components/public-share-card";
import { SharePasswordForm } from "@/features/shares/components/share-password-form";
import { sharePreviewKind } from "@/features/shares/lib/preview";
import { getActiveShare } from "@/lib/dal/shares";
import { getSource } from "@/lib/dal/sources";
import { isUnlocked } from "@/lib/shares/unlock";
import { getFilesClient } from "@/lib/storage/client";

export const metadata: Metadata = { title: "Shared file" };

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Uniform notFound() for unknown, revoked and expired alike.
  const share = await getActiveShare(token);
  if (!share) notFound();

  if (share.passwordHash && !(await isUnlocked(token))) {
    return (
      <ShareShell>
        <SharePasswordForm token={token} />
      </ShareShell>
    );
  }

  const source = await getSource(share.sourceId);
  if (!source) notFound();

  const filename = share.key.split("/").pop() || "file";
  let size: number;
  try {
    size = (await getFilesClient(source).head(share.key)).size;
  } catch {
    // The object is gone (or the source is unreachable) — the link is dead.
    notFound();
  }

  return (
    <ShareShell>
      <PublicShareCard
        token={token}
        filename={filename}
        size={size}
        preview={sharePreviewKind(categoryOf(filename))}
      />
    </ShareShell>
  );
}

function ShareShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Cylinder className="size-4" aria-hidden />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Bucket UI
          </span>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
