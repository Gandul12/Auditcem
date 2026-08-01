"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
  activeArea: AuditArea;
};

type ChartDatum = {
  id: string;
  title: string;
  progress: number;
  done: number;
  total: number;
  accent: string;
};

function buildChartData(items: AuditItemRecord[], domains: AuditDomainView[], activeArea: AuditArea): ChartDatum[] {
  return domains.map((domain) => {
    const domainItems = items.filter((item) => item.area === activeArea && item.domain === domain.id);
    const done = domainItems.filter((item) => item.checked).length;
    const total = domainItems.length;

    return {
      id: domain.id,
      title: domain.title,
      progress: total ? Math.round((done / total) * 100) : 0,
      done,
      total,
      accent: domain.accent,
    };
  });
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartDatum }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const data = payload[0]?.payload;

  if (!data) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0D0F14]/95 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur">
      <p className="text-sm font-black text-white" style={{ color: data.accent }}>
        {data.title}
      </p>
      <p className="mt-1 text-xs text-white/62">
        {data.done}/{data.total} item selesai
      </p>
      <p className="font-mono mt-2 text-lg font-bold text-white">{data.progress}%</p>
    </div>
  );
}

export function DomainBreakdownChart({ items, domains, activeArea }: Props) {
  const chartData = buildChartData(items, domains, activeArea);

  return (
    <section className="rounded-[28px] border border-white/[0.07] bg-[#13161E]/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">
            Chart Breakdown Per Domain
          </p>
          <h3 className="font-heading mt-2 text-3xl font-black tracking-[-0.05em] text-white">
            Kesiapan {activeArea}
          </h3>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-bold text-white/58">
          5 domain audit
        </span>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 36, bottom: 8, left: 22 }}
          >
            <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              type="category"
              dataKey="title"
              width={132}
              tick={{ fill: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.025)" }} />
            <Bar dataKey="progress" radius={[0, 10, 10, 0]} barSize={18} background={{ fill: "rgba(255,255,255,0.055)", radius: 10 }}>
              {chartData.map((entry) => (
                <Cell key={entry.id} fill={entry.accent} />
              ))}
              <LabelList
                dataKey="progress"
                position="right"
                formatter={(value) => `${value ?? 0}%`}
                fill="rgba(255,255,255,0.72)"
                fontSize={12}
                fontWeight={700}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
