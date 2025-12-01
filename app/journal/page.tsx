"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// Basic trade type
type Trade = {
  id: string;
  date: string; // "YYYY-MM-DD"
  instrument: string; // "XAUUSD", "EURUSD"
  direction: "LONG" | "SHORT";
  session: string;
  setup: string;
  macroAlignment: "With" | "Against" | "Neutral";
  riskPercent: number;
  plannedRR: number;
  resultR: number; // +2, -1, etc
  followedPlan: boolean;
  emotionNote: string;
  createdAt: number;
};

const STORAGE_KEY = "journal_trades_v1";
const SESSIONS = ["Asia", "London", "NY", "London/NY overlap"];
const INSTRUMENTS = ["XAUUSD", "EURUSD"];

function loadTrades(): Trade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTrades(trades: Trade[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

export default function JournalPage() {
  const [trades, setTrades] = useState<Trade[]>([]);

  // form state
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    instrument: "EURUSD",
    direction: "LONG" as "LONG" | "SHORT",
    session: "London",
    setup: "",
    macroAlignment: "With" as "With" | "Against" | "Neutral",
    riskPercent: 0.5,
    plannedRR: 2,
    resultR: 0,
    followedPlan: true,
    emotionNote: "",
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setTrades(loadTrades());
  }, []);

  useEffect(() => {
    saveTrades(trades);
  }, [trades]);

  // trades after applying filters
  // filters
  const [instrumentFilter, setInstrumentFilter] = useState("ALL");
  const [resultFilter, setResultFilter] = useState("ALL");
  const [macroFilter, setMacroFilter] = useState("ALL");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL"); // ← you added this

  const filteredTrades = useMemo(() => {
    let cutoff: number | null = null;
    const now = new Date();

    if (dateFilter === "7D") {
      cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    } else if (dateFilter === "30D") {
      cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    } else if (dateFilter === "90D") {
      cutoff = now.getTime() - 90 * 24 * 60 * 60 * 1000;
    }

    const filtered = trades.filter((t) => {
      // date filter
      if (cutoff !== null) {
        const tradeTime = new Date(t.date).getTime();
        if (tradeTime < cutoff) return false;
      }

      // instrument filter
      if (instrumentFilter !== "ALL" && t.instrument !== instrumentFilter) {
        return false;
      }

      // result filter
      if (resultFilter === "WINS" && t.resultR <= 0) return false;
      if (resultFilter === "LOSSES" && t.resultR >= 0) return false;

      // macro filter
      if (macroFilter !== "ALL" && t.macroAlignment !== macroFilter) {
        return false;
      }

      // plan filter
      if (planFilter === "YES" && !t.followedPlan) return false;
      if (planFilter === "NO" && t.followedPlan) return false;

      return true;
    });

    // sort by entry date, newest first
    filtered.sort((a, b) => {
      const ad = new Date(a.date).getTime();
      const bd = new Date(b.date).getTime();
      return bd - ad; // use ad - bd if you ever want oldest first
    });

    return filtered;
  }, [
    trades,
    dateFilter,
    instrumentFilter,
    resultFilter,
    macroFilter,
    planFilter,
  ]);
  // ⬆⬆ BLOCK ENDS HERE

  const stats = useMemo(() => {
    if (filteredTrades.length === 0) {
      return { total: 0, winRate: 0, avgR: 0, totalR: 0 };
    }

    const total = filteredTrades.length;
    const wins = filteredTrades.filter((t) => t.resultR > 0).length;
    const sumR = filteredTrades.reduce((sum, t) => sum + t.resultR, 0);
    const winRate = (wins / total) * 100;
    const avgR = sumR / total;

    return { total, winRate, avgR, totalR: sumR };
  }, [filteredTrades]);

  const macroStats = useMemo(() => {
    const withMacro = filteredTrades.filter((t) => t.macroAlignment === "With");
    const againstMacro = filteredTrades.filter(
      (t) => t.macroAlignment === "Against"
    );

    const avgWith =
      withMacro.length === 0
        ? 0
        : withMacro.reduce((sum, t) => sum + t.resultR, 0) / withMacro.length;

    const avgAgainst =
      againstMacro.length === 0
        ? 0
        : againstMacro.reduce((sum, t) => sum + t.resultR, 0) /
          againstMacro.length;

    return {
      withCount: withMacro.length,
      againstCount: againstMacro.length,
      avgWith,
      avgAgainst,
    };
  }, [filteredTrades]);

  const planStats = useMemo(() => {
    const planYes = filteredTrades.filter((t) => t.followedPlan);
    const planNo = filteredTrades.filter((t) => !t.followedPlan);

    const avgYes =
      planYes.length === 0
        ? 0
        : planYes.reduce((sum, t) => sum + t.resultR, 0) / planYes.length;

    const avgNo =
      planNo.length === 0
        ? 0
        : planNo.reduce((sum, t) => sum + t.resultR, 0) / planNo.length;

    return {
      yesCount: planYes.length,
      noCount: planNo.length,
      avgYes,
      avgNo,
    };
  }, [filteredTrades]);

  const riskStats = useMemo(() => {
    if (filteredTrades.length === 0) {
      return { avgRisk: 0, maxRisk: 0 };
    }

    const avgRisk =
      filteredTrades.reduce((sum, t) => sum + t.riskPercent, 0) /
      filteredTrades.length;

    const maxRisk = filteredTrades.reduce(
      (max, t) => Math.max(max, t.riskPercent),
      0
    );

    return { avgRisk, maxRisk };
  }, [filteredTrades]);

  const equityData = useMemo(() => {
    if (filteredTrades.length === 0) return [];

    // sort by date string (YYYY-MM-DD) from oldest to newest
    const sorted = [...filteredTrades].sort((a, b) => {
      const ad = new Date(a.date).getTime();
      const bd = new Date(b.date).getTime();
      return ad - bd;
    });

    let cumR = 0;

    return sorted.map((t) => {
      cumR += t.resultR;
      return {
        date: t.date, // x-axis label
        cumR, // cumulative R
      };
    });
  }, [filteredTrades]);

  function startEdit(trade: Trade) {
    setEditingId(trade.id);
    setForm({
      date: trade.date,
      instrument: trade.instrument,
      direction: trade.direction,
      session: trade.session,
      setup: trade.setup,
      macroAlignment: trade.macroAlignment,
      riskPercent: trade.riskPercent,
      plannedRR: trade.plannedRR,
      resultR: trade.resultR,
      followedPlan: trade.followedPlan,
      emotionNote: trade.emotionNote,
    });
  }
  function deleteTrade(id: string) {
    const confirmDelete = window.confirm("Delete this trade?");
    if (!confirmDelete) return;

    setEditingId((current) => (current === id ? null : current));

    setTrades((prev) => prev.filter((t) => t.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const base: Omit<Trade, "id" | "createdAt"> = {
      date: form.date,
      instrument: form.instrument,
      direction: form.direction,
      session: form.session,
      setup: form.setup.trim(),
      macroAlignment: form.macroAlignment,
      riskPercent: Number(form.riskPercent),
      plannedRR: Number(form.plannedRR),
      resultR: Number(form.resultR),
      followedPlan: form.followedPlan,
      emotionNote: form.emotionNote.trim(),
    };

    if (editingId) {
      // update existing
      setTrades((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? {
                ...t,
                ...base,
              }
            : t
        )
      );
    } else {
      // create new
      const newTrade: Trade = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        ...base,
      };
      setTrades((prev) => [newTrade, ...prev]);
    }

    // reset form state and exit edit mode
    setEditingId(null);
    setForm((prev) => ({
      ...prev,
      setup: "",
      resultR: 0,
      emotionNote: "",
    }));
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            Trading Journal
          </h1>
          <p className="text-sm text-slate-400">
            Log trades quickly and see how they perform over time.
          </p>
        </header>

        {/* Add trade form */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-200">
            {editingId ? "Edit trade" : "Add trade"}
          </h2>
          {editingId && (
            <p className="mb-3 text-[11px] text-amber-400">
              Editing existing entry. Submit to save changes or refresh to
              cancel.
            </p>
          )}

          <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-xs text-slate-400">
                Date
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                />
              </label>

              <label className="block text-xs text-slate-400">
                Instrument
                <select
                  value={form.instrument}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, instrument: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                >
                  {INSTRUMENTS.map((inst) => (
                    <option key={inst} value={inst}>
                      {inst}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs text-slate-400">
                Direction
                <div className="mt-1 flex gap-2">
                  {(["LONG", "SHORT"] as const).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, direction: dir }))}
                      className={
                        "flex-1 rounded-md border px-2 py-1 text-xs " +
                        (form.direction === dir
                          ? "border-emerald-500 bg-emerald-900/40"
                          : "border-slate-700 bg-slate-950")
                      }
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </label>

              <label className="block text-xs text-slate-400">
                Session
                <select
                  value={form.session}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, session: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                >
                  {SESSIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs text-slate-400">
                Setup
                <input
                  type="text"
                  value={form.setup}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, setup: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  placeholder="liq grab + BOS"
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-slate-400">
                Macro alignment
                <select
                  value={form.macroAlignment}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      macroAlignment: e.target.value as
                        | "With"
                        | "Against"
                        | "Neutral",
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                >
                  <option value="With">With</option>
                  <option value="Against">Against</option>
                  <option value="Neutral">Neutral</option>
                </select>
              </label>

              <label className="block text-xs text-slate-400">
                Risk % of account
                <input
                  type="number"
                  step="0.1"
                  value={form.riskPercent}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      riskPercent: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                />
              </label>

              <label className="block text-xs text-slate-400">
                Planned R:R
                <input
                  type="number"
                  step="0.1"
                  value={form.plannedRR}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      plannedRR: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                />
              </label>

              <label className="block text-xs text-slate-400">
                Result (R)
                <input
                  type="number"
                  step="0.1"
                  value={form.resultR}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      resultR: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  placeholder="+2, -1"
                />
              </label>

              <label className="block text-xs text-slate-400">
                Followed plan?
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, followedPlan: true }))
                    }
                    className={
                      "flex-1 rounded-md border px-2 py-1 text-xs " +
                      (form.followedPlan
                        ? "border-emerald-500 bg-emerald-900/40"
                        : "border-slate-700 bg-slate-950")
                    }
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, followedPlan: false }))
                    }
                    className={
                      "flex-1 rounded-md border px-2 py-1 text-xs " +
                      (!form.followedPlan
                        ? "border-red-500 bg-red-900/40"
                        : "border-slate-700 bg-slate-950")
                    }
                  >
                    No
                  </button>
                </div>
              </label>

              <label className="block text-xs text-slate-400">
                Emotion / note
                <input
                  type="text"
                  value={form.emotionNote}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      emotionNote: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  placeholder="chased, calm, revenge..."
                />
              </label>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  {editingId ? "Update trade" : "Save trade"}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Stats */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Stats</h2>

          {/* Top row: big numbers */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">Total trades</p>
              <p className="text-xl font-semibold text-slate-100">
                {stats.total}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Win rate</p>
              <p className="text-xl font-semibold text-slate-100">
                {stats.winRate.toFixed(1)}%
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Average R</p>
              <p className="text-xl font-semibold text-slate-100">
                {stats.avgR.toFixed(2)}R
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Total R</p>
              <p className="text-xl font-semibold text-slate-100">
                {stats.totalR.toFixed(2)}R
              </p>
            </div>
          </div>

          {/* Bottom row: segmented stats */}
          <div className="mt-6 grid gap-4 text-xs sm:grid-cols-3">
            {/* Macro alignment card */}
            <div className="rounded-lg bg-slate-950/60 p-3">
              <p className="mb-1 font-semibold text-slate-200 text-[11px]">
                Macro alignment
              </p>
              <p className="text-[11px] text-slate-400">
                With macro: {macroStats.withCount} trades, avg{" "}
                {macroStats.avgWith.toFixed(2)}R
              </p>
              <p className="text-[11px] text-slate-400">
                Against macro: {macroStats.againstCount} trades, avg{" "}
                {macroStats.avgAgainst.toFixed(2)}R
              </p>
            </div>

            {/* Plan discipline card */}
            <div className="rounded-lg bg-slate-950/60 p-3">
              <p className="mb-1 font-semibold text-slate-200 text-[11px]">
                Plan discipline
              </p>
              <p className="text-[11px] text-slate-400">
                Plan = YES: {planStats.yesCount} trades, avg{" "}
                {planStats.avgYes.toFixed(2)}R
              </p>
              <p className="text-[11px] text-slate-400">
                Plan = NO: {planStats.noCount} trades, avg{" "}
                {planStats.avgNo.toFixed(2)}R
              </p>
            </div>

            {/* Risk card */}
            <div className="rounded-lg bg-slate-950/60 p-3">
              <p className="mb-1 font-semibold text-slate-200 text-[11px]">
                Risk per trade
              </p>
              <p className="text-[11px] text-slate-400">
                Average risk: {riskStats.avgRisk.toFixed(2)}%
              </p>
              <p className="text-[11px] text-slate-400">
                Max risk: {riskStats.maxRisk.toFixed(2)}%
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">
            Equity curve (R)
          </h2>

          {equityData.length === 0 ? (
            <p className="text-xs text-slate-500">
              No trades to display yet. Add some trades to see your R curve.
            </p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={equityData}
                  margin={{ top: 10, right: 20, bottom: 0, left: -20 }}
                >
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickMargin={6}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickMargin={6}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #1f2937",
                      borderRadius: "0.5rem",
                      fontSize: "11px",
                      color: "#e5e7eb",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumR"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Trades list */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Trades</h2>
          <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-slate-300">
            {/* Date filter */}
            <label className="flex items-center gap-1">
              <span>Date:</span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
              >
                <option value="ALL">All time</option>
                <option value="7D">Last 7 days</option>
                <option value="30D">Last 30 days</option>
                <option value="90D">Last 90 days</option>
              </select>
            </label>

            {/* Instrument filter */}
            <label className="flex items-center gap-1">
              <span>Instrument:</span>
              <select
                value={instrumentFilter}
                onChange={(e) => setInstrumentFilter(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
              >
                <option value="ALL">All</option>
                <option value="XAUUSD">XAUUSD</option>
                <option value="EURUSD">EURUSD</option>
              </select>
            </label>

            {/* Result filter */}
            <label className="flex items-center gap-1">
              <span>Result:</span>
              <select
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
              >
                <option value="ALL">All</option>
                <option value="WINS">Wins</option>
                <option value="LOSSES">Losses</option>
              </select>
            </label>

            {/* Macro filter */}
            <label className="flex items-center gap-1">
              <span>Macro:</span>
              <select
                value={macroFilter}
                onChange={(e) => setMacroFilter(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
              >
                <option value="ALL">All</option>
                <option value="With">With</option>
                <option value="Against">Against</option>
                <option value="Neutral">Neutral</option>
              </select>
            </label>

            {/* Plan filter */}
            <label className="flex items-center gap-1">
              <span>Plan:</span>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
              >
                <option value="ALL">All</option>
                <option value="YES">Followed</option>
                <option value="NO">Broke</option>
              </select>
            </label>
          </div>

          <div className="max-h-80 overflow-auto text-xs">
            <table className="min-w-full border-t border-slate-800">
              <thead className="sticky top-0 bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left text-slate-400">Date</th>
                  <th className="px-3 py-2 text-left text-slate-400">
                    Instrument
                  </th>
                  <th className="px-3 py-2 text-left text-slate-400">Dir</th>
                  <th className="px-3 py-2 text-right text-slate-400">R</th>
                  <th className="px-3 py-2 text-left text-slate-400">Setup</th>
                  <th className="px-3 py-2 text-left text-slate-400">Macro</th>
                  <th className="px-3 py-2 text-left text-slate-400">Plan</th>
                  <th className="px-3 py-2 text-left text-slate-400">
                    Emotion
                  </th>
                  <th className="px-3 py-2 text-left text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((t, idx) => (
                  <tr
                    key={t.id}
                    className={
                      idx % 2 === 0 ? "bg-slate-950" : "bg-slate-900/70"
                    }
                  >
                    {/* Date */}
                    <td className="px-3 py-2 text-slate-200">{t.date}</td>

                    {/* Instrument */}
                    <td className="px-3 py-2 text-slate-200">{t.instrument}</td>

                    {/* Direction */}
                    <td className="px-3 py-2 text-slate-200">{t.direction}</td>

                    {/* Result in R */}
                    <td
                      className={
                        "px-3 py-2 text-right " +
                        (t.resultR > 0
                          ? "text-emerald-400"
                          : t.resultR < 0
                          ? "text-red-400"
                          : "text-slate-200")
                      }
                    >
                      {t.resultR.toFixed(2)}R
                    </td>

                    {/* Setup */}
                    <td className="px-3 py-2 text-slate-200">
                      <span className="line-clamp-1 max-w-[140px]">
                        {t.setup}
                      </span>
                    </td>

                    {/* Macro alignment */}
                    <td className="px-3 py-2">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                          (t.macroAlignment === "With"
                            ? "bg-emerald-900/60 text-emerald-300"
                            : t.macroAlignment === "Against"
                            ? "bg-amber-900/60 text-amber-300"
                            : "bg-slate-800 text-slate-300")
                        }
                      >
                        {t.macroAlignment}
                      </span>
                    </td>

                    {/* Followed plan badge */}
                    <td className="px-3 py-2">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                          (t.followedPlan
                            ? "bg-emerald-900/60 text-emerald-300"
                            : "bg-red-900/60 text-red-300")
                        }
                      >
                        {t.followedPlan ? "YES" : "NO"}
                      </span>
                    </td>

                    {/* Emotion */}
                    <td className="px-3 py-2 text-slate-300">
                      <span className="line-clamp-1 max-w-[140px]">
                        {t.emotionNote}
                      </span>
                    </td>

                    {/* Action: Edit button */}
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(t)}
                          className="rounded-md border border-slate-600 px-2 py-0.5 text-[10px] text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteTrade(t.id)}
                          className="rounded-md border border-slate-600 px-2 py-0.5 text-[10px] text-red-300 hover:border-red-500 hover:text-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredTrades.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-4 text-center text-slate-500"
                    >
                      No trades match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
