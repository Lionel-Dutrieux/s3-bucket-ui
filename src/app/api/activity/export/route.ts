import { type NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { apiError } from "@/lib/api-error";
import { currentAdmin } from "@/lib/auth/session";
import { exportOperations, type OperationRecord } from "@/lib/dal/operations";

const EXPORT_CAP = 50_000;

/** Wraps a field in double quotes (doubling internal quotes) if it needs it. */
function csvField(value: string | null): string {
  if (value == null) return "";
  // Neutralize spreadsheet formula injection: a leading =, +, -, @, tab or CR
  // makes Excel/Sheets interpret the cell as a formula when opened.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function toCsv(records: OperationRecord[]): string {
  const header = [
    "created_at",
    "action",
    "source_name",
    "target",
    "detail",
    "actor",
  ];
  const rows = records.map((record) =>
    [
      record.createdAt.toISOString(),
      record.action,
      record.sourceName,
      record.target,
      record.detail,
      record.actor,
    ]
      .map(csvField)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/**
 * Audit log export (admin-only): CSV or JSON of the operations table, same
 * filters as the activity page. Route handler, not a page — a plain 404
 * (no redirect) is the right denial for non-admins here.
 */
export async function GET(request: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) {
    const t = await getTranslations("api.errors");
    return apiError(404, t("notFound"));
  }

  const { searchParams } = request.nextUrl;
  const format = searchParams.get("format") === "json" ? "json" : "csv";
  const action = searchParams.get("action") ?? undefined;
  const sourceName = searchParams.get("source") ?? undefined;
  const q = searchParams.get("q") ?? undefined;

  const records = await exportOperations({
    action: action || undefined,
    sourceName: sourceName || undefined,
    q: q || undefined,
  });

  const truncated = records.length === EXPORT_CAP;
  if (truncated) {
    console.warn(
      `[activity export] hit the ${EXPORT_CAP}-row cap — export truncated`,
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  const body = format === "json" ? JSON.stringify(records) : toCsv(records);
  const contentType =
    format === "json" ? "application/json" : "text/csv; charset=utf-8";

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="audit-${date}.${format}"`,
      ...(truncated ? { "X-Audit-Truncated": "true" } : {}),
    },
  });
}
