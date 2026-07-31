import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { auditCycles, auditFindings, auditItems, auditSettings, weeklyExecutionPlans } from "./schema";
import {
  AUDIT_AREAS,
  AUDIT_CHECKLIST,
  AUDIT_CYCLE_MONTHS,
  AUDIT_DOMAINS,
  WEEKLY_PLANNER_TEMPLATE,
  getAreaOrder,
  getCycleMonthOrder,
  getDefaultActiveMonth,
  getDomainOrder,
  isActiveProgramMonth,
  isAuditArea,
  isAuditResult,
  isCycleMonth,
  isCycleStatus,
  isDomainId,
  isPlannerActivityType,
  isPlannerStatus,
  isPriority,
  parseActiveProgramMonth,
  type ActiveProgramMonth,
  type AuditArea,
  type AuditCycleMonth,
  type AuditResult,
  type CycleStatus,
  type DomainId,
  type PlannerActivityType,
  type PlannerStatus,
} from "../lib/audit-config";
import type {
  AuditCycleMonthView,
  AuditCycleRecord,
  AuditDomainView,
  AuditFindingRecord,
  AuditItemRecord,
  DashboardData,
  FindingMutationInput,
  PlannerMutationInput,
  WeeklyExecutionPlanRecord,
} from "../lib/audit-types";

const ACTIVE_MONTH_SETTING_KEY = "active_month";

function assertArea(area: string): AuditArea {
  if (!isAuditArea(area)) {
    throw new Error(`Unknown audit area: ${area}`);
  }

  return area;
}

function assertDomain(domain: string): DomainId {
  if (!isDomainId(domain)) {
    throw new Error(`Unknown audit domain: ${domain}`);
  }

  return domain;
}

function assertCycleMonth(month: string): AuditCycleMonth {
  if (!isCycleMonth(month)) {
    throw new Error(`Unknown audit cycle month: ${month}`);
  }

  return month;
}

function assertResult(result: string): AuditResult {
  if (!isAuditResult(result)) {
    throw new Error(`Unknown audit result: ${result}`);
  }

  return result;
}

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

function formatTargetDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildDomainViews(year: number): AuditDomainView[] {
  return AUDIT_DOMAINS.map((domain) => ({
    id: domain.id,
    title: domain.title,
    fullName: domain.fullName,
    icon: domain.icon,
    accent: domain.accent,
    targetProgramMonth: domain.targetProgramMonth,
    targetCalendarMonth: domain.targetCalendarMonth,
    targetDay: domain.targetDay,
    targetMonthName: domain.targetMonthName,
    targetDate: formatTargetDate(year, domain.targetCalendarMonth, domain.targetDay),
    sequence: domain.sequence,
  }));
}

function buildCycleMonthViews(year: number): AuditCycleMonthView[] {
  return AUDIT_CYCLE_MONTHS.map((month) => ({
    id: month.id,
    label: month.label,
    longLabel: month.longLabel,
    calendarMonth: month.calendarMonth,
    targetDay: month.targetDay,
    targetDate: formatTargetDate(year, month.calendarMonth, month.targetDay),
    sequence: month.sequence,
  }));
}

function serializeItem(row: typeof auditItems.$inferSelect): AuditItemRecord {
  const domain = assertDomain(row.domain);
  const area = assertArea(row.area);
  const priority = isPriority(row.priority) ? row.priority : "PENTING";

  return {
    id: row.id,
    area,
    domain,
    description: row.description,
    priority,
    checked: row.checked,
    sortOrder: row.sortOrder,
    updatedAt: toIsoString(row.updatedAt),
  };
}

function serializeCycle(row: typeof auditCycles.$inferSelect): AuditCycleRecord {
  const status = isCycleStatus(row.status) ? row.status : "pending";

  return {
    area: assertArea(row.area),
    domain: assertDomain(row.domain),
    cycleMonth: assertCycleMonth(row.cycleMonth),
    status,
    updatedAt: toIsoString(row.updatedAt),
  };
}

function serializeFinding(row: typeof auditFindings.$inferSelect): AuditFindingRecord {
  return {
    id: row.id,
    date: toDateOnly(row.date),
    area: assertArea(row.area),
    domain: assertDomain(row.domain),
    auditor: row.auditor,
    result: assertResult(row.result),
    rootCause: row.rootCause,
    actionPlan: row.actionPlan,
    lessonLearned: row.lessonLearned,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function serializePlanner(row: typeof weeklyExecutionPlans.$inferSelect): WeeklyExecutionPlanRecord {
  const weekNumber = row.weekNumber === 2 ? 2 : 1;
  const status = isPlannerStatus(row.status) ? row.status : "planned";
  const activityType = isPlannerActivityType(row.activityType) ? row.activityType : "AUDIT";

  return {
    id: row.id,
    area: assertArea(row.area),
    weekNumber,
    dayOfWeek: row.dayOfWeek,
    dayLabel: row.dayLabel,
    domain: row.domain ? assertDomain(row.domain) : null,
    activityType,
    focus: row.focus,
    status,
    updatedAt: toIsoString(row.updatedAt),
  };
}

export async function ensureAuditSeedData(): Promise<void> {
  const now = new Date();
  const defaultActiveMonth = getDefaultActiveMonth(now);

  for (const area of AUDIT_AREAS) {
    for (const item of AUDIT_CHECKLIST) {
      const existingRows = await db
        .select({ id: auditItems.id })
        .from(auditItems)
        .where(
          and(
            eq(auditItems.area, area),
            eq(auditItems.domain, item.domain),
            eq(auditItems.sortOrder, item.sortOrder),
          ),
        )
        .limit(1);

      if (existingRows[0]) {
        await db
          .update(auditItems)
          .set({
            description: item.description,
            priority: item.priority,
            updatedAt: now,
          })
          .where(eq(auditItems.id, existingRows[0].id));
      } else {
        await db
          .insert(auditItems)
          .values({
            area,
            domain: item.domain,
            description: item.description,
            priority: item.priority,
            checked: false,
            sortOrder: item.sortOrder,
            updatedAt: now,
          })
          .onConflictDoNothing({
            target: [auditItems.area, auditItems.domain, auditItems.sortOrder],
          });
      }
    }
  }

  await db
    .insert(auditCycles)
    .values(
      AUDIT_AREAS.flatMap((area) =>
        AUDIT_DOMAINS.flatMap((domain) =>
          AUDIT_CYCLE_MONTHS.map((month) => ({
            area,
            domain: domain.id,
            cycleMonth: month.id,
            status: "pending" as CycleStatus,
            updatedAt: now,
          })),
        ),
      ),
    )
    .onConflictDoNothing({
      target: [auditCycles.area, auditCycles.domain, auditCycles.cycleMonth],
    });

  for (const area of AUDIT_AREAS) {
    for (const plan of WEEKLY_PLANNER_TEMPLATE) {
      const existingRows = await db
        .select({ id: weeklyExecutionPlans.id })
        .from(weeklyExecutionPlans)
        .where(
          and(
            eq(weeklyExecutionPlans.area, area),
            eq(weeklyExecutionPlans.weekNumber, plan.weekNumber),
            eq(weeklyExecutionPlans.dayOfWeek, plan.dayOfWeek),
          ),
        )
        .limit(1);

      if (existingRows[0]) {
        await db
          .update(weeklyExecutionPlans)
          .set({
            dayLabel: plan.dayLabel,
            domain: plan.domain,
            activityType: plan.activityType,
            focus: plan.focus,
            updatedAt: now,
          })
          .where(eq(weeklyExecutionPlans.id, existingRows[0].id));
      } else {
        await db
          .insert(weeklyExecutionPlans)
          .values({
            area,
            weekNumber: plan.weekNumber,
            dayOfWeek: plan.dayOfWeek,
            dayLabel: plan.dayLabel,
            domain: plan.domain,
            activityType: plan.activityType,
            focus: plan.focus,
            status: "planned" as PlannerStatus,
            updatedAt: now,
          })
          .onConflictDoNothing({
            target: [
              weeklyExecutionPlans.area,
              weeklyExecutionPlans.weekNumber,
              weeklyExecutionPlans.dayOfWeek,
            ],
          });
      }
    }
  }

  await db
    .insert(auditSettings)
    .values({
      key: ACTIVE_MONTH_SETTING_KEY,
      value: String(defaultActiveMonth),
      updatedAt: now,
    })
    .onConflictDoNothing({ target: auditSettings.key });
}

export async function getAuditDashboardData(): Promise<DashboardData> {
  await ensureAuditSeedData();

  const [itemRows, cycleRows, findingRows, plannerRows, settingRows] = await Promise.all([
    db.select().from(auditItems),
    db.select().from(auditCycles),
    db
      .select()
      .from(auditFindings)
      .orderBy(desc(auditFindings.date), desc(auditFindings.id)),
    db.select().from(weeklyExecutionPlans),
    db
      .select()
      .from(auditSettings)
      .where(eq(auditSettings.key, ACTIVE_MONTH_SETTING_KEY))
      .limit(1),
  ]);

  const generatedAt = new Date();
  const targetYear = generatedAt.getFullYear();
  const activeMonth =
    parseActiveProgramMonth(settingRows[0]?.value) ?? getDefaultActiveMonth(generatedAt);

  const items = itemRows
    .map(serializeItem)
    .sort(
      (first, second) =>
        getAreaOrder(first.area) - getAreaOrder(second.area) ||
        getDomainOrder(first.domain) - getDomainOrder(second.domain) ||
        first.sortOrder - second.sortOrder ||
        first.id - second.id,
    );

  const cycles = cycleRows
    .map(serializeCycle)
    .sort(
      (first, second) =>
        getAreaOrder(first.area) - getAreaOrder(second.area) ||
        getDomainOrder(first.domain) - getDomainOrder(second.domain) ||
        getCycleMonthOrder(first.cycleMonth) - getCycleMonthOrder(second.cycleMonth),
    );

  const planner = plannerRows
    .map(serializePlanner)
    .sort(
      (first, second) =>
        getAreaOrder(first.area) - getAreaOrder(second.area) ||
        first.weekNumber - second.weekNumber ||
        first.dayOfWeek - second.dayOfWeek,
    );

  return {
    areas: [...AUDIT_AREAS],
    domains: buildDomainViews(targetYear),
    cycleMonths: buildCycleMonthViews(targetYear),
    items,
    cycles,
    findings: findingRows.map(serializeFinding),
    planner,
    activeMonth,
    targetYear,
    generatedAt: generatedAt.toISOString(),
  };
}

export async function setAuditItemChecked(id: number, checked: boolean): Promise<void> {
  await db
    .update(auditItems)
    .set({ checked, updatedAt: new Date() })
    .where(eq(auditItems.id, id));
}

export async function resetAuditState(domain?: DomainId, area?: AuditArea): Promise<void> {
  const now = new Date();
  const itemConditions = [
    domain ? eq(auditItems.domain, domain) : undefined,
    area ? eq(auditItems.area, area) : undefined,
  ].filter(Boolean);
  const cycleConditions = [
    domain ? eq(auditCycles.domain, domain) : undefined,
    area ? eq(auditCycles.area, area) : undefined,
  ].filter(Boolean);

  if (itemConditions.length) {
    await db
      .update(auditItems)
      .set({ checked: false, updatedAt: now })
      .where(and(...itemConditions));
  } else {
    await db.update(auditItems).set({ checked: false, updatedAt: now });
  }

  if (cycleConditions.length) {
    await db
      .update(auditCycles)
      .set({ status: "pending", updatedAt: now })
      .where(and(...cycleConditions));
  } else {
    await db.update(auditCycles).set({ status: "pending", updatedAt: now });
  }
}

export async function updateMonthlyCycle(
  area: AuditArea,
  domain: DomainId,
  cycleMonth: AuditCycleMonth,
  status: CycleStatus,
): Promise<void> {
  const now = new Date();

  await db
    .insert(auditCycles)
    .values({
      area,
      domain,
      cycleMonth,
      status,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [auditCycles.area, auditCycles.domain, auditCycles.cycleMonth],
      set: { status, updatedAt: now },
    });
}

export async function setActiveMonth(activeMonth: ActiveProgramMonth): Promise<void> {
  const now = new Date();

  await db
    .insert(auditSettings)
    .values({
      key: ACTIVE_MONTH_SETTING_KEY,
      value: String(activeMonth),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: auditSettings.key,
      set: { value: String(activeMonth), updatedAt: now },
    });
}

export async function createAuditFinding(input: FindingMutationInput): Promise<void> {
  await db.insert(auditFindings).values({
    date: input.date,
    area: input.area,
    domain: input.domain,
    auditor: input.auditor,
    result: input.result,
    rootCause: input.rootCause,
    actionPlan: input.actionPlan,
    lessonLearned: input.lessonLearned,
    updatedAt: new Date(),
  });
}

export async function updateAuditFinding(
  id: number,
  input: FindingMutationInput,
): Promise<void> {
  await db
    .update(auditFindings)
    .set({
      date: input.date,
      area: input.area,
      domain: input.domain,
      auditor: input.auditor,
      result: input.result,
      rootCause: input.rootCause,
      actionPlan: input.actionPlan,
      lessonLearned: input.lessonLearned,
      updatedAt: new Date(),
    })
    .where(eq(auditFindings.id, id));
}

export async function deleteAuditFinding(id: number): Promise<void> {
  await db.delete(auditFindings).where(eq(auditFindings.id, id));
}

export async function updateWeeklyPlanner(input: PlannerMutationInput): Promise<void> {
  const update: Partial<typeof weeklyExecutionPlans.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.status) {
    update.status = input.status;
  }

  if (input.domain !== undefined) {
    update.domain = input.domain;
  }

  if (input.activityType) {
    update.activityType = input.activityType;
  }

  if (input.focus !== undefined) {
    update.focus = input.focus;
  }

  await db.update(weeklyExecutionPlans).set(update).where(eq(weeklyExecutionPlans.id, input.id));
}

export async function getAuditItemById(id: number): Promise<AuditItemRecord | null> {
  const rows = await db.select().from(auditItems).where(eq(auditItems.id, id)).limit(1);
  return rows[0] ? serializeItem(rows[0]) : null;
}

export async function getAuditFindingById(id: number): Promise<AuditFindingRecord | null> {
  const rows = await db
    .select()
    .from(auditFindings)
    .where(eq(auditFindings.id, id))
    .limit(1);

  return rows[0] ? serializeFinding(rows[0]) : null;
}

export function parseFindingMutationInput(value: unknown): FindingMutationInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const date = typeof record.date === "string" ? record.date.trim() : "";
  const area = isAuditArea(record.area) ? record.area : null;
  const domain = isDomainId(record.domain) ? record.domain : null;
  const auditor = typeof record.auditor === "string" ? record.auditor.trim() : "";
  const result = isAuditResult(record.result) ? record.result : null;
  const rootCause = typeof record.rootCause === "string" ? record.rootCause.trim() : "";
  const actionPlan = typeof record.actionPlan === "string" ? record.actionPlan.trim() : "";
  const lessonLearned =
    typeof record.lessonLearned === "string" ? record.lessonLearned.trim() : "";

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !area || !domain || !auditor || !result) {
    return null;
  }

  return {
    date,
    area,
    domain,
    auditor,
    result,
    rootCause,
    actionPlan,
    lessonLearned,
  };
}

export function parsePlannerMutationInput(value: unknown): PlannerMutationInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = Number.parseInt(String(record.id ?? ""), 10);
  const status = record.status === undefined ? undefined : isPlannerStatus(record.status) ? record.status : null;
  const domain =
    record.domain === undefined
      ? undefined
      : record.domain === null || record.domain === ""
        ? null
        : isDomainId(record.domain)
          ? record.domain
          : false;
  const activityType =
    record.activityType === undefined
      ? undefined
      : isPlannerActivityType(record.activityType)
        ? record.activityType
        : null;
  const focus = record.focus === undefined ? undefined : String(record.focus).trim();

  if (!Number.isInteger(id) || id <= 0 || status === null || domain === false || activityType === null) {
    return null;
  }

  return { id, status, domain, activityType, focus };
}

export function parseDomainScope(value: unknown): DomainId | undefined | null {
  if (value === undefined || value === null || value === "ALL") {
    return undefined;
  }

  return isDomainId(value) ? value : null;
}

export function parseAreaScope(value: unknown): AuditArea | undefined | null {
  if (value === undefined || value === null || value === "ALL") {
    return undefined;
  }

  return isAuditArea(value) ? value : null;
}

export function parseCycleStatusInput(value: unknown): CycleStatus | null {
  return isCycleStatus(value) ? value : null;
}

export function parseCycleMonthInput(value: unknown): AuditCycleMonth | null {
  return isCycleMonth(value) ? value : null;
}

export function parseActiveMonthInput(value: unknown): ActiveProgramMonth | null {
  const parsed = parseActiveProgramMonth(value);
  return isActiveProgramMonth(parsed) ? parsed : null;
}

export async function getCyclesForDomain(domain: DomainId): Promise<AuditCycleRecord[]> {
  const rows = await db.select().from(auditCycles).where(eq(auditCycles.domain, domain));
  return rows.map(serializeCycle);
}

export async function getFindingsByDomainAndResult(
  domain?: DomainId,
  result?: AuditResult,
  area?: AuditArea,
): Promise<AuditFindingRecord[]> {
  const conditions = [
    domain ? eq(auditFindings.domain, domain) : undefined,
    result ? eq(auditFindings.result, result) : undefined,
    area ? eq(auditFindings.area, area) : undefined,
  ].filter(Boolean);

  const rows = conditions.length
    ? await db
        .select()
        .from(auditFindings)
        .where(and(...conditions))
        .orderBy(desc(auditFindings.date), desc(auditFindings.id))
    : await db
        .select()
        .from(auditFindings)
        .orderBy(desc(auditFindings.date), desc(auditFindings.id));

  return rows.map(serializeFinding);
}
