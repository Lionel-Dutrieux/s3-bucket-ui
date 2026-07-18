"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProviderPicker } from "@/features/sources/components/provider-picker";
import { SourceForm } from "@/features/sources/components/source-form";
import type { SourceFormValues } from "@/features/sources/lib/schema";

/**
 * The edit form on its own page — the deep-linkable surface behind "Edit"
 * in the sidebar source menu (adding and editing from the admin list use
 * SourceDialog instead). "Change" swaps the form for the provider picker in
 * place; typed values survive because the form only hides.
 */
export function SourceFormCard({
  edit,
}: {
  edit: { sourceId: string; initialValues: SourceFormValues };
}) {
  const router = useRouter();
  const [provider, setProvider] = useState(edit.initialValues.provider);
  const [picking, setPicking] = useState(false);

  return (
    <div className="max-w-xl rounded-xl border bg-card p-4 shadow-sm">
      {picking ? (
        <ProviderPicker
          localFsEnabled={false}
          onSelect={(id) => {
            setProvider(id);
            setPicking(false);
          }}
        />
      ) : null}
      <div className={picking ? "hidden" : undefined}>
        <SourceForm
          provider={provider}
          onChangeProvider={() => setPicking(true)}
          edit={edit}
          onSuccess={() => {
            router.push("/admin/sources");
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
