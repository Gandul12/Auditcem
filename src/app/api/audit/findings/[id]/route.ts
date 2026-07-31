import { NextResponse, type NextRequest } from "next/server";
import {
  deleteAuditFinding,
  getAuditDashboardData,
  parseFindingMutationInput,
  updateAuditFinding,
} from "@/db/audit-repository";
import { requireAuthenticatedRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

function parseId(rawId: string): number | null {
  const id = Number.parseInt(rawId, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireAuthenticatedRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id: rawId } = await context.params;
  const id = parseId(rawId);

  if (!id) {
    return NextResponse.json({ error: "ID temuan tidak valid." }, { status: 400 });
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
    await updateAuditFinding(id, input);
    const data = await getAuditDashboardData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to update audit finding", error);
    return NextResponse.json({ error: "Gagal memperbarui temuan audit." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireAuthenticatedRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id: rawId } = await context.params;
  const id = parseId(rawId);

  if (!id) {
    return NextResponse.json({ error: "ID temuan tidak valid." }, { status: 400 });
  }

  try {
    await deleteAuditFinding(id);
    const data = await getAuditDashboardData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to delete audit finding", error);
    return NextResponse.json({ error: "Gagal menghapus temuan audit." }, { status: 500 });
  }
}
