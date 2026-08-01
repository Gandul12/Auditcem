"use client";

import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import { AreaComparisonChart } from "@/components/AreaComparisonChart";
import { DomainBreakdownChart } from "@/components/DomainBreakdownChart";
import {
  AUDIT_RESULTS,
  type ActiveProgramMonth,
  type AuditArea,
  type AuditCycleMonth,
  type AuditResult,
  type CycleStatus,
  type DomainId,
  type PlannerStatus,
} from "@/lib/audit-config";
import { generateAuditInsight } from "@/lib/auditInsight";
import { calculateDeadlineRisk, formatDaysRemaining } from "@/lib/deadlineRisk";
import type {
  AuditCycleRecord,
  AuditDomainView,
  AuditFindingRecord,
  AuditItemRecord,
  DashboardData,
  WeeklyExecutionPlanRecord,
} from "@/lib/audit-types";

type Props = {
  initialData: DashboardData;
};

type FindingDraft = {
  date: string;
  area: AuditArea;
  domain: DomainId;
  auditor: string;
  result: AuditResult;
  rootCause: string;
  actionPlan: string;
  lessonLearned: string;
};

type DomainStat = {
  total: number;
  done: number;
  progress: number;
  criticalPending: AuditItemRecord[];
  monthlyPassed: number;
  monthlyTotal: number;
  allMonthlyPassed: boolean;
  cycleText: string;
  cycleShort: string;
};

type DashboardResponse = {
  data?: DashboardData;
  error?: string;
};

type DashboardViewMode = "area" | "compare";

const DOMAIN_FILTER_ALL = "ALL";
const RESULT_FILTER_ALL = "ALL";
const AREA_FILTER_ALL = "ALL";

function createEmptyDraft(generatedAt: string, area: AuditArea): FindingDraft {
  return {
    date: generatedAt.slice(0, 10),
    area,
    domain: "MQAA",
    auditor: "",
    result: "Partial",
    rootCause: "",
    actionPlan: "",
    lessonLearned: "",
  };
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, month - 1, day);
}

function getCountdownLabel(targetDate: string, generatedAt: string): string {
  const target = parseDateOnly(targetDate);
  const base = parseDateOnly(generatedAt.slice(0, 10));
  const diffDays = Math.ceil((target.getTime() - base.getTime()) / 86_400_000);

  if (diffDays > 0) {
    return `${diffDays} hari lagi`;
  }

  if (diffDays === 0) {
    return "Hari ini";
  }

  return `Lewat ${Math.abs(diffDays)} hari`;
}

function formatDateId(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseDateOnly(value));
}

function progressStyle(progress: number, accent: string): CSSProperties {
  return {
    width: `${Math.min(100, Math.max(0, progress))}%`,
    background: `linear-gradient(90deg, ${accent}, #F5A623)`,
  };
}

function getRiskBadgeClass(level: "waspada" | "berisiko"): string {
  return level === "berisiko"
    ? "border-red-300/25 bg-red-500/12 text-red-100"
    : "border-amber-300/25 bg-amber-400/12 text-amber-100";
}

function getResultClass(result: AuditResult): string {
  if (result === "Lulus") {
    return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
  }

  if (result === "Tidak Lulus") {
    return "border-red-300/20 bg-red-400/10 text-red-100";
  }

  return "border-amber-300/20 bg-amber-400/10 text-amber-100";
}

function getPlannerClass(status: PlannerStatus): string {
  if (status === "done") {
    return "border-emerald-300/30 bg-emerald-400/15 text-emerald-100";
  }

  if (status === "running") {
    return "border-amber-300/30 bg-amber-400/15 text-amber-100";
  }

  return "border-white/[0.08] bg-white/[0.035] text-white/62";
}

function nextPlannerStatus(status: PlannerStatus): PlannerStatus {
  if (status === "planned") {
    return "running";
  }

  if (status === "running") {
    return "done";
  }

  return "planned";
}

function computeDomainStat(
  items: AuditItemRecord[],
  cycles: AuditCycleRecord[],
  area: AuditArea,
  domain: DomainId,
  monthlyTotal: number,
): DomainStat {
  const domainItems = items.filter((item) => item.area === area && item.domain === domain);
  const domainCycles = cycles.filter((cycle) => cycle.area === area && cycle.domain === domain);
  const done = domainItems.filter((item) => item.checked).length;
  const total = domainItems.length;
  const monthlyPassed = domainCycles.filter((cycle) => cycle.status === "passed").length;
  const allMonthlyPassed = monthlyTotal > 0 && monthlyPassed >= monthlyTotal;

  return {
    total,
    done,
    progress: total ? Math.round((done / total) * 100) : 0,
    criticalPending: domainItems.filter((item) => item.priority === "KRITIS" && !item.checked),
    monthlyPassed,
    monthlyTotal,
    allMonthlyPassed,
    cycleText: allMonthlyPassed
      ? "Agu/Sep/Okt lulus — domain selesai"
      : `${monthlyPassed}/${monthlyTotal} siklus bulanan lulus`,
    cycleShort: allMonthlyPassed ? "Lulus" : `${monthlyPassed}/${monthlyTotal} bulan`,
  };
}

function buildMentorSummary(data: DashboardData): string {
  const latestFinding = data.findings[0];
  const allCycles = data.areas.length * data.domains.length * data.cycleMonths.length;
  const passedCycles = data.cycles.filter((cycle) => cycle.status === "passed").length;
  const lines = [
    `Ringkasan Audit Crucible Tracker — ${formatDateId(data.generatedAt.slice(0, 10))}`,
    `Bulan aktif: Bulan ${data.activeMonth} | Scope area: ${data.areas.join(" / ")} | Cycle: Agu-Sep-Okt × ${data.domains.length} domain`,
    "",
    "Breakdown per area:",
    ...data.areas.flatMap((area) => {
      const areaItems = data.items.filter((item) => item.area === area);
      const areaDone = areaItems.filter((item) => item.checked).length;
      const areaCycles = data.cycles.filter((cycle) => cycle.area === area);
      const areaPassedCycles = areaCycles.filter((cycle) => cycle.status === "passed").length;
      const criticalPending = areaItems.filter((item) => item.priority === "KRITIS" && !item.checked);

      return [
        `- ${area}: ${areaDone}/${areaItems.length} checklist (${areaItems.length ? Math.round((areaDone / areaItems.length) * 100) : 0}%) | monthly cycle ${areaPassedCycles}/${areaCycles.length} lulus | KRITIS terbuka ${criticalPending.length}`,
        ...data.domains.map((domain) => {
          const stat = computeDomainStat(data.items, data.cycles, area, domain.id, data.cycleMonths.length);
          return `  • ${domain.title}: ${stat.done}/${stat.total} readiness | ${stat.monthlyPassed}/${stat.monthlyTotal} siklus`;
        }),
      ];
    }),
    "",
    "Status siklus bulanan:",
    ...data.cycleMonths.map((month) => {
      const monthCycles = data.cycles.filter((cycle) => cycle.cycleMonth === month.id);
      const monthPassed = monthCycles.filter((cycle) => cycle.status === "passed").length;
      return `- ${month.label}: ${monthPassed}/${monthCycles.length} area-domain lulus`;
    }),
    `- Total resmi: ${passedCycles}/${allCycles} siklus lulus`,
    "",
    "Item KRITIS belum selesai:",
    ...(() => {
      const pending = data.items.filter((item) => item.priority === "KRITIS" && !item.checked);
      return pending.length
        ? pending.slice(0, 15).map((item) => `- ${item.area} | ${item.domain}: ${item.description}`)
        : ["- Tidak ada. Semua item kritis sudah checked di seluruh area."];
    })(),
    "",
    "Temuan audit terbaru:",
    latestFinding
      ? `- ${formatDateId(latestFinding.date)} | ${latestFinding.area} | ${latestFinding.domain} | ${latestFinding.result} | Auditor: ${latestFinding.auditor}\n  Root Cause: ${latestFinding.rootCause || "-"}\n  Action Plan: ${latestFinding.actionPlan || "-"}\n  Lesson Learned: ${latestFinding.lessonLearned || "-"}`
      : "- Belum ada temuan audit live yang dicatat.",
    "",
    "Rekomendasi fokus minggu berikutnya:",
    ...data.areas.map((area) => {
      const criticalPending = data.items.filter(
        (item) => item.area === area && item.priority === "KRITIS" && !item.checked,
      );
      const pendingCycles = data.cycles.filter(
        (cycle) => cycle.area === area && cycle.status !== "passed",
      );

      if (criticalPending.length > 0) {
        return `- ${area}: tutup ${criticalPending.length} item kritis, validasi evidence, lalu jalankan audit live sesuai planner Week 1/2.`;
      }

      if (pendingCycles.length > 0) {
        return `- ${area}: readiness siap; kejar ${pendingCycles.length} siklus bulanan yang belum lulus.`;
      }

      return `- ${area}: semua siklus lulus; siapkan evidence pack untuk Mentor-Mentee Execution.`;
    }),
  ];

  return lines.join("\n");
}

export function DashboardClient({ initialData }: Props) {
  const firstArea = initialData.areas[0] ?? "Cutting";
  const [data, setData] = useState<DashboardData>(initialData);
  const [selectedArea, setSelectedArea] = useState<AuditArea>(firstArea);
  const [viewMode, setViewMode] = useState<DashboardViewMode>("area");
  const [expanded, setExpanded] = useState<Record<DomainId, boolean>>(() =>
    initialData.domains.reduce((accumulator, domain) => {
      accumulator[domain.id] = domain.targetProgramMonth === initialData.activeMonth;
      return accumulator;
    }, {} as Record<DomainId, boolean>),
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [mentorSummary, setMentorSummary] = useState("");
  const [findingDraft, setFindingDraft] = useState<FindingDraft>(() =>
    createEmptyDraft(initialData.generatedAt, firstArea),
  );
  const [editingFindingId, setEditingFindingId] = useState<number | null>(null);
  const [areaFilter, setAreaFilter] = useState<AuditArea | typeof AREA_FILTER_ALL>(AREA_FILTER_ALL);
  const [domainFilter, setDomainFilter] = useState<DomainId | typeof DOMAIN_FILTER_ALL>(
    DOMAIN_FILTER_ALL,
  );
  const [resultFilter, setResultFilter] = useState<AuditResult | typeof RESULT_FILTER_ALL>(
    RESULT_FILTER_ALL,
  );
  const [searchTerm, setSearchTerm] = useState("");

  const selectedStats = useMemo(
    () =>
      data.domains.reduce((accumulator, domain) => {
        accumulator[domain.id] = computeDomainStat(
          data.items,
          data.cycles,
          selectedArea,
          domain.id,
          data.cycleMonths.length,
        );
        return accumulator;
      }, {} as Record<DomainId, DomainStat>),
    [data.cycles, data.cycleMonths.length, data.domains, data.items, selectedArea],
  );

  const overallProgress = useMemo(() => {
    const total = data.items.length;
    const done = data.items.filter((item) => item.checked).length;
    return total ? Math.round((done / total) * 100) : 0;
  }, [data.items]);

  const selectedAreaProgress = useMemo(() => {
    const areaItems = data.items.filter((item) => item.area === selectedArea);
    const done = areaItems.filter((item) => item.checked).length;
    return {
      done,
      total: areaItems.length,
      progress: areaItems.length ? Math.round((done / areaItems.length) * 100) : 0,
    };
  }, [data.items, selectedArea]);

  const allCyclesPassed = useMemo(() => {
    const requiredCycleCount = data.areas.length * data.domains.length * data.cycleMonths.length;
    return data.cycles.length >= requiredCycleCount && data.cycles.every((cycle) => cycle.status === "passed");
  }, [data.areas.length, data.cycles, data.cycleMonths.length, data.domains.length]);

  const auditInsights = useMemo(
    () =>
      generateAuditInsight(
        data.items.filter((item) => item.area === selectedArea),
        data.findings.filter((finding) => finding.area === selectedArea),
      ),
    [data.findings, data.items, selectedArea],
  );

  const filteredFindings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return data.findings.filter((finding) => {
      const areaMatch = areaFilter === AREA_FILTER_ALL || finding.area === areaFilter;
      const domainMatch = domainFilter === DOMAIN_FILTER_ALL || finding.domain === domainFilter;
      const resultMatch = resultFilter === RESULT_FILTER_ALL || finding.result === resultFilter;
      const searchMatch =
        !normalizedSearch ||
        [
          finding.area,
          finding.domain,
          finding.auditor,
          finding.result,
          finding.rootCause,
          finding.actionPlan,
          finding.lessonLearned,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return areaMatch && domainMatch && resultMatch && searchMatch;
    });
  }, [areaFilter, data.findings, domainFilter, resultFilter, searchTerm]);

  async function mutateDashboard(
    url: string,
    options: RequestInit,
    key: string,
    successMessage: string,
  ): Promise<boolean> {
    setBusyKey(key);
    setNotice("");

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers ?? {}),
        },
      });
      const payload = (await response.json().catch(() => ({}))) as DashboardResponse;

      if (response.status === 401) {
        window.location.assign("/login");
        return false;
      }

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Operasi gagal diproses.");
      }

      setData(payload.data);
      setNotice(successMessage);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Operasi gagal diproses.");
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleToggleItem(item: AuditItemRecord) {
    await mutateDashboard(
      `/api/audit/items/${item.id}`,
      { method: "PATCH", body: JSON.stringify({ checked: !item.checked }) },
      `item-${item.id}`,
      `Checklist ${item.area}/${item.domain} tersimpan ke database.`,
    );
  }

  async function handleMonthlyCycle(
    area: AuditArea,
    domain: DomainId,
    cycleMonth: AuditCycleMonth,
    currentStatus: CycleStatus,
  ) {
    const nextStatus: CycleStatus = currentStatus === "passed" ? "pending" : "passed";

    await mutateDashboard(
      "/api/audit/cycles",
      { method: "POST", body: JSON.stringify({ area, domain, cycleMonth, status: nextStatus }) },
      `cycle-${area}-${domain}-${cycleMonth}`,
      `${area} • ${domain} • ${cycleMonth} disimpan sebagai ${nextStatus === "passed" ? "Lulus" : "Pending"}.`,
    );
  }

  async function handlePlannerStatus(planner: WeeklyExecutionPlanRecord) {
    const status = nextPlannerStatus(planner.status);

    await mutateDashboard(
      "/api/audit/planner",
      { method: "PATCH", body: JSON.stringify({ id: planner.id, status }) },
      `planner-${planner.id}`,
      `${planner.area} Week ${planner.weekNumber} ${planner.dayLabel} diperbarui.`,
    );
  }

  async function handleReset(domain?: DomainId, area?: AuditArea) {
    const message = domain
      ? `Reset checklist dan siklus ${domain}${area ? ` area ${area}` : " seluruh area"}? Log temuan tetap disimpan.`
      : area
        ? `Reset semua domain area ${area}? Log temuan tetap disimpan.`
        : "Reset semua checklist dan siklus seluruh area/domain? Log temuan tetap disimpan.";

    if (!window.confirm(message)) {
      return;
    }

    await mutateDashboard(
      "/api/audit/reset",
      { method: "POST", body: JSON.stringify({ domain: domain ?? "ALL", area: area ?? "ALL" }) },
      domain ? `reset-${area ?? "ALL"}-${domain}` : area ? `reset-${area}` : "reset-all",
      "Reset progres berhasil disimpan.",
    );
  }

  async function handleActiveMonth(month: ActiveProgramMonth) {
    await mutateDashboard(
      "/api/audit/settings",
      { method: "PATCH", body: JSON.stringify({ activeMonth: month }) },
      `month-${month}`,
      `Bulan aktif disimpan: Bulan ${month}.`,
    );
  }

  async function handleFindingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      date: findingDraft.date,
      area: findingDraft.area,
      domain: findingDraft.domain,
      auditor: findingDraft.auditor.trim(),
      result: findingDraft.result,
      rootCause: findingDraft.rootCause.trim(),
      actionPlan: findingDraft.actionPlan.trim(),
      lessonLearned: findingDraft.lessonLearned.trim(),
    };
    const isEditing = editingFindingId !== null;
    const success = await mutateDashboard(
      isEditing ? `/api/audit/findings/${editingFindingId}` : "/api/audit/findings",
      { method: isEditing ? "PATCH" : "POST", body: JSON.stringify(payload) },
      "finding-submit",
      isEditing ? "Temuan audit diperbarui." : "Temuan audit ditambahkan.",
    );

    if (success) {
      setFindingDraft(createEmptyDraft(data.generatedAt, selectedArea));
      setEditingFindingId(null);
    }
  }

  function handleEditFinding(finding: AuditFindingRecord) {
    setEditingFindingId(finding.id);
    setFindingDraft({
      date: finding.date,
      area: finding.area,
      domain: finding.domain,
      auditor: finding.auditor,
      result: finding.result,
      rootCause: finding.rootCause,
      actionPlan: finding.actionPlan,
      lessonLearned: finding.lessonLearned,
    });
    document.getElementById("finding-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleDeleteFinding(finding: AuditFindingRecord) {
    if (!window.confirm(`Hapus temuan ${finding.area}/${finding.domain} tanggal ${formatDateId(finding.date)}?`)) {
      return;
    }

    await mutateDashboard(
      `/api/audit/findings/${finding.id}`,
      { method: "DELETE" },
      `finding-delete-${finding.id}`,
      "Temuan audit dihapus.",
    );
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  async function copySummary() {
    if (!mentorSummary) {
      return;
    }

    await navigator.clipboard.writeText(mentorSummary);
    setNotice("Ringkasan mentor disalin ke clipboard.");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#0D0F14] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(245,166,35,0.13),transparent_30%),radial-gradient(circle_at_90%_0%,rgba(167,139,250,0.12),transparent_28%),radial-gradient(circle_at_70%_90%,rgba(61,214,140,0.08),transparent_34%)]" />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="rounded-[32px] border border-white/[0.07] bg-[#13161E]/90 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-7 lg:p-9">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-200">
                <span className="h-2 w-2 rounded-full bg-[#F5A623] shadow-[0_0_18px_rgba(245,166,35,0.85)]" />
                The Audit Crucible • 5 Domain • 3 Area
              </div>
              <h1 className="font-heading text-4xl font-black tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
                Audit Crucible — Bulan 4-6
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/64 sm:text-lg">
                Eksekusi langsung di lokasi yang dievaluasi oleh auditor ahli. Ini bukan tes tertulis.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-100/76">
                Target kelulusan 100% untuk MQAA, HSE, PS, LEAN & 6S, dan Visual Management di area Cutting, Prep, dan CSC.
              </p>

              <div className="mt-8 rounded-3xl border border-white/[0.07] bg-[#0D0F14]/70 p-5">
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">
                      Kesiapan keseluruhan lintas area
                    </p>
                    <p className="font-mono mt-1 text-3xl font-bold text-white">{overallProgress}%</p>
                  </div>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-white/70">
                    {data.items.filter((item) => item.checked).length}/{data.items.length} item selesai
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full transition-all duration-500" style={progressStyle(overallProgress, "#F5A623")} />
                </div>
                <div
                  className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                    allCyclesPassed
                      ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                      : "border-amber-300/20 bg-amber-400/10 text-amber-100/86"
                  }`}
                >
                  {allCyclesPassed
                    ? "Semua siklus bulanan Agu/Sep/Okt untuk 5 domain dan 3 area sudah lulus. Sistem masuk transisi Mentor-Mentee Execution selama 6 bulan."
                    : "Tuntaskan siklus bulanan Agu/Sep/Okt × 5 domain × 3 area untuk membuka transisi Mentor-Mentee Execution."}
                </div>
              </div>
            </div>

            <div className="w-full max-w-md space-y-4 lg:min-w-[380px]">
              <div className="rounded-3xl border border-white/[0.07] bg-[#1A1E2A]/80 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">Bulan aktif</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-[#F5A623]">Bulan {data.activeMonth}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-full border border-white/[0.08] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/58 transition hover:border-red-300/40 hover:text-red-100"
                  >
                    Logout
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([4, 5, 6] as ActiveProgramMonth[]).map((month) => (
                    <button
                      key={month}
                      type="button"
                      onClick={() => handleActiveMonth(month)}
                      disabled={busyKey === `month-${month}`}
                      className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                        data.activeMonth === month
                          ? "border-amber-300/70 bg-[#F5A623] text-[#0D0F14]"
                          : "border-white/[0.08] bg-white/[0.03] text-white/62 hover:border-amber-300/35 hover:text-white"
                      }`}
                    >
                      B{month}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/[0.07] bg-[#1A1E2A]/80 p-5">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-white/42">
                  Area aktif
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {data.areas.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => {
                        setSelectedArea(area);
                        setFindingDraft((current) => ({ ...current, area }));
                      }}
                      className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                        selectedArea === area
                          ? "border-amber-300/70 bg-[#F5A623] text-[#0D0F14]"
                          : "border-white/[0.08] bg-white/[0.03] text-white/62 hover:border-amber-300/35 hover:text-white"
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full transition-all duration-500" style={progressStyle(selectedAreaProgress.progress, "#F5A623")} />
                </div>
                <p className="mt-2 text-xs text-white/48">
                  {selectedArea}: {selectedAreaProgress.done}/{selectedAreaProgress.total} item selesai
                </p>
              </div>

              <div className="rounded-3xl border border-white/[0.07] bg-[#1A1E2A]/80 p-5">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-white/42">
                  Siklus bulanan {data.targetYear}
                </p>
                <div className="grid gap-2">
                  {data.cycleMonths.map((month) => (
                    <div key={month.id} className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-[#0D0F14]/60 px-3 py-3">
                      <span className="text-sm font-bold text-white">{month.longLabel}</span>
                      <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-white/62">
                        {getCountdownLabel(month.targetDate, data.generatedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {notice ? <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{notice}</div> : null}

        <div className="flex flex-col gap-3 rounded-[28px] border border-white/[0.07] bg-[#13161E]/90 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="px-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">Mode tampilan</p>
            <p className="mt-1 text-sm text-white/58">Pilih view area aktif atau bandingkan Cutting, Prep, dan CSC sekaligus.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setViewMode("area")}
              className={`rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.14em] transition ${
                viewMode === "area"
                  ? "border-amber-300/70 bg-[#F5A623] text-[#0D0F14]"
                  : "border-white/[0.08] bg-white/[0.03] text-white/62 hover:border-amber-300/35 hover:text-white"
              }`}
            >
              Per Area
            </button>
            <button
              type="button"
              onClick={() => setViewMode("compare")}
              className={`rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.14em] transition ${
                viewMode === "compare"
                  ? "border-amber-300/70 bg-[#F5A623] text-[#0D0F14]"
                  : "border-white/[0.08] bg-white/[0.03] text-white/62 hover:border-amber-300/35 hover:text-white"
              }`}
            >
              Bandingkan Semua Area
            </button>
          </div>
        </div>

        {viewMode === "compare" ? (
          <AreaComparisonChart items={data.items} domains={data.domains} areas={data.areas} />
        ) : (
          <>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {data.domains.map((domain) => {
            const stat = selectedStats[domain.id];
            const risk = calculateDeadlineRisk(domain, stat.progress, new Date(data.generatedAt));
            return (
              <article key={domain.id} className="rounded-[28px] border bg-[#13161E]/92 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]" style={{ borderColor: `${domain.accent}33` }}>
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border text-sm font-black" style={{ borderColor: `${domain.accent}55`, backgroundColor: `${domain.accent}18`, color: domain.accent }}>
                    {domain.icon}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/58">{stat.cycleShort}</span>
                    {risk.level !== "aman" ? (
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${getRiskBadgeClass(risk.level)}`}>
                        ⚠ {risk.level}: {formatDaysRemaining(risk.daysRemaining)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <h2 className="font-heading text-2xl font-black tracking-[-0.04em] text-white">{domain.title}</h2>
                <p className="mt-1 min-h-10 text-sm leading-5 text-white/50">{domain.fullName}</p>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-white/36">{selectedArea}</p>
                    <p className="font-mono mt-1 text-2xl font-bold text-white">{stat.done}/{stat.total}</p>
                  </div>
                  <p className="font-mono text-3xl font-bold" style={{ color: domain.accent }}>{stat.progress}%</p>
                </div>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full transition-all duration-500" style={progressStyle(stat.progress, domain.accent)} />
                </div>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <DomainBreakdownChart items={data.items} domains={data.domains} activeArea={selectedArea} />

          <article className="rounded-[28px] border border-white/[0.07] bg-[#13161E]/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">
                  Ringkasan Analisis Otomatis
                </p>
                <h3 className="font-heading mt-2 text-3xl font-black tracking-[-0.05em] text-white">
                  Insight {selectedArea}
                </h3>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-lg">
                ✦
              </span>
            </div>
            <div className="space-y-3">
              {auditInsights.map((insight, index) => (
                <div key={`${index}-${insight}`} className="rounded-2xl border border-white/[0.06] bg-[#0D0F14]/55 px-4 py-3">
                  <p className="text-sm leading-6 text-white/72">{insight}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <div className="flex flex-col gap-3 rounded-[28px] border border-white/[0.07] bg-[#13161E]/90 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">Control center</p>
            <p className="mt-1 text-sm text-white/62">Reset dapat dilakukan per area/domain atau total. Log temuan tetap disimpan.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a href="/api/audit/export-excel" className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-center text-sm font-black uppercase tracking-[0.14em] text-emerald-100 transition hover:border-emerald-300/50">
              Export Excel
            </a>
            <a href="/api/audit/export-pdf" className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-center text-sm font-black uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/50">
              Export PDF Ringkas
            </a>
            <button type="button" onClick={() => handleReset(undefined, selectedArea)} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-white/62 transition hover:border-amber-300/40 hover:text-white">
              Reset Area {selectedArea}
            </button>
            <button type="button" onClick={() => handleReset()} className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-red-100 transition hover:border-red-300/50">
              Reset Total
            </button>
          </div>
        </div>

        <section className="space-y-4">
          {data.domains.map((domain) => {
            const domainItems = data.items.filter((item) => item.area === selectedArea && item.domain === domain.id);
            const stat = selectedStats[domain.id];
            const isExpanded = expanded[domain.id];

            return (
              <article key={domain.id} className="overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#13161E]/90 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
                <button type="button" onClick={() => setExpanded((current) => ({ ...current, [domain.id]: !current[domain.id] }))} className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex items-center gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl border text-sm font-black" style={{ borderColor: `${domain.accent}55`, backgroundColor: `${domain.accent}18`, color: domain.accent }}>{domain.icon}</div>
                    <div>
                      <h3 className="font-heading text-2xl font-black tracking-[-0.04em] text-white">{domain.title}</h3>
                      <p className="mt-1 text-sm text-white/50">{selectedArea} • {stat.done}/{stat.total} item • {stat.cycleText}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xl font-bold" style={{ color: domain.accent }}>{stat.progress}%</span>
                    <span className="text-2xl text-white/50">{isExpanded ? "−" : "+"}</span>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="border-t border-white/[0.07] p-5 sm:p-6">
                    <div className="grid gap-3">
                      {domainItems.map((item) => (
                        <button key={item.id} type="button" onClick={() => handleToggleItem(item)} disabled={busyKey === `item-${item.id}`} className={`flex items-start gap-4 rounded-2xl border p-4 text-left transition ${item.checked ? "border-emerald-300/20 bg-emerald-400/10" : "border-white/[0.07] bg-[#0D0F14]/55 hover:border-white/[0.14]"} disabled:cursor-wait disabled:opacity-60`}>
                          <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-sm font-black ${item.checked ? "border-emerald-300/50 bg-emerald-400 text-[#0D0F14]" : "border-white/[0.16] bg-white/[0.03] text-transparent"}`}>✓</span>
                          <span className="min-w-0 flex-1">
                            <span className={`mb-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${item.priority === "KRITIS" ? "border-red-300/20 bg-red-400/10 text-red-100" : "border-yellow-300/20 bg-yellow-400/10 text-yellow-100"}`}>{item.priority}</span>
                            <span className="block text-sm leading-6 text-white/78">{item.description}</span>
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="rounded-3xl border border-white/[0.07] bg-[#0D0F14]/50 p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">Siklus bulanan resmi</p>
                        <p className="mt-1 text-sm text-white/62">{stat.cycleText}</p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          {data.cycleMonths.map((month) => {
                            const cycle = data.cycles.find((item) => item.area === selectedArea && item.domain === domain.id && item.cycleMonth === month.id);
                            const status = cycle?.status ?? "pending";
                            return (
                              <button key={month.id} type="button" onClick={() => handleMonthlyCycle(selectedArea, domain.id, month.id, status)} disabled={busyKey === `cycle-${selectedArea}-${domain.id}-${month.id}`} className={`rounded-2xl border px-4 py-3 text-sm font-black transition disabled:opacity-50 ${status === "passed" ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100" : "border-white/[0.08] bg-white/[0.03] text-white/62 hover:border-amber-300/40 hover:text-white"}`}>
                                {month.label}: {status === "passed" ? "Lulus" : "Pending"}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/[0.07] bg-[#0D0F14]/50 p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">Reset scope</p>
                        <p className="mt-2 text-sm leading-6 text-white/58">Reset hanya untuk {domain.title} di area {selectedArea}; log temuan tetap aman.</p>
                        <button type="button" onClick={() => handleReset(domain.id, selectedArea)} className="mt-4 w-full rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-red-100 transition hover:border-red-300/50">
                          Reset {domain.title} / {selectedArea}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>

        <section className="rounded-[28px] border border-white/[0.07] bg-[#13161E]/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">Weekly Execution Planner</p>
              <h3 className="font-heading mt-2 text-3xl font-black tracking-[-0.05em] text-white">Week 1 & Week 2 • {selectedArea}</h3>
              <p className="mt-2 text-sm leading-6 text-white/58">Klik chevron Senin-Jumat untuk mengganti status Planned → Running → Done.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/46">
              <span className="rounded-full border border-white/[0.08] px-3 py-1">Planned</span>
              <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-amber-100">Running</span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-emerald-100">Done</span>
            </div>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            {([1, 2] as const).map((weekNumber) => {
              const weekItems = data.planner.filter((item) => item.area === selectedArea && item.weekNumber === weekNumber);
              return (
                <div key={weekNumber} className="rounded-3xl border border-white/[0.07] bg-[#0D0F14]/55 p-4">
                  <p className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-white/58">Week {weekNumber}</p>
                  <div className="grid gap-2 sm:grid-cols-5">
                    {weekItems.map((planner) => {
                      const domain = data.domains.find((item) => item.id === planner.domain) as AuditDomainView | undefined;
                      return (
                        <button key={planner.id} type="button" onClick={() => handlePlannerStatus(planner)} disabled={busyKey === `planner-${planner.id}`} className={`min-h-32 px-3 py-4 text-left transition disabled:opacity-50 ${getPlannerClass(planner.status)}`} style={{ clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)" }}>
                          <span className="block text-xs font-black uppercase tracking-[0.16em]">{planner.dayLabel}</span>
                          <span className="mt-3 block text-sm font-black" style={{ color: domain?.accent ?? "#F5A623" }}>{domain?.title ?? planner.focus}</span>
                          <span className="mt-2 block text-xs leading-5 opacity-75">{planner.activityType} • {planner.focus}</span>
                          <span className="mt-3 inline-flex rounded-full bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.14em]">{planner.status}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
          </>
        )}

        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div id="finding-form" className="rounded-[28px] border border-white/[0.07] bg-[#13161E]/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">Log Temuan Audit</p>
              <h3 className="font-heading mt-2 text-3xl font-black tracking-[-0.05em] text-white">{editingFindingId ? "Edit temuan audit" : "Tambah temuan live"}</h3>
              <p className="mt-2 text-sm leading-6 text-white/58">Field root cause, action plan, dan lesson learned disimpan terstruktur di database.</p>
            </div>

            <form onSubmit={handleFindingSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">Tanggal</span>
                  <input type="date" value={findingDraft.date} onChange={(event) => setFindingDraft((current) => ({ ...current, date: event.target.value }))} className="mt-2 w-full rounded-2xl border border-white/[0.08] bg-[#0D0F14] px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300/60 focus:ring-4 focus:ring-amber-300/10" required />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">Area</span>
                  <select value={findingDraft.area} onChange={(event) => setFindingDraft((current) => ({ ...current, area: event.target.value as AuditArea }))} className="mt-2 w-full rounded-2xl border border-white/[0.08] bg-[#0D0F14] px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300/60 focus:ring-4 focus:ring-amber-300/10">
                    {data.areas.map((area) => <option key={area} value={area}>{area}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">Domain</span>
                  <select value={findingDraft.domain} onChange={(event) => setFindingDraft((current) => ({ ...current, domain: event.target.value as DomainId }))} className="mt-2 w-full rounded-2xl border border-white/[0.08] bg-[#0D0F14] px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300/60 focus:ring-4 focus:ring-amber-300/10">
                    {data.domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.title}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">Auditor</span>
                  <input value={findingDraft.auditor} onChange={(event) => setFindingDraft((current) => ({ ...current, auditor: event.target.value }))} placeholder="Nama auditor ahli" className="mt-2 w-full rounded-2xl border border-white/[0.08] bg-[#0D0F14] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-amber-300/60 focus:ring-4 focus:ring-amber-300/10" required />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">Hasil</span>
                  <select value={findingDraft.result} onChange={(event) => setFindingDraft((current) => ({ ...current, result: event.target.value as AuditResult }))} className="mt-2 w-full rounded-2xl border border-white/[0.08] bg-[#0D0F14] px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300/60 focus:ring-4 focus:ring-amber-300/10">
                    {AUDIT_RESULTS.map((result) => <option key={result} value={result}>{result}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">Root Cause</span>
                <textarea value={findingDraft.rootCause} onChange={(event) => setFindingDraft((current) => ({ ...current, rootCause: event.target.value }))} rows={3} placeholder="Akar penyebab temuan atau kegagalan pass." className="mt-2 w-full resize-none rounded-2xl border border-white/[0.08] bg-[#0D0F14] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-amber-300/60 focus:ring-4 focus:ring-amber-300/10" />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">Action Plan</span>
                <textarea value={findingDraft.actionPlan} onChange={(event) => setFindingDraft((current) => ({ ...current, actionPlan: event.target.value }))} rows={3} placeholder="Action owner, deadline, dan evidence yang harus disiapkan." className="mt-2 w-full resize-none rounded-2xl border border-white/[0.08] bg-[#0D0F14] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-amber-300/60 focus:ring-4 focus:ring-amber-300/10" />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">Lesson Learned</span>
                <textarea value={findingDraft.lessonLearned} onChange={(event) => setFindingDraft((current) => ({ ...current, lessonLearned: event.target.value }))} rows={3} placeholder="Pembelajaran agar area lain tidak mengulang temuan yang sama." className="mt-2 w-full resize-none rounded-2xl border border-white/[0.08] bg-[#0D0F14] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-amber-300/60 focus:ring-4 focus:ring-amber-300/10" />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="submit" disabled={busyKey === "finding-submit"} className="flex-1 rounded-2xl bg-[#F5A623] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#0D0F14] transition hover:bg-amber-300 disabled:opacity-50">
                  {busyKey === "finding-submit" ? "Menyimpan..." : editingFindingId ? "Update Temuan" : "Tambah Temuan"}
                </button>
                {editingFindingId ? (
                  <button type="button" onClick={() => { setEditingFindingId(null); setFindingDraft(createEmptyDraft(data.generatedAt, selectedArea)); }} className="rounded-2xl border border-white/[0.08] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white/60 transition hover:text-white">Batal</button>
                ) : null}
              </div>
            </form>
          </div>

          <div className="rounded-[28px] border border-white/[0.07] bg-[#13161E]/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">Timeline</p>
                <h3 className="font-heading mt-2 text-3xl font-black tracking-[-0.05em] text-white">Log temuan audit</h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[620px]">
                <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value as AuditArea | typeof AREA_FILTER_ALL)} className="rounded-2xl border border-white/[0.08] bg-[#0D0F14] px-3 py-2.5 text-sm text-white outline-none">
                  <option value={AREA_FILTER_ALL}>Semua area</option>
                  {data.areas.map((area) => <option key={area} value={area}>{area}</option>)}
                </select>
                <select value={domainFilter} onChange={(event) => setDomainFilter(event.target.value as DomainId | typeof DOMAIN_FILTER_ALL)} className="rounded-2xl border border-white/[0.08] bg-[#0D0F14] px-3 py-2.5 text-sm text-white outline-none">
                  <option value={DOMAIN_FILTER_ALL}>Semua domain</option>
                  {data.domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.title}</option>)}
                </select>
                <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value as AuditResult | typeof RESULT_FILTER_ALL)} className="rounded-2xl border border-white/[0.08] bg-[#0D0F14] px-3 py-2.5 text-sm text-white outline-none">
                  <option value={RESULT_FILTER_ALL}>Semua hasil</option>
                  {AUDIT_RESULTS.map((result) => <option key={result} value={result}>{result}</option>)}
                </select>
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Cari root/action" className="rounded-2xl border border-white/[0.08] bg-[#0D0F14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25" />
              </div>
            </div>

            <div className="space-y-3">
              {filteredFindings.length ? filteredFindings.map((finding) => (
                <article key={finding.id} className="rounded-3xl border border-white/[0.07] bg-[#0D0F14]/55 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/62">{formatDateId(finding.date)}</span>
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-bold text-white">{finding.area}</span>
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-bold text-white">{finding.domain}</span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getResultClass(finding.result)}`}>{finding.result}</span>
                      </div>
                      <p className="mt-3 text-sm font-bold text-white">Auditor: {finding.auditor}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleEditFinding(finding)} className="rounded-full border border-white/[0.08] px-3 py-1.5 text-xs font-bold text-white/58 transition hover:text-white">Edit</button>
                      <button type="button" onClick={() => handleDeleteFinding(finding)} disabled={busyKey === `finding-delete-${finding.id}`} className="rounded-full border border-red-300/20 px-3 py-1.5 text-xs font-bold text-red-100 transition hover:border-red-300/50 disabled:opacity-50">Hapus</button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/34">Root Cause</p>
                      <p className="mt-2 text-sm leading-6 text-white/68">{finding.rootCause || "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/34">Action Plan</p>
                      <p className="mt-2 text-sm leading-6 text-white/68">{finding.actionPlan || "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/34">Lesson Learned</p>
                      <p className="mt-2 text-sm leading-6 text-white/68">{finding.lessonLearned || "-"}</p>
                    </div>
                  </div>
                </article>
              )) : (
                <div className="rounded-3xl border border-dashed border-white/[0.12] bg-[#0D0F14]/45 p-8 text-center text-sm text-white/48">Belum ada temuan yang cocok dengan filter.</div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/[0.07] bg-[#13161E]/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">Mentor summary</p>
              <h3 className="font-heading mt-2 text-3xl font-black tracking-[-0.05em] text-white">Ringkasan otomatis siap-copy</h3>
              <p className="mt-2 text-sm leading-6 text-white/58">Ringkasan berisi breakdown per area, status siklus bulanan, item kritis terbuka, temuan terbaru, dan fokus minggu berikutnya.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => setMentorSummary(buildMentorSummary(data))} className="rounded-2xl bg-[#F5A623] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#0D0F14] transition hover:bg-amber-300">Generate Ringkas</button>
              <button type="button" onClick={copySummary} disabled={!mentorSummary} className="rounded-2xl border border-white/[0.08] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white/62 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40">Copy</button>
            </div>
          </div>
          <textarea value={mentorSummary} onChange={(event) => setMentorSummary(event.target.value)} placeholder="Klik Generate Ringkas untuk menyusun report mentor otomatis." rows={14} className="font-mono mt-6 w-full resize-y rounded-3xl border border-white/[0.08] bg-[#0D0F14] px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-amber-300/60 focus:ring-4 focus:ring-amber-300/10" />
        </section>

        <footer className="pb-6 text-center text-xs text-white/34">
          Audit Crucible Tracker • Neon HTTP ready • Area Cutting/Prep/CSC • Monthly cycle Agu/Sep/Okt • Tanpa localStorage/sessionStorage
        </footer>
      </div>
    </main>
  );
}
