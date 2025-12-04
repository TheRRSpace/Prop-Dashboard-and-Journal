"use client";

import { useState, ChangeEvent } from "react";
import Papa, { ParseResult } from "papaparse";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  RadialBarChart,
  RadialBar,
} from "recharts";

import { events as initialEvents } from "./data/propData";
import { accounts as initialAccounts } from "./data/accountsData";
import EventsTable from "./components/EventsTable";

/* ---------- HELPERS ---------- */

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

// "YYYY-MM-DD" -> "YYYY-MM"
function getMonthKey(dateStr: string) {
  const [year, month] = dateStr.split("-");
  return `${year}-${month}`;
}

// "YYYY-MM" -> "Mar 25"
function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const monthIndex = parseInt(month, 10) - 1;
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const shortYear = year.slice(2);
  return `${names[monthIndex]} ${shortYear}`;
}

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#6b7280"];
const SEGMENT_COLORS = ["#38BDF8", "#60A5FA", "#1D4ED8", "#22C55E", "#FACC15"];

function formatValue(
  value: number,
  format: "currency" | "int" | "percent"
): string {
  if (format === "int") return value.toString();
  if (format === "percent") return `${value.toFixed(1)}%`;

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

/* ---------- CUSTOM TOOLTIP FOR PIE ---------- */

function AccountSizeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: any[];
}) {
  if (!active || !payload || !payload.length) return null;

  const { name, count, percentage } = payload[0].payload;

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100">
      <div className="font-semibold">{name}</div>
      <div>
        {count} account{count !== 1 ? "s" : ""}
      </div>
      <div>{percentage.toFixed(1)}% of total</div>
    </div>
  );
}

/* ---------- PAGE ---------- */

export default function Home() {
  const [rawEvents, setRawEvents] = useState<any[]>(initialEvents);
  const [accounts] = useState<any[]>(initialAccounts);
  const [selectedFirm, setSelectedFirm] = useState<string>("All");

  /* ----- CSV UPLOAD HANDLER ----- */

  const handleEventsCsvChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<any>) => {
        const rows = results.data as any[];
        // TODO: map CSV rows into your event shape when you feel like suffering
        console.log("Parsed CSV rows", rows);
      },
      error: (error: unknown) => {
        console.error("Error parsing CSV", error);
      },
    });
  };

  /* ----- FIRMS LIST ----- */

  const firms = Array.from(
    new Set([
      ...rawEvents.map((e: any) => e.propFirm),
      ...accounts.map((a: any) => a.propFirm),
    ])
  )
    .filter(Boolean)
    .sort();

  /* ----- APPLY FILTERS ----- */

  const events =
    selectedFirm === "All"
      ? rawEvents
      : rawEvents.filter((e: any) => e.propFirm === selectedFirm);

  const filteredAccounts =
    selectedFirm === "All"
      ? accounts
      : accounts.filter((a: any) => a.propFirm === selectedFirm);

  /* ----- EVENTS METRICS ----- */

  const payoutEvents = events.filter((e: any) => e.type === "payout");
  const feeEvents = events.filter((e: any) => e.type === "fee");

  const totalPayouts = sum(payoutEvents.map((e: any) => e.amount));
  const totalFees = sum(feeEvents.map((e: any) => e.amount));
  const currentPnl = totalPayouts - totalFees;

  /* ----- ACCOUNT METRICS ----- */

  const fundedAmount = filteredAccounts
    .filter((a: any) => a.type === "funded" && a.isActive)
    .reduce((acc: number, a: any) => acc + a.size, 0);

  const totalEvaluations = filteredAccounts.filter(
    (a: any) => a.type === "evaluation"
  ).length;

  const activeEvaluations = filteredAccounts.filter(
    (a: any) => a.type === "evaluation" && a.isActive
  ).length;

  const activeFundedAccs = filteredAccounts.filter(
    (a: any) => a.type === "funded" && a.isActive
  ).length;

  const failedChallenges = filteredAccounts.filter(
    (a: any) => a.stage === "failed"
  ).length;

  /* ----- FUNNEL METRICS (EVALUATIONS ONLY) ----- */

  const evalAccounts = filteredAccounts.filter(
    (a: any) => a.type === "evaluation"
  );
  const totalEvalAccounts = evalAccounts.length;

  const phase1PassedCount = evalAccounts.filter((a: any) =>
    ["phase2", "funded", "payout"].includes(a.stage)
  ).length;

  const phase2PassedCount = evalAccounts.filter((a: any) =>
    ["funded", "payout"].includes(a.stage)
  ).length;

  const fundedReachedCount = evalAccounts.filter((a: any) =>
    ["funded", "payout"].includes(a.stage)
  ).length;

  const payoutReachedCount = evalAccounts.filter(
    (a: any) => a.stage === "payout"
  ).length;

  const toPercent = (num: number, denom: number) =>
    denom === 0 ? 0 : (num / denom) * 100;

  const phase1PassRate = toPercent(phase1PassedCount, totalEvalAccounts);
  const phase2PassRate = toPercent(phase2PassedCount, totalEvalAccounts);
  const fundedRate = toPercent(fundedReachedCount, totalEvalAccounts);
  const payoutRate = toPercent(payoutReachedCount, totalEvalAccounts);

  /* ----- KPI CARDS ----- */

  const kpis: {
    label: string;
    value: number;
    format: "currency" | "int" | "percent";
  }[] = [
    {
      label: "Current funded amount",
      value: fundedAmount,
      format: "currency",
    },
    {
      label: "All-time total payouts",
      value: totalPayouts,
      format: "currency",
    },
    {
      label: "Challenge fees paid",
      value: -totalFees,
      format: "currency",
    },
    { label: "Current PnL ($)", value: currentPnl, format: "currency" },

    { label: "Total evaluations", value: totalEvaluations, format: "int" },
    { label: "Active evaluations", value: activeEvaluations, format: "int" },
    { label: "Active funded accs", value: activeFundedAccs, format: "int" },
    { label: "Failed challenges", value: failedChallenges, format: "int" },

    { label: "Phase 1 pass rate", value: phase1PassRate, format: "percent" },
    { label: "Phase 2 pass rate", value: phase2PassRate, format: "percent" },
    { label: "Reached funded %", value: fundedRate, format: "percent" },
    { label: "Reached payout %", value: payoutRate, format: "percent" },
  ];

  /* ----- MONTHLY PERFORMANCE (EVENTS) ----- */

  const monthlyMap = new Map<string, { payouts: number; fees: number }>();

  events.forEach((e: any) => {
    const key = getMonthKey(e.date);
    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { payouts: 0, fees: 0 });
    }
    const row = monthlyMap.get(key)!;
    if (e.type === "payout") row.payouts += e.amount;
    if (e.type === "fee") row.fees += e.amount;
  });

  const monthlyPerf = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, vals]) => ({
      month: monthLabel(key),
      payouts: vals.payouts,
      fees: -vals.fees,
    }));

  /* ----- CUMULATIVE PNL HISTORY ----- */

  const pnlHistory = events
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce((acc, ev) => {
      const last = acc.length ? acc[acc.length - 1].pnl : 0;

      let delta = 0;
      if (ev.type === "payout") {
        delta = ev.amount;
      } else if (ev.type === "fee" || ev.type === "purchase") {
        delta = -ev.amount;
      }

      acc.push({
        date: ev.date,
        pnl: last + delta,
      });

      return acc;
    }, [] as { date: string; pnl: number }[]);

  /* ----- ACCOUNT SIZE DONUT (PURCHASED EVALUATIONS) ----- */

  const purchasedAccounts = filteredAccounts.filter(
    (a: any) => a.type === "evaluation"
  );
  const totalAccounts = purchasedAccounts.length;

  const sizeMap = new Map<string, number>();

  purchasedAccounts.forEach((a: any) => {
    const label = `$${a.size / 1000}K`;
    sizeMap.set(label, (sizeMap.get(label) ?? 0) + 1);
  });

  const accountSizeDonut = Array.from(sizeMap.entries()).map(
    ([name, count]) => ({
      name,
      count,
      percentage: totalAccounts === 0 ? 0 : (count / totalAccounts) * 100,
    })
  );

  /* ----- ACTIVE CHALLENGES DONUT DATA ----- */

  const activeEvalAccounts = purchasedAccounts.filter((a: any) => a.isActive);

  const totalActiveFunded = activeEvalAccounts.filter((a: any) =>
    ["funded", "payout"].includes(a.stage)
  ).length;

  const segmentMap = new Map<string, { value: number; fundedCount: number }>();

  activeEvalAccounts.forEach((acc: any) => {
    const key = acc.propFirm;
    const existing = segmentMap.get(key) ?? { value: 0, fundedCount: 0 };
    existing.value += 1;
    if (["funded", "payout"].includes(acc.stage)) {
      existing.fundedCount += 1;
    }
    segmentMap.set(key, existing);
  });

  const segmentData = Array.from(segmentMap.entries()).map(
    ([name, vals], idx) => ({
      name,
      value: vals.value,
      fundedCount: vals.fundedCount,
      fill: SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
    })
  );

  /* ----- PAYOUTS BY FIRM ----- */

  const firmPayoutMap = new Map<string, number>();

  payoutEvents.forEach((e: any) => {
    const current = firmPayoutMap.get(e.propFirm) ?? 0;
    firmPayoutMap.set(e.propFirm, current + e.amount);
  });

  const payoutsByFirm = Array.from(firmPayoutMap.entries()).map(
    ([firm, payouts]) => ({ firm, payouts })
  );

  /* ---------- JSX ---------- */

  return (
    <main className="min-h-screen bg-jr-bg text-jr-text">
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
              Prop Firm Performance
            </h1>
            <p className="text-sm text-slate-400">
              KPIs and charts filtered by prop firm. Events can be loaded from a
              CSV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                Filter by prop firm:
              </span>
              <select
                value={selectedFirm}
                onChange={(e) => setSelectedFirm(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="All">All</option>
                {firms.map((firm) => (
                  <option key={firm} value={firm}>
                    {firm}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Load events CSV:</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleEventsCsvChange}
                className="text-xs text-slate-300 file:mr-2 file:rounded-md file:border file:border-slate-700 file:bg-slate-900 file:px-2 file:py-1 file:text-xs file:text-slate-100 hover:file:border-sky-500"
              />
            </div>
          </div>
        </header>

        {/* KPI cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 shadow-[0_0_40px_rgba(15,23,42,0.7)]"
            >
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                {kpi.label}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-50">
                {formatValue(kpi.value, kpi.format)}
              </p>
            </div>
          ))}
        </section>

        {/* PnL full-width */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-[0_0_50px_rgba(15,23,42,0.9)]">
          <h2 className="mb-4 text-sm font-semibold text-slate-300">
            Current PnL in USD (payouts minus challenge fees)
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pnlHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#111827" />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  tick={{ fontSize: 10 }}
                  tickMargin={6}
                />
                <YAxis
                  stroke="#9ca3af"
                  tick={{ fontSize: 10 }}
                  tickMargin={6}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#020617",
                    border: "1px solid #1e293b",
                    borderRadius: "0.75rem",
                    color: "#e5e7eb",
                    fontSize: "11px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pnl"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Active challenges + account sizes */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Active challenges overview */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Active challenges overview
                </h2>
                <p className="text-[11px] text-slate-400">
                  Evaluation accounts by prop, visualized as a segmented ring.
                </p>
              </div>

              <div className="flex flex-col items-end gap-1 text-[11px] text-slate-300">
                <span className="rounded-full bg-slate-900/80 px-2 py-0.5">
                  {activeEvalAccounts.length} active · {segmentData.length}{" "}
                  props
                </span>
                <span className="text-[10px] text-slate-500">
                  {totalAccounts} evaluations purchased in total
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-col items-center gap-6 md:flex-row md:items-center md:justify-between">
              {/* Donut */}
              <div className="relative h-56 w-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="90%"
                    data={segmentData}
                    startAngle={220}
                    endAngle={-40}
                  >
                    <RadialBar
                      dataKey="value"
                      cornerRadius={30}
                      minAngle={8}
                      background
                    />
                  </RadialBarChart>
                </ResponsiveContainer>

                {/* Center label */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    Active
                  </p>
                  <p className="text-2xl font-semibold text-slate-50">
                    {activeEvalAccounts.length}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">evaluations</p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {activeEvalAccounts.length === 0
                      ? "0% reached funded"
                      : `${Math.round(
                          (totalActiveFunded / activeEvalAccounts.length) * 100
                        )}% reached funded`}
                  </p>
                </div>
              </div>

              {/* Legend */}
              <div className="w-full max-w-xs space-y-2 text-[11px] md:max-w-sm">
                {segmentData.length === 0 && (
                  <p className="text-slate-500">
                    No active evaluation accounts right now.
                  </p>
                )}

                {segmentData.map((seg) => (
                  <div
                    key={seg.name}
                    className="flex items-center justify-between rounded-full border border-slate-800 bg-slate-900/90 px-3 py-1 shadow-sm shadow-slate-950/60"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: seg.fill }}
                      />
                      <span className="max-w-[120px] truncate text-slate-100">
                        {seg.name}
                      </span>
                    </span>

                    <span className="flex gap-2 text-slate-400">
                      <span>{seg.value} active</span>
                      {seg.fundedCount > 0 && (
                        <span className="text-emerald-400">
                          {seg.fundedCount} funded
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active challenges list */}
            <div className="mt-5 rounded-xl border border-slate-800/80 bg-slate-950/60">
              <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-2 text-[11px] text-slate-400">
                <span>Prop / challenge</span>
                <span className="flex gap-8">
                  <span>Size</span>
                  <span>Stage</span>
                </span>
              </div>

              <div className="max-h-56 overflow-auto text-xs">
                {activeEvalAccounts.length === 0 ? (
                  <div className="px-4 py-3 text-[11px] text-slate-500">
                    No active challenges at the moment.
                  </div>
                ) : (
                  activeEvalAccounts.map((acc: any) => (
                    <div
                      key={acc.id ?? `${acc.propFirm}-${acc.size}-${acc.stage}`}
                      className="flex items-center justify-between border-b border-slate-800/60 px-4 py-2 last:border-0"
                    >
                      <div className="flex flex-col">
                        <span className="text-[11px] font-medium text-slate-100">
                          {acc.propFirm}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Evaluation
                        </span>
                      </div>
                      <div className="flex items-center gap-8 text-[11px]">
                        <span className="text-slate-100">
                          {acc.size.toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          })}
                        </span>
                        <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                          {acc.stage}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-slate-800/80 px-4 py-2 text-[10px] text-slate-500">
                Total evaluations purchased: {totalAccounts}
              </div>
            </div>
          </section>

          {/* Account sizes donut */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-300">
              Account sizes (evaluations)
            </h2>
            <p className="mb-3 text-[11px] text-slate-400">
              Total accounts purchased: {totalAccounts}
            </p>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={accountSizeDonut}
                    dataKey="count"
                    nameKey="name"
                    outerRadius={90}
                    labelLine={false}
                    label={(entry: any) => `${entry.count}`}
                  >
                    {accountSizeDonut.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<AccountSizeTooltip />} />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    formatter={(value, entry: any) => {
                      const item = entry.payload;
                      return `${item.name} (${
                        item.count
                      }, ${item.percentage.toFixed(0)}%)`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        </section>

        {/* Bottom charts */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-300">
              Payouts by prop firm
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={payoutsByFirm}
                  layout="vertical"
                  margin={{ left: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#111827" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis
                    dataKey="firm"
                    type="category"
                    stroke="#9ca3af"
                    width={160}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #1e293b",
                      borderRadius: "0.5rem",
                      color: "#e5e7eb",
                    }}
                  />
                  <Bar dataKey="payouts" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-300">
              Monthly payouts vs challenge fees
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyPerf}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#111827" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #1e293b",
                      borderRadius: "0.5rem",
                      color: "#e5e7eb",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="payouts" name="Payouts" fill="#3b82f6" />
                  <Bar dataKey="fees" name="Challenge fees" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Events table */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <EventsTable events={events as any} />
        </section>
      </div>
    </main>
  );
}
