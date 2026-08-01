import { AUDIT_DOMAINS, type DomainId } from "./audit-config";
import { calculateDeadlineRisk, formatDaysRemaining } from "./deadlineRisk";
import type { AuditFindingRecord, AuditItemRecord } from "./audit-types";

type DomainProgress = {
  domain: DomainId;
  title: string;
  done: number;
  total: number;
  percentage: number;
};

const FAILURE_PATTERN = /tidak\s*lulus|gagal|fail|failed|failure/i;

function percentage(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function formatAreaScope(items: AuditItemRecord[]): string {
  const areas = Array.from(new Set(items.map((item) => item.area)));

  if (areas.length === 1) {
    return `di area ${areas[0]}`;
  }

  if (areas.length > 1) {
    return "di seluruh area";
  }

  return "pada scope aktif";
}

function getDomainProgress(items: AuditItemRecord[]): DomainProgress[] {
  return AUDIT_DOMAINS.map((domain) => {
    const domainItems = items.filter((item) => item.domain === domain.id);
    const done = domainItems.filter((item) => item.checked).length;

    return {
      domain: domain.id,
      title: domain.title,
      done,
      total: domainItems.length,
      percentage: percentage(done, domainItems.length),
    };
  }).filter((item) => item.total > 0);
}

function isFailedFinding(finding: AuditFindingRecord): boolean {
  return (
    FAILURE_PATTERN.test(finding.result) ||
    FAILURE_PATTERN.test(finding.rootCause) ||
    FAILURE_PATTERN.test(finding.actionPlan) ||
    FAILURE_PATTERN.test(finding.lessonLearned)
  );
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function generateAuditInsight(
  items: AuditItemRecord[],
  findings: AuditFindingRecord[],
): string[] {
  if (items.length === 0) {
    return ["Belum ada data checklist yang dapat dianalisis untuk scope audit saat ini."];
  }

  const insights: string[] = [];
  const scope = formatAreaScope(items);
  const total = items.length;
  const done = items.filter((item) => item.checked).length;
  const overallPercentage = percentage(done, total);
  const domainProgress = getDomainProgress(items);

  insights.push(
    `Dari total ${total} item checklist ${scope}, ${done} item (${overallPercentage}%) sudah selesai dan tersimpan sebagai readiness audit.`,
  );

  const lowestDomain = [...domainProgress].sort(
    (first, second) => first.percentage - second.percentage || first.title.localeCompare(second.title),
  )[0];

  if (lowestDomain) {
    insights.push(
      `Domain ${lowestDomain.title} memerlukan perhatian khusus karena progresnya paling rendah, yaitu ${lowestDomain.percentage}% (${lowestDomain.done}/${lowestDomain.total} item selesai).`,
    );
  }

  const completeDomains = domainProgress.filter((domain) => domain.percentage === 100);

  if (completeDomains.length > 0) {
    insights.push(
      `Domain ${completeDomains.map((domain) => domain.title).join(", ")} sudah mencapai kesiapan penuh 100% pada scope ini dan perlu dijaga konsistensi evidence-nya.`,
    );
  }

  const riskyDomains = domainProgress
    .map((progress) => {
      const domain = AUDIT_DOMAINS.find((item) => item.id === progress.domain);
      const risk = domain ? calculateDeadlineRisk(domain, progress.percentage) : null;
      return domain && risk?.level === "berisiko" ? { domain, progress, risk } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (riskyDomains.length > 0) {
    const firstRisk = riskyDomains[0];
    insights.push(
      `Risiko deadline tertinggi ada pada domain ${firstRisk.domain.title}: progres baru ${firstRisk.progress.percentage}% dengan target ${formatDaysRemaining(firstRisk.risk.daysRemaining)}.`,
    );
  }

  const failedFindings = findings.filter(isFailedFinding);

  if (failedFindings.length > 0) {
    const countByDomain = failedFindings.reduce((accumulator, finding) => {
      accumulator[finding.domain] = (accumulator[finding.domain] ?? 0) + 1;
      return accumulator;
    }, {} as Record<DomainId, number>);
    const topFailure = Object.entries(countByDomain).sort((first, second) => second[1] - first[1])[0];

    if (topFailure) {
      const domainTitle =
        AUDIT_DOMAINS.find((domain) => domain.id === topFailure[0])?.title ?? topFailure[0];
      insights.push(
        `Temuan dengan indikasi tidak lulus/gagal paling sering muncul pada domain ${domainTitle}, sebanyak ${topFailure[1]} kali, sehingga root cause dan action plan domain ini perlu diprioritaskan.`,
      );
    }
  }

  const uniqueFailureDates = Array.from(new Set(failedFindings.map((finding) => finding.date)));

  if (uniqueFailureDates.length >= 2) {
    const latestDate = startOfDay(
      failedFindings
        .map((finding) => new Date(finding.date))
        .sort((first, second) => second.getTime() - first.getTime())[0],
    );
    const latestWindowStart = new Date(latestDate);
    latestWindowStart.setDate(latestWindowStart.getDate() - 6);
    const previousWindowStart = new Date(latestWindowStart);
    previousWindowStart.setDate(previousWindowStart.getDate() - 7);

    const latestCount = failedFindings.filter((finding) => {
      const date = startOfDay(new Date(finding.date));
      return date >= latestWindowStart && date <= latestDate;
    }).length;
    const previousCount = failedFindings.filter((finding) => {
      const date = startOfDay(new Date(finding.date));
      return date >= previousWindowStart && date < latestWindowStart;
    }).length;
    const trend = latestCount > previousCount ? "meningkat" : latestCount < previousCount ? "menurun" : "stabil";

    insights.push(
      `Dalam periode terbaru terdapat ${latestCount} temuan gagal dibanding ${previousCount} pada periode sebelumnya, sehingga tren temuan gagal terlihat ${trend}.`,
    );
  }

  return insights.slice(0, 5);
}
