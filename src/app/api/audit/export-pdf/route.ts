import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditFindings, auditItems, auditSettings } from "@/db/schema";
import {
  AUDIT_AREAS,
  AUDIT_DOMAINS,
  isActiveProgramMonth,
  isAuditArea,
  isAuditResult,
  isDomainId,
  isPriority,
  parseActiveProgramMonth,
  type ActiveProgramMonth,
  type AuditArea,
} from "@/lib/audit-config";
import { generateAuditInsight } from "@/lib/auditInsight";
import { calculateDeadlineRisk, formatDaysRemaining } from "@/lib/deadlineRisk";
import { requireAuthenticatedRequest } from "@/lib/auth";
import type { AuditFindingRecord, AuditItemRecord } from "@/lib/audit-types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 36;
const DARK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.35, 0.39, 0.47);
const LIGHT_BORDER = rgb(0.84, 0.86, 0.9);
const RISK_RED = rgb(0.85, 0.12, 0.16);

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

function sanitize(value: string): string {
  return value
    .replace(/[—–]/g, "-")
    .replace(/[•]/g, "-")
    .replace(/[×]/g, "x")
    .replace(/[✓]/g, "v")
    .replace(/[⚠]/g, "!");
}

function parseHexColor(hex: string) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  return rgb(red, green, blue);
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

function percentage(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function getSummary(items: AuditItemRecord[], area: AuditArea, domainId: string) {
  const scoped = items.filter((item) => item.area === area && item.domain === domainId);
  const done = scoped.filter((item) => item.checked).length;
  const total = scoped.length;
  return { done, total, percentage: percentage(done, total) };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      return;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
  });

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [""];
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = DARK,
) {
  page.drawText(sanitize(text), { x, y, font, size, color });
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color = DARK,
  lineHeight = 14,
): number {
  const lines = wrapText(text, font, size, maxWidth);
  lines.forEach((line, index) => {
    drawText(page, line, x, y - index * lineHeight, font, size, color);
  });
  return y - lines.length * lineHeight;
}

function drawHeader(
  page: PDFPage,
  fontBold: PDFFont,
  font: PDFFont,
  activeMonth: ActiveProgramMonth,
  today: string,
) {
  drawText(page, "Audit Crucible - Ringkasan Progres", MARGIN, PAGE_HEIGHT - 48, fontBold, 22, DARK);
  drawText(page, `Export: ${today} | Bulan Program: B${activeMonth}`, MARGIN, PAGE_HEIGHT - 70, font, 10, MUTED);
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - 84 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 84 },
    thickness: 1,
    color: LIGHT_BORDER,
  });
}

function drawSummaryTable(page: PDFPage, items: AuditItemRecord[], font: PDFFont, fontBold: PDFFont) {
  const startX = MARGIN;
  let y = PAGE_HEIGHT - 122;
  const rowHeight = 24;
  const columns = [
    { label: "Domain", width: 190 },
    { label: "Cutting", width: 170 },
    { label: "Prep", width: 170 },
    { label: "CSC", width: 170 },
  ];

  page.drawRectangle({
    x: startX,
    y: y - 7,
    width: columns.reduce((sum, column) => sum + column.width, 0),
    height: rowHeight,
    color: DARK,
  });

  let x = startX;
  columns.forEach((column) => {
    drawText(page, column.label, x + 8, y, fontBold, 10, rgb(1, 1, 1));
    x += column.width;
  });

  y -= rowHeight;

  AUDIT_DOMAINS.forEach((domain) => {
    x = startX;
    page.drawRectangle({
      x: startX,
      y: y - 7,
      width: columns.reduce((sum, column) => sum + column.width, 0),
      height: rowHeight,
      borderColor: LIGHT_BORDER,
      borderWidth: 0.5,
    });
    page.drawRectangle({ x: startX, y: y - 7, width: 4, height: rowHeight, color: parseHexColor(domain.accent) });
    drawText(page, domain.title, x + 8, y, fontBold, 9, DARK);
    x += columns[0].width;

    AUDIT_AREAS.forEach((area, index) => {
      const summary = getSummary(items, area, domain.id);
      drawText(
        page,
        `${summary.done}/${summary.total} (${summary.percentage}%)`,
        x + 8,
        y,
        font,
        9,
        DARK,
      );
      x += columns[index + 1].width;
    });

    y -= rowHeight;
  });
}

function getRiskItems(items: AuditItemRecord[]) {
  return AUDIT_AREAS.flatMap((area) =>
    AUDIT_DOMAINS.map((domain) => {
      const summary = getSummary(items, area, domain.id);
      const risk = calculateDeadlineRisk(domain, summary.percentage);
      return { area, domain, summary, risk };
    }),
  ).filter((item) => item.risk.level === "berisiko");
}

function drawInsightPage(
  page: PDFPage,
  items: AuditItemRecord[],
  findings: AuditFindingRecord[],
  font: PDFFont,
  fontBold: PDFFont,
  today: string,
) {
  let y = PAGE_HEIGHT - 52;
  drawText(page, "Insight & Risiko Deadline", MARGIN, y, fontBold, 18, DARK);
  y -= 26;

  const insights = generateAuditInsight(items, findings).slice(0, 5);
  insights.forEach((insight, index) => {
    drawText(page, `${index + 1}.`, MARGIN, y, fontBold, 10, DARK);
    y = drawWrappedText(page, insight, MARGIN + 22, y, PAGE_WIDTH - MARGIN * 2 - 22, font, 10, DARK, 14) - 6;
  });

  y -= 8;
  drawText(page, "Peringatan Berisiko", MARGIN, y, fontBold, 14, RISK_RED);
  y -= 20;

  const riskItems = getRiskItems(items);

  if (riskItems.length === 0) {
    drawText(page, "Tidak ada domain berstatus berisiko pada saat export.", MARGIN, y, font, 10, MUTED);
    y -= 18;
  } else {
    riskItems.slice(0, 10).forEach((item) => {
      const text = `${item.area} - ${item.domain.title}: ${item.summary.percentage}% (${formatDaysRemaining(item.risk.daysRemaining)})`;
      y = drawWrappedText(page, `- ${text}`, MARGIN, y, PAGE_WIDTH - MARGIN * 2, fontBold, 10, RISK_RED, 14) - 4;
    });
  }

  page.drawLine({
    start: { x: MARGIN, y: 42 },
    end: { x: PAGE_WIDTH - MARGIN, y: 42 },
    thickness: 1,
    color: LIGHT_BORDER,
  });
  drawText(page, `Dibuat otomatis oleh Audit Crucible Tracker - ${today}`, MARGIN, 26, font, 8, MUTED);
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAuthenticatedRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const [itemRows, findingRows, settingRows] = await Promise.all([
    db.select().from(auditItems),
    db.select().from(auditFindings).orderBy(desc(auditFindings.date), desc(auditFindings.id)),
    db.select().from(auditSettings).where(eq(auditSettings.key, "active_month")).limit(1),
  ]);
  const items = itemRows.map(serializeItem);
  const findings = findingRows.map(serializeFinding);
  const activeMonth = parseActiveProgramMonth(settingRows[0]?.value) ?? 4;
  const safeActiveMonth = isActiveProgramMonth(activeMonth) ? activeMonth : 4;
  const today = new Date().toISOString().slice(0, 10);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageOne = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const pageTwo = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  drawHeader(pageOne, fontBold, font, safeActiveMonth, today);
  drawSummaryTable(pageOne, items, font, fontBold);
  drawText(pageOne, "Tabel menampilkan jumlah item selesai/total dan persentase readiness per domain per area.", MARGIN, 72, font, 9, MUTED);
  drawText(pageOne, `Dibuat otomatis oleh Audit Crucible Tracker - ${today}`, MARGIN, 26, font, 8, MUTED);
  drawInsightPage(pageTwo, items, findings, font, fontBold, today);

  const bytes = await pdf.save();
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="audit-cem-ringkasan-${today}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
