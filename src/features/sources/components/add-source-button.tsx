"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SourceDialog } from "@/features/sources/components/source-dialog";

/** "Add source" in the admin page header — opens the provider picker. */
export function AddSourceButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Add source
      </Button>
      <SourceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
