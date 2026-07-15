import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { SourceFormCard } from "@/features/sources/components/source-form-card";
import { requireAdmin } from "@/lib/auth/session";
import { getSource } from "@/lib/dal/sources";

export const metadata: Metadata = { title: "Edit source" };

export default async function EditSourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const source = await getSource(id);
  if (!source) notFound();

  return (
    <>
      <PageHeader
        title={`Edit ${source.name}`}
        description="The connection is verified again when you save."
      >
        <Button size="sm" variant="outline" asChild>
          <Link href="/admin/sources">
            <ArrowLeft aria-hidden />
            Back to sources
          </Link>
        </Button>
      </PageHeader>

      <SourceFormCard
        edit={{
          sourceId: source.id,
          initialValues: {
            name: source.name,
            provider: source.provider,
            endpoint: source.endpoint,
            bucket: source.bucket,
            accessKeyId: source.accessKeyId,
            // The secret never reaches the client — blank means "keep it".
            secretAccessKey: "",
          },
        }}
      />
    </>
  );
}
