import { NextResponse, type NextRequest } from "next/server";
import {
  getAuditDashboardData,
  parseAreaScope,
  parseDomainScope,
  resetAuditState,
} from "@/db/audit-repository";
import { requireAuthenticatedRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = requireAuthenticatedRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const domain = parseDomainScope(record.domain);
  const area = parseAreaScope(record.area);

  if (domain === null || area === null) {
    return NextResponse.json({ error: "Scope reset domain/area tidak valid." }, { status: 400 });
  }

  try {
    await resetAuditState(domain, area);
    const data = await getAuditDashboardData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to reset audit state", error);
    return NextResponse.json({ error: "Gagal mereset progres audit." }, { status: 500 });
  }
}
