import { NextResponse, type NextRequest } from "next/server";
import { getAuditDashboardData, setAuditItemChecked } from "@/db/audit-repository";
import { requireAuthenticatedRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireAuthenticatedRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await context.params;
  const itemId = Number.parseInt(id, 10);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "ID checklist tidak valid." }, { status: 400 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload checklist tidak valid." }, { status: 400 });
  }

  const checked =
    body && typeof body === "object" && "checked" in body
      ? (body as { checked?: unknown }).checked
      : undefined;

  if (typeof checked !== "boolean") {
    return NextResponse.json({ error: "Nilai checked harus boolean." }, { status: 400 });
  }

  try {
    await setAuditItemChecked(itemId, checked);
    const data = await getAuditDashboardData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to update checklist item", error);
    return NextResponse.json({ error: "Gagal memperbarui checklist." }, { status: 500 });
  }
}
