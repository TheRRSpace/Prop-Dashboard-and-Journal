"use client";

import { useState, ChangeEvent } from "react";
import Papa from "papaparse";

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
      complete: (results) => {
        const rows = results.data as any[];

        const parsed = rows
          .map((row) => {
            const date = String(row.date || "").trim();
            const propFirm = String(row.propFirm || "").trim();
            const typeRaw = String(row.type || "")
              .trim()
              .toLowerCase();
            const amount = Number(row.amount);

            if (!date || !propFirm || !typeRaw || isNaN(amount)) {
              return null;
            }

            const type =
              typeRaw === "payout" || typeRaw === "fee" ? typeRaw : null;
            if (!type) return null;

            return { date, propFirm, type, amount };
          })
          .filter(Boolean) as any[];

        if (parsed.length === 0) {
          console.warn("CSV parsed but no valid rows found");
          return;
        }

        setRawEvents(parsed);
      },
      error: (error) => {
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
      label: "Current Funded Amount",
      value: fundedAmount,
      format: "currency",
    },
    {
      label: "All-Time Total Payouts",
      value: totalPayouts,
      format: "currency",
    },
    {
      label: "Money Spent on Challenge Fees",
      value: -totalFees,
      format: "currency",
    },
    { label: "Current PnL ($)", value: currentPnl, format: "currency" },

    { label: "Total Evaluations", value: totalEvaluations, format: "int" },
    { label: "Active Evaluations", value: activeEvaluations, format: "int" },
    { label: "Active Funded Accs", value: activeFundedAccs, format: "int" },
    { label: "Failed Challenges", value: failedChallenges, format: "int" },

    { label: "Phase 1 Pass Rate", value: phase1PassRate, format: "percent" },
    { label: "Phase 2 Pass Rate", value: phase2PassRate, format: "percent" },
    { label: "Reached Funded %", value: fundedRate, format: "percent" },
    { label: "Reached Payout %", value: payoutRate, format: "percent" },
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

  const pnlHistory = events
    .slice() // copy so we don't mutate the original array
    .sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() // oldest → newest
    )
    .reduce((acc, ev) => {
      const last = acc.length ? acc[acc.length - 1].pnl : 0;

      // payouts add to PnL, fees & purchases subtract
      let delta = 0;
      if (ev.type === "payout") {
        delta = ev.amount;
      } else if (ev.type === "fee" || ev.type === "purchase") {
        delta = -ev.amount;
      }

      acc.push({
        date: ev.date, // "2025-11-28" etc, same as data
        pnl: last + delta, // cumulative PnL after this event
      });

      return acc;
    }, [] as { date: string; pnl: number }[]);

  /* ----- ACCOUNT SIZE DONUT (PURCHASED EVALUATIONS) ----- */

  // "Purchased" = evaluations
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
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
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
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-md"
            >
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {kpi.label}
              </p>
              <p className="mt-2 text-xl font-semibold">
                {formatValue(kpi.value, kpi.format)}
              </p>
            </div>
          ))}
        </section>

        {/* Main charts */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold text-slate-300">
              Current PnL in USD (Payouts minus Challenge Fees)
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pnlHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2933" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #1e293b",
                      borderRadius: "0.5rem",
                      color: "#e5e7eb",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pnl"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-1 text-sm font-semibold text-slate-300">
              Account Sizes (Evaluations)
            </h2>
            <p className="mb-3 text-xs text-slate-400">
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
          </div>
        </section>

        {/* Bottom charts */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-4 text-sm font-semibold text-slate-300">
              Payouts by Prop Firm
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={payoutsByFirm}
                  layout="vertical"
                  margin={{ left: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2933" />
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis
                    dataKey="firm"
                    type="category"
                    stroke="#94a3b8"
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

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-4 text-sm font-semibold text-slate-300">
              Monthly Payouts vs Challenge Fees
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyPerf}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2933" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
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
                  <Bar dataKey="fees" name="Challenge Fees" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section>
          <EventsTable events={events as any} />
        </section>
      </div>
    </main>
  );
}
