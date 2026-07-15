import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { SourceFormCard } from "@/features/sources/components/source-form-card";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add source" };

export default async function NewSourcePage() {
  await requireAdmin();

  return (
    <>
      <PageHeader
        title="Add source"
        description="Connect a storage bucket. Credentials are encrypted before they are stored."
      >
        <Button size="sm" variant="outline" asChild>
          <Link href="/admin/sources">
            <ArrowLeft aria-hidden />
            Back to sources
          </Link>
        </Button>
      </PageHeader>

      <SourceFormCard />
    </>
  );
}
