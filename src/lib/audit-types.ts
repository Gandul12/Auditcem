import type {
  ActiveProgramMonth,
  AuditArea,
  AuditCycleMonth,
  AuditResult,
  CycleStatus,
  DomainId,
  PlannerActivityType,
  PlannerStatus,
  Priority,
} from "./audit-config";

export type AuditDomainView = {
  id: DomainId;
  title: string;
  fullName: string;
  icon: string;
  accent: string;
  targetProgramMonth: ActiveProgramMonth;
  targetCalendarMonth: number;
  targetDay: number;
  targetMonthName: string;
  targetDate: string;
  sequence: number;
};

export type AuditCycleMonthView = {
  id: AuditCycleMonth;
  label: string;
  longLabel: string;
  calendarMonth: number;
  targetDay: number;
  targetDate: string;
  sequence: number;
};

export type AuditItemRecord = {
  id: number;
  area: AuditArea;
  domain: DomainId;
  description: string;
  priority: Priority;
  checked: boolean;
  sortOrder: number;
  updatedAt: string;
};

export type AuditCycleRecord = {
  area: AuditArea;
  domain: DomainId;
  cycleMonth: AuditCycleMonth;
  status: CycleStatus;
  updatedAt: string;
};

export type AuditFindingRecord = {
  id: number;
  date: string;
  area: AuditArea;
  domain: DomainId;
  auditor: string;
  result: AuditResult;
  rootCause: string;
  actionPlan: string;
  lessonLearned: string;
  createdAt: string;
  updatedAt: string;
};

export type WeeklyExecutionPlanRecord = {
  id: number;
  area: AuditArea;
  weekNumber: 1 | 2;
  dayOfWeek: number;
  dayLabel: string;
  domain: DomainId | null;
  activityType: PlannerActivityType;
  focus: string;
  status: PlannerStatus;
  updatedAt: string;
};

export type FindingMutationInput = {
  date: string;
  area: AuditArea;
  domain: DomainId;
  auditor: string;
  result: AuditResult;
  rootCause: string;
  actionPlan: string;
  lessonLearned: string;
};

export type PlannerMutationInput = {
  id: number;
  status?: PlannerStatus;
  domain?: DomainId | null;
  activityType?: PlannerActivityType;
  focus?: string;
};

export type DashboardData = {
  areas: AuditArea[];
  domains: AuditDomainView[];
  cycleMonths: AuditCycleMonthView[];
  items: AuditItemRecord[];
  cycles: AuditCycleRecord[];
  findings: AuditFindingRecord[];
  planner: WeeklyExecutionPlanRecord[];
  activeMonth: ActiveProgramMonth;
  targetYear: number;
  generatedAt: string;
};
