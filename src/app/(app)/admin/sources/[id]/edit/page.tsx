import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { SourceFormCard } from "@/features/sources/components/source-form-card";
import { requireAdmin } from "@/lib/auth/session";
import { getSource } from "@/lib/dal/sources";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sources.editPage");
  return { title: t("metaTitle") };
}

export default async function EditSourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const t = await getTranslations("sources");
  const { id } = await params;
  const source = await getSource(id);
  if (!source) notFound();

  return (
    <>
      <PageHeader
        title={t("editPage.title", { name: source.name })}
        description={t("connectionVerifiedNote")}
      >
        <Button size="sm" variant="outline" asChild>
          <Link href="/admin/sources">
            <ArrowLeft aria-hidden />
            {t("editPage.backToSources")}
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
