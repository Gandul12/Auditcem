import "dotenv/config";
import { closeDb } from "./index";
import { ensureAuditSeedData, getAuditDashboardData } from "./audit-repository";

async function main() {
  await ensureAuditSeedData();
  const data = await getAuditDashboardData();

  console.log(
    `Seed complete: ${data.items.length} checklist items, ${data.cycles.length} cycle rows, ${data.findings.length} findings, ${data.planner.length} planner rows.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
