import { NextResponse, type NextRequest } from "next/server";
import {
  getAuditDashboardData,
  parsePlannerMutationInput,
  updateWeeklyPlanner,
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
    return NextResponse.json({ error: "Payload planner tidak valid." }, { status: 400 });
  }

  const input = parsePlannerMutationInput(body);

  if (!input) {
    return NextResponse.json(
      { error: "Planner membutuhkan id valid, status/domain/focus opsional yang valid." },
      { status: 400 },
    );
  }

  try {
    await updateWeeklyPlanner(input);
    const data = await getAuditDashboardData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to update weekly planner", error);
    return NextResponse.json({ error: "Gagal memperbarui weekly planner." }, { status: 500 });
  }
}
