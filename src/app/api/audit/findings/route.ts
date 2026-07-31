import { NextResponse, type NextRequest } from "next/server";
import {
  createAuditFinding,
  getAuditDashboardData,
  parseFindingMutationInput,
} from "@/db/audit-repository";
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
    return NextResponse.json({ error: "Payload temuan tidak valid." }, { status: 400 });
  }

  const input = parseFindingMutationInput(body);

  if (!input) {
    return NextResponse.json(
      { error: "Tanggal, domain, auditor, dan hasil wajib diisi dengan format valid." },
      { status: 400 },
    );
  }

  try {
    await createAuditFinding(input);
    const data = await getAuditDashboardData();
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Failed to create audit finding", error);
    return NextResponse.json({ error: "Gagal menambahkan temuan audit." }, { status: 500 });
  }
}
