import { Cylinder } from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (await getSession()) redirect("/");

  return (
    <main className="grid min-h-svh flex-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel — desktop only, purely visual. */}
      <section className="relative hidden overflow-hidden border-r bg-muted/30 lg:block">
        {/* Subtle dot grid. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-40 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:24px_24px]"
        />
        {/* Soft brand glows. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-40 size-[34rem] rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-48 -bottom-48 size-[30rem] rounded-full bg-primary/5 blur-3xl"
        />
        {/* Watermark. */}
        <Cylinder
          aria-hidden
          strokeWidth={0.5}
          className="pointer-events-none absolute -right-24 -bottom-28 size-[26rem] -rotate-12 text-primary/10"
        />

        <div className="relative flex items-center gap-2.5 p-10">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Cylinder className="size-4.5" aria-hidden />
          </div>
          <div className="grid leading-tight">
            <span className="font-semibold tracking-tight">Bucket UI</span>
            <span className="text-xs text-muted-foreground">File manager</span>
          </div>
        </div>
      </section>

      {/* Form panel. */}
      <section className="flex flex-col items-center justify-center gap-8 p-6">
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Cylinder className="size-4.5" aria-hidden />
          </div>
          <div className="grid leading-tight">
            <span className="font-semibold tracking-tight">Bucket UI</span>
            <span className="text-xs text-muted-foreground">File manager</span>
          </div>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}
