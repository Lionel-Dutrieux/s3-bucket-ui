"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SourceDialog } from "@/features/sources/components/source-dialog";

/** "Add source" in the admin page header — opens the provider picker. */
export function AddSourceButton({ localFsRoots }: { localFsRoots: string[] }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("sources");

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {t("addSource")}
      </Button>
      <SourceDialog
        open={open}
        onOpenChange={setOpen}
        localFsRoots={localFsRoots}
      />
    </>
  );
}
