import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <FileQuestion className="size-5" aria-hidden />
        </div>
        <h1 className="text-base font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          This page doesn&apos;t exist — the source may have been removed.
        </p>
        <Button variant="outline" size="sm" asChild className="mt-1">
          <Link href="/">Back to sources</Link>
        </Button>
      </div>
    </main>
  );
}
