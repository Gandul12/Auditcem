import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/DashboardClient";
import { getAuditDashboardData } from "@/db/audit-repository";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const data = await getAuditDashboardData();

  return <DashboardClient initialData={data} />;
}
