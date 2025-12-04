"use client";

import { useState, ChangeEvent } from "react";
import Papa, { ParseResult } from "papaparse";

import {
  LineChart,
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
  Area,
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

// main dashboard card chrome
const CARD_CLASS =
  "relative overflow-hidden rounded-3xl border border-jr-border " +
  "bg-gradient-to-b from-[#050816]/90 via-[#020617]/95 to-[#020617] " +
  "px-5 py-4 shadow-[0_24px_60px_rgba(15,23,42,0.95)] backdrop-blur-xl";

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
    <div className="rounded-md border border-jr-border bg-jr-surface px-3 py-2 text-xs text-jr-text">
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
        // TODO: map your CSV rows into your event shape if you actually want to use this
        console.log("Parsed CSV rows", rows);
        // setRawEvents(mappedRows);
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
      label: "All-time payouts",
      value: totalPayouts,
      format: "currency",
    },
    {
      label: "Challenge fees paid",
      value: -totalFees,
      format: "currency",
    },
    { label: "Current PnL", value: currentPnl, format: "currency" },

    { label: "Total evaluations", value: totalEvaluations, format: "int" },
    { label: "Active evaluations", value: activeEvaluations, format: "int" },
    { label: "Active funded accounts", value: activeFundedAccs, format: "int" },
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

  /* ----- DAILY PNL HISTORY (CUMULATIVE) ----- */

  const pnlHistory = events
    .slice()
    .sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() // oldest → newest
    )
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
    <main className="relative min-h-screen bg-jr-bg text-jr-text">
      {/* background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10
          bg-[#020617]
          bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.35),transparent_60%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.18),transparent_55%)]"
      />

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6">
        {/* HEADER */}
        <header className="mb-1 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-jr-text">
              Prop Firm Performance
            </h1>
            <p className="mt-1 text-[11px] text-jr-muted">
              Track challenges, payouts and fees across all your prop firms.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="text-jr-muted">Firm:</span>
              <select
                value={selectedFirm}
                onChange={(e) => setSelectedFirm(e.target.value)}
                className="rounded-full border border-jr-border bg-jr-surface px-3 py-1 text-[11px] text-jr-text outline-none ring-0 focus:border-jr-primary"
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
              <span className="text-jr-muted">Load events CSV:</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleEventsCsvChange}
                className="text-[11px] text-jr-muted file:mr-2 file:rounded-full file:border file:border-jr-border file:bg-jr-surface file:px-3 file:py-1 file:text-[11px] file:text-jr-text hover:file:border-jr-primary"
              />
            </div>
          </div>
        </header>

        {/* KPI CARDS */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className={CARD_CLASS}>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-jr-muted">
                {kpi.label}
              </p>
              <p className="mt-2 text-[18px] font-semibold text-jr-text">
                {formatValue(kpi.value, kpi.format)}
              </p>
            </div>
          ))}
        </section>

        {/* MAIN CHARTS */}
        <section className="grid gap-6 lg:grid-cols-3">
          {/* PnL chart */}
          <div
            className={`${CARD_CLASS} lg:col-span-2 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),transparent_60%)]`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-jr-text">
                Current PnL in USD
              </h2>
              <span className="text-[11px] text-jr-muted">
                Payouts minus challenge fees
              </span>
            </div>

            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pnlHistory}>
                  <defs>
                    <linearGradient id="pnlArea" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#38bdf8"
                        stopOpacity={0.45}
                      />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#111827" />
                  <XAxis
                    dataKey="date"
                    stroke="#6b7280"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #1f2937",
                      borderRadius: 12,
                      fontSize: 11,
                      color: "#e5e7eb",
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke="#38bdf8"
                    strokeWidth={2.6}
                    fill="url(#pnlArea)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Account size donut */}
          <div className={CARD_CLASS}>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-jr-text">
                Account sizes (evaluations)
              </h2>
              <span className="text-[11px] text-jr-muted">
                {totalAccounts} total
              </span>
            </div>

            <div className="mt-3 h-64">
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
                    wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
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
          </div>
        </section>

        {/* BOTTOM CHARTS */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Payouts by firm */}
          <div className={CARD_CLASS}>
            <h2 className="mb-3 text-xs font-semibold text-jr-text">
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
                  <XAxis
                    type="number"
                    stroke="#6b7280"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                  />
                  <YAxis
                    dataKey="firm"
                    type="category"
                    stroke="#6b7280"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    width={160}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #1f2937",
                      borderRadius: 12,
                      fontSize: 11,
                      color: "#e5e7eb",
                    }}
                  />
                  <Bar dataKey="payouts" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly payouts vs fees */}
          <div className={CARD_CLASS}>
            <h2 className="mb-3 text-xs font-semibold text-jr-text">
              Monthly payouts vs challenge fees
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyPerf}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#111827" />
                  <XAxis
                    dataKey="month"
                    stroke="#6b7280"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #1f2937",
                      borderRadius: 12,
                      fontSize: 11,
                      color: "#e5e7eb",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                  <Bar
                    dataKey="payouts"
                    name="Payouts"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="fees"
                    name="Challenge fees"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* EVENTS TABLE */}
        <section className={CARD_CLASS}>
          <h2 className="mb-3 text-xs font-semibold text-jr-text">
            Events (payouts & fees)
          </h2>
          <EventsTable events={events as any} />
        </section>
      </div>
    </main>
  );
}
