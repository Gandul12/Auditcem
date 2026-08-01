export type DeadlineRiskLevel = "aman" | "waspada" | "berisiko";

export type DeadlineRiskInput = {
  targetCalendarMonth: number;
  targetDay: number;
};

export type DeadlineRiskResult = {
  level: DeadlineRiskLevel;
  daysRemaining: number;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calculateDeadlineRisk(
  domain: DeadlineRiskInput,
  completionPercent: number,
  today = new Date(),
): DeadlineRiskResult {
  const currentDate = startOfDay(today);
  const targetDate = startOfDay(
    new Date(today.getFullYear(), domain.targetCalendarMonth - 1, domain.targetDay),
  );
  const daysRemaining = Math.ceil((targetDate.getTime() - currentDate.getTime()) / 86_400_000);

  if (daysRemaining <= 14 && completionPercent < 50) {
    return { level: "berisiko", daysRemaining };
  }

  if (daysRemaining <= 30 && completionPercent < 75) {
    return { level: "waspada", daysRemaining };
  }

  return { level: "aman", daysRemaining };
}

export function formatDaysRemaining(daysRemaining: number): string {
  if (daysRemaining > 0) {
    return `${daysRemaining} hari lagi`;
  }

  if (daysRemaining === 0) {
    return "hari ini";
  }

  return `lewat ${Math.abs(daysRemaining)} hari`;
}
