import { NextResponse, type NextRequest } from "next/server";
import {
  getAuditDashboardData,
  parseActiveMonthInput,
  setActiveMonth,
} from "@/db/audit-repository";
import { requireAuthenticatedRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAuthenticatedRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload setting tidak valid." }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const activeMonth = record ? parseActiveMonthInput(record.activeMonth) : null;

  if (!activeMonth) {
    return NextResponse.json({ error: "Bulan aktif harus Bulan 4, 5, atau 6." }, { status: 400 });
  }

  try {
    await setActiveMonth(activeMonth);
    const data = await getAuditDashboardData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to update active month", error);
    return NextResponse.json({ error: "Gagal menyimpan bulan aktif." }, { status: 500 });
  }
}
