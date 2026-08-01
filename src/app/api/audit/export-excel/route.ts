import ExcelJS from "exceljs";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditFindings, auditItems } from "@/db/schema";
import {
  AUDIT_AREAS,
  AUDIT_DOMAINS,
  isAuditArea,
  isAuditResult,
  isDomainId,
  isPriority,
  type AuditArea,
  type AuditResult,
  type DomainId,
  type Priority,
} from "@/lib/audit-config";
import { generateAuditInsight } from "@/lib/auditInsight";
import { requireAuthenticatedRequest } from "@/lib/auth";
import type { AuditFindingRecord, AuditItemRecord } from "@/lib/audit-types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADER_FILL = "FF0F172A";
const HEADER_FONT = "FFFFFFFF";

function toIsoString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

function toDateOnly(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function serializeItem(row: typeof auditItems.$inferSelect): AuditItemRecord {
  return {
    id: row.id,
    area: isAuditArea(row.area) ? row.area : "Cutting",
    domain: isDomainId(row.domain) ? row.domain : "MQAA",
    description: row.description,
    priority: isPriority(row.priority) ? row.priority : "PENTING",
    checked: row.checked,
    sortOrder: row.sortOrder,
    updatedAt: toIsoString(row.updatedAt),
  };
}

function serializeFinding(row: typeof auditFindings.$inferSelect): AuditFindingRecord {
  return {
    id: row.id,
    date: toDateOnly(row.date),
    area: isAuditArea(row.area) ? row.area : "Cutting",
    domain: isDomainId(row.domain) ? row.domain : "MQAA",
    auditor: row.auditor,
    result: isAuditResult(row.result) ? row.result : "Partial",
    rootCause: row.rootCause,
    actionPlan: row.actionPlan,
    lessonLearned: row.lessonLearned,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function percentage(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      bottom: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });
}

function autoFitColumns(worksheet: ExcelJS.Worksheet): void {
  worksheet.columns.forEach((column) => {
    let maxLength = 12;

    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      const text = value === null || value === undefined ? "" : String(value);
      maxLength = Math.max(maxLength, Math.min(text.length + 2, 64));
    });

    column.width = Math.max(12, Math.min(maxLength, 64));
  });
}

function addChecklistSheet(workbook: ExcelJS.Workbook, items: AuditItemRecord[]): void {
  const worksheet = workbook.addWorksheet("Checklist", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = [
    { header: "Area", key: "area" },
    { header: "Domain", key: "domain" },
    { header: "Deskripsi", key: "description" },
    { header: "Prioritas", key: "priority" },
    { header: "Status", key: "status" },
    { header: "Terakhir Update", key: "updatedAt" },
  ];

  items.forEach((item) => {
    worksheet.addRow({
      area: item.area,
      domain: item.domain,
      description: item.description,
      priority: item.priority,
      status: item.checked ? "✓" : "belum",
      updatedAt: formatDateTime(item.updatedAt),
    });
  });

  styleHeaderRow(worksheet.getRow(1));
  autoFitColumns(worksheet);
}

function addFindingsSheet(workbook: ExcelJS.Workbook, findings: AuditFindingRecord[]): void {
  const worksheet = workbook.addWorksheet("Temuan", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = [
    { header: "Tanggal", key: "date" },
    { header: "Area", key: "area" },
    { header: "Domain", key: "domain" },
    { header: "Auditor", key: "auditor" },
    { header: "Hasil", key: "result" },
    { header: "Root Cause", key: "rootCause" },
    { header: "Action Plan", key: "actionPlan" },
    { header: "Lesson Learned", key: "lessonLearned" },
  ];

  findings.forEach((finding) => {
    worksheet.addRow({
      date: finding.date,
      area: finding.area,
      domain: finding.domain,
      auditor: finding.auditor,
      result: finding.result,
      rootCause: finding.rootCause,
      actionPlan: finding.actionPlan,
      lessonLearned: finding.lessonLearned,
    });
  });

  styleHeaderRow(worksheet.getRow(1));
  autoFitColumns(worksheet);
}

function getDomainSummaryRows(items: AuditItemRecord[]) {
  return AUDIT_AREAS.flatMap((area) =>
    AUDIT_DOMAINS.map((domain) => {
      const scopedItems = items.filter((item) => item.area === area && item.domain === domain.id);
      const done = scopedItems.filter((item) => item.checked).length;
      const total = scopedItems.length;

      return {
        area,
        domain: domain.title,
        done,
        total,
        percentage: `${percentage(done, total)}%`,
      };
    }),
  );
}

function addInsightSheet(
  workbook: ExcelJS.Workbook,
  items: AuditItemRecord[],
  findings: AuditFindingRecord[],
): void {
  const worksheet = workbook.addWorksheet("Ringkasan & Insight", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const insights = generateAuditInsight(items, findings);

  worksheet.mergeCells("A1:E1");
  worksheet.getCell("A1").value = "Ringkasan & Insight";
  styleHeaderRow(worksheet.getRow(1));

  worksheet.addRow([]);
  const insightHeader = worksheet.addRow(["No", "Insight Otomatis"]);
  styleHeaderRow(insightHeader);
  insights.forEach((insight, index) => {
    worksheet.addRow([index + 1, insight]);
  });

  worksheet.addRow([]);
  const summaryHeader = worksheet.addRow([
    "Area",
    "Domain",
    "Item Selesai",
    "Total Item",
    "Persentase",
  ]);
  styleHeaderRow(summaryHeader);

  getDomainSummaryRows(items).forEach((row) => {
    worksheet.addRow([row.area, row.domain, row.done, row.total, row.percentage]);
  });

  worksheet.getColumn(2).alignment = { wrapText: true };
  autoFitColumns(worksheet);
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAuthenticatedRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const [itemRows, findingRows] = await Promise.all([
    db.select().from(auditItems),
    db.select().from(auditFindings).orderBy(desc(auditFindings.date), desc(auditFindings.id)),
  ]);
  const items = itemRows.map(serializeItem).sort((first, second) => {
    const areaDiff = AUDIT_AREAS.indexOf(first.area as AuditArea) - AUDIT_AREAS.indexOf(second.area as AuditArea);
    const domainDiff =
      AUDIT_DOMAINS.findIndex((domain) => domain.id === first.domain) -
      AUDIT_DOMAINS.findIndex((domain) => domain.id === second.domain);
    return areaDiff || domainDiff || first.sortOrder - second.sortOrder || first.id - second.id;
  });
  const findings = findingRows.map(serializeFinding);
  const workbook = new ExcelJS.Workbook();
  const today = new Date().toISOString().slice(0, 10);

  workbook.creator = "Audit Crucible Tracker";
  workbook.created = new Date();
  workbook.modified = new Date();

  addChecklistSheet(workbook, items);
  addFindingsSheet(workbook, findings);
  addInsightSheet(workbook, items, findings);

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="audit-cem-export-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
