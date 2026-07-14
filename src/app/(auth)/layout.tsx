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
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
          <Cylinder className="size-4.5" aria-hidden />
        </div>
        <div className="grid leading-tight">
          <span className="font-semibold tracking-tight">Bucket UI</span>
          <span className="text-xs text-muted-foreground">File manager</span>
        </div>
      </div>
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}
