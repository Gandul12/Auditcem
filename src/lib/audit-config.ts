export const AUDIT_AREAS = ["Cutting", "Prep", "CSC"] as const;
export type AuditArea = (typeof AUDIT_AREAS)[number];

export const PRIORITIES = ["KRITIS", "PENTING"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const AUDIT_RESULTS = ["Lulus", "Tidak Lulus", "Partial"] as const;
export type AuditResult = (typeof AUDIT_RESULTS)[number];

export const CYCLE_STATUSES = ["pending", "passed"] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

export const PLANNER_STATUSES = ["planned", "running", "done"] as const;
export type PlannerStatus = (typeof PLANNER_STATUSES)[number];

export const PLANNER_ACTIVITY_TYPES = ["AUDIT", "REVIEW", "REPORT"] as const;
export type PlannerActivityType = (typeof PLANNER_ACTIVITY_TYPES)[number];

export type ActiveProgramMonth = 4 | 5 | 6;

export const AUDIT_CYCLE_MONTHS = [
  { id: "AUG", label: "Agu", longLabel: "Agustus", calendarMonth: 8, targetDay: 31, sequence: 1 },
  { id: "SEP", label: "Sep", longLabel: "September", calendarMonth: 9, targetDay: 30, sequence: 2 },
  { id: "OCT", label: "Okt", longLabel: "Oktober", calendarMonth: 10, targetDay: 31, sequence: 3 },
] as const;

export type AuditCycleMonth = (typeof AUDIT_CYCLE_MONTHS)[number]["id"];

export const WEEK_DAYS = [
  { dayOfWeek: 1, label: "Senin", shortLabel: "Sen" },
  { dayOfWeek: 2, label: "Selasa", shortLabel: "Sel" },
  { dayOfWeek: 3, label: "Rabu", shortLabel: "Rab" },
  { dayOfWeek: 4, label: "Kamis", shortLabel: "Kam" },
  { dayOfWeek: 5, label: "Jumat", shortLabel: "Jum" },
] as const;

export type WeeklyPlannerSeed = {
  weekNumber: 1 | 2;
  dayOfWeek: number;
  dayLabel: string;
  domain: DomainId | null;
  activityType: PlannerActivityType;
  focus: string;
};

export const WEEKLY_PLANNER_TEMPLATE: readonly WeeklyPlannerSeed[] = [
  { weekNumber: 1, dayOfWeek: 1, dayLabel: "Senin", domain: "MQAA", activityType: "AUDIT", focus: "MQAA" },
  { weekNumber: 1, dayOfWeek: 2, dayLabel: "Selasa", domain: null, activityType: "REVIEW", focus: "Review" },
  { weekNumber: 1, dayOfWeek: 3, dayLabel: "Rabu", domain: null, activityType: "AUDIT", focus: "6S & VM" },
  { weekNumber: 1, dayOfWeek: 4, dayLabel: "Kamis", domain: null, activityType: "REVIEW", focus: "Review" },
  { weekNumber: 1, dayOfWeek: 5, dayLabel: "Jumat", domain: null, activityType: "AUDIT", focus: "MQAA, 6S, VM" },
  { weekNumber: 2, dayOfWeek: 1, dayLabel: "Senin", domain: null, activityType: "AUDIT", focus: "MQAA, 6S, VM" },
  { weekNumber: 2, dayOfWeek: 2, dayLabel: "Selasa", domain: null, activityType: "AUDIT", focus: "HSE, PS" },
  { weekNumber: 2, dayOfWeek: 3, dayLabel: "Rabu", domain: null, activityType: "AUDIT", focus: "MQAA, 6S, VM" },
  { weekNumber: 2, dayOfWeek: 4, dayLabel: "Kamis", domain: null, activityType: "AUDIT", focus: "HSE, PS" },
  { weekNumber: 2, dayOfWeek: 5, dayLabel: "Jumat", domain: null, activityType: "REPORT", focus: "Audit Report" },
];

export const AUDIT_DOMAINS = [
  {
    id: "MQAA",
    title: "MQAA",
    fullName: "Audit Jaminan Mutu Manufaktur",
    icon: "MQ",
    accent: "#3DD68C",
    targetProgramMonth: 4,
    targetCalendarMonth: 8,
    targetDay: 31,
    targetMonthName: "Agu",
    sequence: 1,
  },
  {
    id: "HSE",
    title: "HSE",
    fullName: "Kesehatan, Keselamatan & Lingkungan",
    icon: "HS",
    accent: "#FF6B6B",
    targetProgramMonth: 4,
    targetCalendarMonth: 8,
    targetDay: 31,
    targetMonthName: "Agu",
    sequence: 2,
  },
  {
    id: "PS",
    title: "PS",
    fullName: "Keamanan Produk",
    icon: "PS",
    accent: "#A78BFA",
    targetProgramMonth: 5,
    targetCalendarMonth: 9,
    targetDay: 30,
    targetMonthName: "Sep",
    sequence: 3,
  },
  {
    id: "LEAN & 6S",
    title: "LEAN & 6S",
    fullName: "LEAN & 6S",
    icon: "6S",
    accent: "#4A9EFF",
    targetProgramMonth: 6,
    targetCalendarMonth: 10,
    targetDay: 31,
    targetMonthName: "Okt",
    sequence: 4,
  },
  {
    id: "VISUAL MANAGEMENT",
    title: "Visual Management",
    fullName: "Manajemen Visual Area Produksi",
    icon: "VM",
    accent: "#F5A623",
    targetProgramMonth: 6,
    targetCalendarMonth: 10,
    targetDay: 31,
    targetMonthName: "Okt",
    sequence: 5,
  },
] as const;

export type DomainId = (typeof AUDIT_DOMAINS)[number]["id"];

export const DOMAIN_IDS = AUDIT_DOMAINS.map((domain) => domain.id) as DomainId[];
export const AREA_IDS = AUDIT_AREAS.map((area) => area) as AuditArea[];
export const CYCLE_MONTH_IDS = AUDIT_CYCLE_MONTHS.map((month) => month.id) as AuditCycleMonth[];

export type AuditChecklistSeed = {
  domain: DomainId;
  description: string;
  priority: Priority;
  sortOrder: number;
};

export const AUDIT_CHECKLIST: readonly AuditChecklistSeed[] = [
  { domain: "MQAA", priority: "KRITIS", description: "Memahami standar ISQ (In-Station Quality) di semua stasiun", sortOrder: 1 },
  { domain: "MQAA", priority: "KRITIS", description: "Mampu mengidentifikasi & klasifikasi cacat Grade B/C", sortOrder: 2 },
  { domain: "MQAA", priority: "KRITIS", description: "Mengelola rework rate dan tindakan korektif", sortOrder: 3 },
  { domain: "MQAA", priority: "PENTING", description: "Memahami standar Pair Matching", sortOrder: 4 },
  { domain: "MQAA", priority: "PENTING", description: "Familiar dengan dokumen MPPN dan pengisiannya", sortOrder: 5 },
  { domain: "MQAA", priority: "KRITIS", description: "Melakukan self audit QMS secara mandiri", sortOrder: 6 },
  { domain: "MQAA", priority: "PENTING", description: "Memahami MI Score dan cara kalkulasinya", sortOrder: 7 },
  { domain: "MQAA", priority: "KRITIS", description: "Pernah mengeksekusi minimal 1 Pengenalan Model Baru", sortOrder: 8 },

  { domain: "HSE", priority: "KRITIS", description: "Hafal semua APD wajib per area dan mesin", sortOrder: 1 },
  { domain: "HSE", priority: "KRITIS", description: "Mampu mengidentifikasi bahaya fisik, kimia, ergonomi di area kerja", sortOrder: 2 },
  { domain: "HSE", priority: "KRITIS", description: "Paham prosedur tanggap darurat (kebakaran, kecelakaan)", sortOrder: 3 },
  { domain: "HSE", priority: "PENTING", description: "Mampu mengisi Near Miss Report secara mandiri", sortOrder: 4 },
  { domain: "HSE", priority: "PENTING", description: "Memahami rambu keselamatan dan artinya di seluruh area", sortOrder: 5 },
  { domain: "HSE", priority: "KRITIS", description: "Pernah melakukan safety briefing ke operator", sortOrder: 6 },
  { domain: "HSE", priority: "KRITIS", description: "Mampu melakukan self-audit HSE checklist mandiri", sortOrder: 7 },

  { domain: "PS", priority: "KRITIS", description: "Memahami prosedur kontrol akses masuk/keluar area produksi", sortOrder: 1 },
  { domain: "PS", priority: "KRITIS", description: "Mampu mengidentifikasi potensi produk palsu atau pengalihan", sortOrder: 2 },
  { domain: "PS", priority: "KRITIS", description: "Paham prosedur pemindaian & pelacakan barcode produk", sortOrder: 3 },
  { domain: "PS", priority: "PENTING", description: "Memahami aturan penggunaan HP/kamera di area produksi", sortOrder: 4 },
  { domain: "PS", priority: "PENTING", description: "Paham prosedur serah terima produk ke gudang", sortOrder: 5 },
  { domain: "PS", priority: "KRITIS", description: "Mampu melaporkan kejadian PS secara prosedural", sortOrder: 6 },

  { domain: "LEAN & 6S", priority: "KRITIS", description: "Hafal dan mampu mengimplementasikan semua elemen 6S di area kerja", sortOrder: 1 },
  { domain: "LEAN & 6S", priority: "KRITIS", description: "Mampu mengidentifikasi 8 jenis limbah di lini secara real-time", sortOrder: 2 },
  { domain: "LEAN & 6S", priority: "KRITIS", description: "Paham dan bisa diterapkan Yamazumi & Line Balancing", sortOrder: 3 },
  { domain: "LEAN & 6S", priority: "PENTING", description: "Mampu mengeksekusi ECRS untuk satu proses secara mandiri", sortOrder: 4 },
  { domain: "LEAN & 6S", priority: "KRITIS", description: "Paham LSW (Leader Standard Work) dan menjalankannya", sortOrder: 5 },
  { domain: "LEAN & 6S", priority: "PENTING", description: "Mampu membaca dan memperbarui manajemen visual di lini", sortOrder: 6 },
  { domain: "LEAN & 6S", priority: "KRITIS", description: "Pernah memimpin siklus PDCA untuk 1 masalah di lini", sortOrder: 7 },
  { domain: "LEAN & 6S", priority: "KRITIS", description: "Mampu melakukan audit 6S mandiri dan scoring area", sortOrder: 8 },

  { domain: "VISUAL MANAGEMENT", priority: "KRITIS", description: "SQDCM board setiap area akurat, terbaca, dan diperbarui sesuai ritme shift", sortOrder: 1 },
  { domain: "VISUAL MANAGEMENT", priority: "KRITIS", description: "Hour-by-hour output dan abnormality board menunjukkan status aktual produksi", sortOrder: 2 },
  { domain: "VISUAL MANAGEMENT", priority: "KRITIS", description: "Andon/escalation rule visual dipahami operator dan leader", sortOrder: 3 },
  { domain: "VISUAL MANAGEMENT", priority: "PENTING", description: "Shadow board, label, dan marking area konsisten dengan standar 6S", sortOrder: 4 },
  { domain: "VISUAL MANAGEMENT", priority: "KRITIS", description: "KPI trend dan gap terhadap target memiliki owner dan due date tindakan", sortOrder: 5 },
  { domain: "VISUAL MANAGEMENT", priority: "PENTING", description: "Visual standard work tersedia di titik penggunaan dan versi terbaru", sortOrder: 6 },
  { domain: "VISUAL MANAGEMENT", priority: "KRITIS", description: "Tier meeting menggunakan data visual aktual untuk keputusan harian", sortOrder: 7 },
  { domain: "VISUAL MANAGEMENT", priority: "KRITIS", description: "Temuan visual management ditutup dengan evidence sebelum siklus berikutnya", sortOrder: 8 },
];

export function isAuditArea(value: unknown): value is AuditArea {
  return typeof value === "string" && (AREA_IDS as readonly string[]).includes(value);
}

export function isDomainId(value: unknown): value is DomainId {
  return typeof value === "string" && (DOMAIN_IDS as readonly string[]).includes(value);
}

export function isCycleMonth(value: unknown): value is AuditCycleMonth {
  return typeof value === "string" && (CYCLE_MONTH_IDS as readonly string[]).includes(value);
}

export function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value);
}

export function isAuditResult(value: unknown): value is AuditResult {
  return typeof value === "string" && (AUDIT_RESULTS as readonly string[]).includes(value);
}

export function isCycleStatus(value: unknown): value is CycleStatus {
  return typeof value === "string" && (CYCLE_STATUSES as readonly string[]).includes(value);
}

export function isPlannerStatus(value: unknown): value is PlannerStatus {
  return typeof value === "string" && (PLANNER_STATUSES as readonly string[]).includes(value);
}

export function isPlannerActivityType(value: unknown): value is PlannerActivityType {
  return typeof value === "string" && (PLANNER_ACTIVITY_TYPES as readonly string[]).includes(value);
}

export function isActiveProgramMonth(value: unknown): value is ActiveProgramMonth {
  return value === 4 || value === 5 || value === 6;
}

export function parseActiveProgramMonth(value: unknown): ActiveProgramMonth | null {
  const numericValue = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return isActiveProgramMonth(numericValue) ? numericValue : null;
}

export function getDefaultActiveMonth(date = new Date()): ActiveProgramMonth {
  const calendarMonth = date.getMonth() + 1;

  if (calendarMonth === 9) {
    return 5;
  }

  if (calendarMonth >= 10) {
    return 6;
  }

  return 4;
}

export function getDomainOrder(domain: DomainId): number {
  return AUDIT_DOMAINS.find((item) => item.id === domain)?.sequence ?? 99;
}

export function getAreaOrder(area: AuditArea): number {
  return AUDIT_AREAS.findIndex((item) => item === area);
}

export function getCycleMonthOrder(month: AuditCycleMonth): number {
  return AUDIT_CYCLE_MONTHS.find((item) => item.id === month)?.sequence ?? 99;
}

export function getCycleMonthLabel(month: AuditCycleMonth): string {
  return AUDIT_CYCLE_MONTHS.find((item) => item.id === month)?.label ?? month;
}
