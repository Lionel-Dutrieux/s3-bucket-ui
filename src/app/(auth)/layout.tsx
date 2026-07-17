import { Cylinder } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/layout/brand-mark";
import { getSession } from "@/lib/auth/session";
import { getBranding } from "@/lib/branding/branding";

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (await getSession()) redirect("/");
  const branding = await getBranding();
  const t = await getTranslations("auth.layout");

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

        <div className="relative p-10">
          <BrandMark branding={branding} subtitle={t("subtitle")} />
        </div>
      </section>

      {/* Form panel. */}
      <section className="flex flex-col items-center justify-center gap-8 p-6">
        <div className="lg:hidden">
          <BrandMark branding={branding} subtitle={t("subtitle")} />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}
