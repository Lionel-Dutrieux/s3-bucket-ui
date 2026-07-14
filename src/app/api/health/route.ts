import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/dal/health";

// Liveness/readiness probe for Docker, Kubernetes or an uptime monitor.
export async function GET() {
  try {
    await pingDatabase();
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[health] database check failed:", error);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
