"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AuditArea } from "@/lib/audit-config";
import type { AuditDomainView, AuditItemRecord } from "@/lib/audit-types";

type Props = {
  items: AuditItemRecord[];
  domains: AuditDomainView[];
  areas: AuditArea[];
};

type AreaSummary = {
  done: number;
  total: number;
  percentage: number;
};

type ChartDatum = {
  domain: string;
  fullName: string;
  summaries: Record<AuditArea, AreaSummary>;
} & Record<AuditArea, number>;

const AREA_COLORS: Record<AuditArea, string> = {
  Cutting: "#CBD5E1",
  Prep: "#93C5FD",
  CSC: "#C4B5FD",
};

function getAreaSummary(items: AuditItemRecord[], domainId: string, area: AuditArea): AreaSummary {
  const scoped = items.filter((item) => item.area === area && item.domain === domainId);
  const done = scoped.filter((item) => item.checked).length;
  const total = scoped.length;

  return {
    done,
    total,
    percentage: total ? Math.round((done / total) * 100) : 0,
  };
}

function buildChartData(
  items: AuditItemRecord[],
  domains: AuditDomainView[],
  areas: AuditArea[],
): ChartDatum[] {
  return domains.map((domain) => {
    const summaries = areas.reduce((accumulator, area) => {
      accumulator[area] = getAreaSummary(items, domain.id, area);
      return accumulator;
    }, {} as Record<AuditArea, AreaSummary>);
    const areaValues = areas.reduce((accumulator, area) => {
      accumulator[area] = summaries[area].percentage;
      return accumulator;
    }, {} as Record<AuditArea, number>);

    return {
      domain: domain.title,
      fullName: domain.fullName,
      summaries,
      ...areaValues,
    };
  });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number; color?: string; payload?: ChartDatum }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0D0F14]/95 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur">
      <p className="mb-2 text-sm font-black text-white">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => {
          const area = entry.dataKey as AuditArea;
          const summary = entry.payload?.summaries?.[area];
          return (
            <div key={area} className="flex items-center justify-between gap-5 text-xs">
              <span className="font-bold" style={{ color: entry.color }}>
                {area}
              </span>
              <span className="text-white/70">
                {summary ? `${summary.done}/${summary.total}` : "0/0"} ({entry.value ?? 0}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AreaComparisonChart({ items, domains, areas }: Props) {
  const chartData = buildChartData(items, domains, areas);

  return (
    <section className="rounded-[28px] border border-white/[0.07] bg-[#13161E]/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">
            Perbandingan Lintas Area
          </p>
          <h3 className="font-heading mt-2 text-3xl font-black tracking-[-0.05em] text-white">
            Bandingkan Semua Area
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/58">
            Persentase checklist selesai per domain untuk Cutting, Prep, dan CSC.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {areas.map((area) => (
            <span
              key={area}
              className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-bold"
              style={{ color: AREA_COLORS[area] }}
            >
              {area}
            </span>
          ))}
        </div>
      </div>

      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 18, bottom: 20, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="domain"
              tick={{ fill: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.025)" }} />
            <Legend wrapperStyle={{ color: "rgba(255,255,255,0.68)", fontSize: 12 }} />
            {areas.map((area) => (
              <Bar key={area} dataKey={area} fill={AREA_COLORS[area]} radius={[8, 8, 0, 0]} barSize={18} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 overflow-x-auto rounded-3xl border border-white/[0.07] bg-[#0D0F14]/45">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/[0.07] text-left text-xs uppercase tracking-[0.16em] text-white/42">
              <th className="px-4 py-3">Domain</th>
              {areas.map((area) => (
                <th key={area} className="px-4 py-3" style={{ color: AREA_COLORS[area] }}>
                  {area}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.domain} className="border-b border-white/[0.05] last:border-0">
                <td className="px-4 py-3 font-bold text-white">{row.domain}</td>
                {areas.map((area) => {
                  const summary = row.summaries[area];
                  return (
                    <td key={area} className="px-4 py-3 font-mono text-white/72">
                      {summary.done}/{summary.total} ({summary.percentage}%)
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
