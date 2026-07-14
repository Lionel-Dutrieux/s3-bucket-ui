import { Cylinder, FolderTree, KeyRound, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

const HIGHLIGHTS = [
  {
    icon: FolderTree,
    title: "Every bucket, one interface",
    body: "R2, S3, GCS, Azure, MinIO — browse, preview and share from a single clean UI.",
  },
  {
    icon: Users,
    title: "Access that fits your team",
    body: "Grant sources to people or groups; edit and delete stay opt-in per source.",
  },
  {
    icon: KeyRound,
    title: "Credentials stay server-side",
    body: "Bucket keys are encrypted at rest and never reach the browser.",
  },
] as const;

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (await getSession()) redirect("/");

  return (
    <main className="grid min-h-svh flex-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel — desktop only. */}
      <section className="relative hidden overflow-hidden border-r bg-muted/30 lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-40 size-[32rem] rounded-full bg-amber-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-48 -bottom-48 size-[28rem] rounded-full bg-amber-500/5 blur-3xl"
        />

        <div className="relative flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
            <Cylinder className="size-4.5" aria-hidden />
          </div>
          <div className="grid leading-tight">
            <span className="font-semibold tracking-tight">Bucket UI</span>
            <span className="text-xs text-muted-foreground">File manager</span>
          </div>
        </div>

        <div className="relative max-w-md space-y-8">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Your storage buckets, with a file manager worth using.
          </h1>
          <ul className="space-y-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-amber-600">
                  <item.icon className="size-4" aria-hidden />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">
          Open source — self-hosted, your data never leaves your infrastructure.
        </p>
      </section>

      {/* Form panel. */}
      <section className="flex flex-col items-center justify-center gap-8 p-6">
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
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
