import {
  boolean,
  date,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const auditItems = pgTable(
  "audit_items",
  {
    id: serial("id").primaryKey(),
    area: text("area").notNull().default("Cutting"),
    domain: text("domain").notNull(),
    description: text("deskripsi").notNull(),
    priority: text("prioritas").notNull(),
    checked: boolean("checked").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("audit_items_area_domain_sort_unique").on(
      table.area,
      table.domain,
      table.sortOrder,
    ),
  ],
);

export const auditCycles = pgTable(
  "audit_cycles",
  {
    area: text("area").notNull().default("Cutting"),
    domain: text("domain").notNull(),
    cycleMonth: text("cycle_month").notNull().default("AUG"),
    status: text("status").notNull().default("pending"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.area, table.domain, table.cycleMonth] })],
);

export const auditFindings = pgTable("audit_findings", {
  id: serial("id").primaryKey(),
  date: date("tanggal").notNull(),
  area: text("area").notNull().default("Cutting"),
  domain: text("domain").notNull(),
  auditor: text("auditor").notNull(),
  result: text("hasil").notNull(),
  rootCause: text("root_cause").notNull().default(""),
  actionPlan: text("action_plan").notNull().default(""),
  lessonLearned: text("lesson_learned").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const weeklyExecutionPlans = pgTable(
  "weekly_execution_plans",
  {
    id: serial("id").primaryKey(),
    area: text("area").notNull().default("Cutting"),
    weekNumber: integer("week_number").notNull(),
    dayOfWeek: integer("day_of_week").notNull(),
    dayLabel: text("day_label").notNull(),
    domain: text("domain"),
    activityType: text("activity_type").notNull().default("AUDIT"),
    focus: text("focus").notNull().default(""),
    status: text("status").notNull().default("planned"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("weekly_execution_plans_area_week_day_unique").on(
      table.area,
      table.weekNumber,
      table.dayOfWeek,
    ),
  ],
);

export const auditSettings = pgTable("audit_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditItemSelect = typeof auditItems.$inferSelect;
export type AuditCycleSelect = typeof auditCycles.$inferSelect;
export type AuditFindingSelect = typeof auditFindings.$inferSelect;
export type WeeklyExecutionPlanSelect = typeof weeklyExecutionPlans.$inferSelect;
