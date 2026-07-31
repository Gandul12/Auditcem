import { NextResponse, type NextRequest } from "next/server";
import {
  getAuditDashboardData,
  parseAreaScope,
  parseCycleMonthInput,
  parseCycleStatusInput,
  updateMonthlyCycle,
} from "@/db/audit-repository";
import { isDomainId } from "@/lib/audit-config";
import { requireAuthenticatedRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = requireAuthenticatedRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload cycle tidak valid." }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const area = record ? parseAreaScope(record.area) : null;
  const domain = record && isDomainId(record.domain) ? record.domain : null;
  const cycleMonth = record ? parseCycleMonthInput(record.cycleMonth) : null;
  const status = record ? parseCycleStatusInput(record.status) : null;

  if (!area || !domain || !cycleMonth || !status) {
    return NextResponse.json(
      { error: "Area, domain, bulan siklus, atau status tidak valid." },
      { status: 400 },
    );
  }

  try {
    await updateMonthlyCycle(area, domain, cycleMonth, status);
    const data = await getAuditDashboardData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to update monthly cycle", error);
    return NextResponse.json({ error: "Gagal memperbarui siklus bulanan." }, { status: 500 });
  }
}
