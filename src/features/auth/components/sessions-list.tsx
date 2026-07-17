"use client";

import { MonitorSmartphone, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { formatDateTime } from "@/lib/format";

export interface SessionRow {
  token: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  current: boolean;
}

/** Loopback/unspecified addresses (local dev, no proxy) carry no signal. */
function describeIp(ip: string | null): string | null {
  if (!ip) return null;
  const compact = ip.replaceAll("0", "").replaceAll(":", "");
  if (compact === "" || ip === "::1" || ip.startsWith("127.")) return null;
  return ip;
}

/** Compact "Chrome · Windows"-style summary out of a raw user agent. */
function describeAgent(
  userAgent: string | null,
  unknownDeviceLabel: string,
  unknownOsLabel: string,
): string {
  if (!userAgent) return unknownDeviceLabel;
  const browser =
    ["Edg", "OPR", "Firefox", "Chrome", "Safari"].find((name) =>
      userAgent.includes(name),
    ) ?? "Browser";
  const os =
    ["Windows", "Mac OS X", "Android", "iPhone", "iPad", "Linux"].find((name) =>
      userAgent.includes(name),
    ) ?? unknownOsLabel;
  const names: Record<string, string> = { Edg: "Edge", OPR: "Opera" };
  return `${names[browser] ?? browser} · ${os.replace("Mac OS X", "macOS")}`;
}

export function SessionsList({ sessions }: { sessions: SessionRow[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations("account.sessions");

  const revoke = (token: string) => {
    startTransition(async () => {
      const { error } = await authClient.revokeSession({ token });
      if (error) {
        toast.error(error.message ?? t("revokeError"));
        return;
      }
      toast.success(t("revokeSuccess"));
      router.refresh();
    });
  };

  return (
    <ul className="divide-y">
      {sessions.map((session) => (
        <li key={session.token} className="flex items-center gap-3 py-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
            <MonitorSmartphone className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {describeAgent(
                session.userAgent,
                t("unknownDevice"),
                t("unknownOs"),
              )}
              {session.current ? (
                <span className="ml-1.5 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  {t("thisDevice")}
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {(() => {
                const ip = describeIp(session.ipAddress);
                return ip ? `${ip} · ` : "";
              })()}
              {t("activeAt", { time: formatDateTime(session.updatedAt) })}
            </p>
          </div>
          {session.current ? null : (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              disabled={pending}
              onClick={() => revoke(session.token)}
              aria-label={t("revokeAria")}
            >
              <X className="size-4" aria-hidden />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
