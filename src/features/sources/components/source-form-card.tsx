"use client";

import { useRouter } from "next/navigation";
import { SourceForm } from "@/features/sources/components/source-form";
import type { SourceFormValues } from "@/features/sources/lib/schema";

/**
 * The source form on its own page (add/edit): a card wide enough for the
 * provider select, credentials and connection test — the space a modal
 * never had. Saving returns to the sources list.
 */
export function SourceFormCard({
  edit,
}: {
  /** When set, the form edits an existing source instead of creating one. */
  edit?: { sourceId: string; initialValues: SourceFormValues };
}) {
  const router = useRouter();

  return (
    <div className="max-w-xl rounded-xl border bg-card p-4 shadow-sm">
      <SourceForm
        edit={edit}
        onSuccess={() => {
          router.push("/admin/sources");
          router.refresh();
        }}
      />
    </div>
  );
}
