import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Liveness/readiness probe for Docker, Kubernetes or an uptime monitor.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[health] database check failed:", error);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
