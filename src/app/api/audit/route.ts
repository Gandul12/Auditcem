import { NextResponse, type NextRequest } from "next/server";
import { getAuditDashboardData } from "@/db/audit-repository";
import { requireAuthenticatedRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = requireAuthenticatedRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const data = await getAuditDashboardData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to load audit dashboard", error);
    return NextResponse.json({ error: "Gagal memuat data audit." }, { status: 500 });
  }
}
