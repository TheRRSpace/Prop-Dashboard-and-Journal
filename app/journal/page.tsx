"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// ---------- TYPES & CONSTANTS ----------

type MacroAlignment = "With" | "Against" | "Neutral";

type Trade = {
  id: string;
  date: string; // "YYYY-MM-DD"
  instrument: string; // "XAUUSD", "EURUSD", etc
  direction: "LONG" | "SHORT";
  session: string;
  setup: string;
  macroAlignment: MacroAlignment;
  riskPercent: number;
  plannedRR: number;
  resultR: number; // +2, -1, etc
  followedPlan: boolean;
  emotionNote: string;
  createdAt: number;
};

const STORAGE_KEY = "journal_trades_v1";
const SESSIONS = ["Asia", "London", "NY", "London/NY overlap"] as const;
const INSTRUMENTS = ["XAUUSD", "EURUSD"] as const;

// ---------- LOCAL STORAGE HELPERS ----------

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

// ---------- PAGE COMPONENT ----------

export default function JournalPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);

  // form state
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    instrument: "EURUSD",
    direction: "LONG" as "LONG" | "SHORT",
    session: "London",
    setup: "",
    macroAlignment: "With" as MacroAlignment,
    riskPercent: 0.5,
    plannedRR: 2,
    resultR: 0,
    followedPlan: true,
    emotionNote: "",
  });

  // filters
  const [instrumentFilter, setInstrumentFilter] = useState("ALL");
  const [resultFilter, setResultFilter] = useState("ALL");
  const [macroFilter, setMacroFilter] = useState("ALL");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");

  // ---------- EFFECTS ----------

  useEffect(() => {
    setTrades(loadTrades());
  }, []);

  useEffect(() => {
    saveTrades(trades);
  }, [trades]);

  // ---------- FILTERED TRADES ----------

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
      if (cutoff !== null) {
        const tradeTime = new Date(t.date).getTime();
        if (Number.isFinite(tradeTime) && tradeTime < cutoff) return false;
      }

      if (instrumentFilter !== "ALL" && t.instrument !== instrumentFilter) {
        return false;
      }

      if (resultFilter === "WINS" && t.resultR <= 0) return false;
      if (resultFilter === "LOSSES" && t.resultR >= 0) return false;

      if (macroFilter !== "ALL" && t.macroAlignment !== macroFilter) {
        return false;
      }

      if (planFilter === "YES" && !t.followedPlan) return false;
      if (planFilter === "NO" && t.followedPlan) return false;

      return true;
    });

    // newest first for the table
    filtered.sort((a, b) => {
      const ad = new Date(a.date).getTime();
      const bd = new Date(b.date).getTime();
      return bd - ad;
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

  // ---------- STATS ----------

  const stats = useMemo(() => {
    if (!filteredTrades.length) {
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
    if (!filteredTrades.length) {
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

  // ---------- EQUITY CURVE DATA ----------

  const equityData = useMemo(() => {
    if (!filteredTrades.length) return [];

    const sorted = [...filteredTrades].sort((a, b) => {
      const ad = new Date(a.date).getTime();
      const bd = new Date(b.date).getTime();
      return ad - bd;
    });

    let cumR = 0;

    return sorted.map((t) => {
      cumR += t.resultR;
      return {
        date: t.date,
        cumR,
      };
    });
  }, [filteredTrades]);

  // ---------- ACTIONS ----------

  function startEdit(trade: Trade) {
    setEditingId(trade.id);
    setShowForm(true);
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
    setExpandedTradeId((current) => (current === id ? null : current));

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
      setTrades((prev) =>
        prev.map((t) => (t.id === editingId ? { ...t, ...base } : t))
      );
    } else {
      const newTrade: Trade = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        ...base,
      };
      setTrades((prev) => [newTrade, ...prev]);
    }

    setEditingId(null);
    setForm((prev) => ({
      ...prev,
      setup: "",
      resultR: 0,
      emotionNote: "",
    }));
    // keep form open so you can log multiple trades
  }

  // ---------- UI HELPERS ----------

  const kpiCards = [
    {
      label: "Total trades",
      value: stats.total.toString(),
      subtitle: "",
    },
    {
      label: "Win rate",
      value: `${stats.winRate.toFixed(1)}%`,
      subtitle: "",
    },
    {
      label: "Average R",
      value: `${stats.avgR.toFixed(2)}R`,
      subtitle: "",
    },
    {
      label: "Total R",
      value: `${stats.totalR.toFixed(2)}R`,
      subtitle: "",
    },
  ];

  // ---------- RENDER ----------

  return (
    <main className="min-h-screen bg-[#020617] text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              RR journal
            </h1>
            <p className="text-sm text-slate-400">Track it baby! Track it!</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((open) => !open)}
            className="rounded-full bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-2 text-xs font-semibold shadow-md shadow-sky-900/40 hover:from-blue-500 hover:to-sky-400"
          >
            {showForm ? "Hide trade form" : "Log new trade"}
          </button>
        </header>

        {/* TOP GRID: EQUITY CURVE + FORM CARD */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1.2fr)]">
          {/* Equity hero card */}
          <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 p-4 shadow-xl shadow-slate-950/80">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Equity curve (R)
                </h2>
                <p className="text-[11px] text-slate-400">
                  Cumulative R over time, filtered by the controls below.
                </p>
              </div>
              {equityData.length > 0 && (
                <div className="rounded-full bg-slate-900/80 px-3 py-1 text-[11px] text-slate-300">
                  Current:{" "}
                  <span
                    className={
                      stats.totalR >= 0 ? "text-emerald-400" : "text-red-400"
                    }
                  >
                    {stats.totalR.toFixed(2)}R
                  </span>
                </div>
              )}
            </div>

            {equityData.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-xs text-slate-500">
                Add some trades to see your curve.
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={equityData}
                    margin={{ top: 10, right: 20, bottom: 0, left: -20 }}
                  >
                    <defs>
                      <linearGradient
                        id="equityGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#38bdf8"
                          stopOpacity={0.9}
                        />
                        <stop
                          offset="95%"
                          stopColor="#0f172a"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#111827" strokeDasharray="3 3" />
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
                        borderRadius: "0.75rem",
                        fontSize: "11px",
                        color: "#e5e7eb",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumR"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Form card, collapsible */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4 shadow-xl shadow-slate-950/80">
            <h2 className="mb-2 text-sm font-semibold text-slate-100">
              {editingId ? "Edit trade" : "Log trade"}
            </h2>
            <p className="mb-3 text-[11px] text-slate-400">
              Only key inputs baby. The heavy analysis lives in the table and
              stats.
            </p>

            {showForm ? (
              <form
                onSubmit={handleSubmit}
                className="grid gap-3 text-[11px] md:grid-cols-2"
              >
                <div className="space-y-2">
                  <label className="block text-slate-400">
                    Date
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, date: e.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    />
                  </label>

                  <label className="block text-slate-400">
                    Instrument
                    <select
                      value={form.instrument}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, instrument: e.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    >
                      {INSTRUMENTS.map((inst) => (
                        <option key={inst} value={inst}>
                          {inst}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-slate-400">
                    Direction
                    <div className="mt-1 flex gap-2">
                      {(["LONG", "SHORT"] as const).map((dir) => (
                        <button
                          key={dir}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({ ...f, direction: dir }))
                          }
                          className={
                            "flex-1 rounded-md border px-2 py-1 " +
                            (form.direction === dir
                              ? "border-emerald-500 bg-emerald-900/40 text-emerald-100"
                              : "border-slate-700 bg-slate-950 text-slate-200")
                          }
                        >
                          {dir}
                        </button>
                      ))}
                    </div>
                  </label>

                  <label className="block text-slate-400">
                    Session
                    <select
                      value={form.session}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, session: e.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    >
                      {SESSIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-slate-400">
                    Setup
                    <input
                      type="text"
                      value={form.setup}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, setup: e.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                      placeholder="liq grab + BOS"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="block text-slate-400">
                    Macro alignment
                    <select
                      value={form.macroAlignment}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          macroAlignment: e.target.value as MacroAlignment,
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    >
                      <option value="With">With</option>
                      <option value="Against">Against</option>
                      <option value="Neutral">Neutral</option>
                    </select>
                  </label>

                  <label className="block text-slate-400">
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
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    />
                  </label>

                  <label className="block text-slate-400">
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
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    />
                  </label>

                  <label className="block text-slate-400">
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
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                      placeholder="+2, -1"
                    />
                  </label>

                  <label className="block text-slate-400">
                    Followed plan
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, followedPlan: true }))
                        }
                        className={
                          "flex-1 rounded-md border px-2 py-1 text-[11px] " +
                          (form.followedPlan
                            ? "border-emerald-500 bg-emerald-900/40 text-emerald-100"
                            : "border-slate-700 bg-slate-950 text-slate-200")
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
                          "flex-1 rounded-md border px-2 py-1 text-[11px] " +
                          (!form.followedPlan
                            ? "border-red-500 bg-red-900/40 text-red-100"
                            : "border-slate-700 bg-slate-950 text-slate-200")
                        }
                      >
                        No
                      </button>
                    </div>
                  </label>

                  <label className="block text-slate-400">
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
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                      placeholder="chased, calm, revenge..."
                    />
                  </label>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full rounded-md bg-gradient-to-r from-emerald-500 to-sky-400 px-3 py-1.5 text-[11px] font-semibold text-slate-950 shadow-md shadow-emerald-900/40 hover:from-emerald-400 hover:to-sky-300"
                    >
                      {editingId ? "Update trade" : "Save trade"}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-4 text-[11px] text-slate-400">
                <p className="mb-2">
                  Use this panel to log trades. Click{" "}
                  <span className="text-sky-400 font-semibold">
                    “Log new trade”
                  </span>{" "}
                  in the header to open the form.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* KPI ROW */}
        <section className="grid gap-4 md:grid-cols-4">
          {kpiCards.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 shadow-md shadow-slate-950/60"
            >
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                {kpi.label}
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-50">
                {kpi.value}
              </p>
            </div>
          ))}
        </section>

        {/* SEGMENTED STATS */}
        <section className="grid gap-4 text-[11px] md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
            <p className="mb-1 font-semibold text-slate-200">Macro alignment</p>
            <p className="text-slate-400">
              With macro:{" "}
              <span className="font-semibold text-emerald-300">
                {macroStats.withCount}
              </span>{" "}
              trades, avg {macroStats.avgWith.toFixed(2)}R
            </p>
            <p className="text-slate-400">
              Against macro:{" "}
              <span className="font-semibold text-amber-300">
                {macroStats.againstCount}
              </span>{" "}
              trades, avg {macroStats.avgAgainst.toFixed(2)}R
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
            <p className="mb-1 font-semibold text-slate-200">Plan discipline</p>
            <p className="text-slate-400">
              Plan = YES:{" "}
              <span className="font-semibold text-emerald-300">
                {planStats.yesCount}
              </span>{" "}
              trades, avg {planStats.avgYes.toFixed(2)}R
            </p>
            <p className="text-slate-400">
              Plan = NO:{" "}
              <span className="font-semibold text-red-300">
                {planStats.noCount}
              </span>{" "}
              trades, avg {planStats.avgNo.toFixed(2)}R
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
            <p className="mb-1 font-semibold text-slate-200">Risk per trade</p>
            <p className="text-slate-400">
              Average risk:{" "}
              <span className="font-semibold text-slate-100">
                {riskStats.avgRisk.toFixed(2)}%
              </span>
            </p>
            <p className="text-slate-400">
              Max risk:{" "}
              <span className="font-semibold text-slate-100">
                {riskStats.maxRisk.toFixed(2)}%
              </span>
            </p>
          </div>
        </section>

        {/* TRADES TABLE */}
        <section className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-100">Trades</h2>

            <div className="flex flex-wrap gap-3 text-[11px] text-slate-300">
              <label className="flex items-center gap-1">
                <span>Date</span>
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

              <label className="flex items-center gap-1">
                <span>Instrument</span>
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

              <label className="flex items-center gap-1">
                <span>Result</span>
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

              <label className="flex items-center gap-1">
                <span>Macro</span>
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

              <label className="flex items-center gap-1">
                <span>Plan</span>
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
          </div>

          <div className="max-h-80 overflow-auto text-xs">
            <table className="min-w-full border-t border-slate-800">
              <thead className="sticky top-0 bg-slate-950">
                <tr>
                  <th className="px-3 py-2 text-left text-slate-400">Date</th>
                  <th className="px-3 py-2 text-left text-slate-400">
                    Instrument
                  </th>
                  <th className="px-3 py-2 text-left text-slate-400">Dir</th>
                  <th className="px-3 py-2 text-left text-slate-400">Macro</th>
                  <th className="px-3 py-2 text-left text-slate-400">Plan</th>
                  <th className="px-3 py-2 text-right text-slate-400">R</th>
                  <th className="px-3 py-2 text-right text-slate-400">More</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((t, idx) => (
                  <React.Fragment key={t.id}>
                    <tr
                      className={
                        idx % 2 === 0 ? "bg-slate-950" : "bg-slate-900/70"
                      }
                    >
                      <td className="px-3 py-2 text-slate-200">{t.date}</td>
                      <td className="px-3 py-2 text-slate-200">
                        {t.instrument}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {t.direction}
                      </td>
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
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedTradeId((current) =>
                              current === t.id ? null : t.id
                            )
                          }
                          className="rounded-md border border-slate-600 px-2 py-0.5 text-[10px] text-slate-200 hover:border-sky-500 hover:text-sky-300"
                        >
                          {expandedTradeId === t.id ? "Hide" : "More"}
                        </button>
                      </td>
                    </tr>

                    {expandedTradeId === t.id && (
                      <tr className="bg-slate-950/90">
                        <td
                          colSpan={7}
                          className="px-4 pb-3 pt-2 text-[11px] text-slate-300"
                        >
                          <div className="grid gap-2 md:grid-cols-4">
                            <div>
                              <p className="text-slate-400">Setup</p>
                              <p className="line-clamp-2 text-slate-100">
                                {t.setup || "Not specified"}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400">
                                Risk / planned RR
                              </p>
                              <p className="text-slate-100">
                                {t.riskPercent.toFixed(2)}% risk,{" "}
                                {t.plannedRR.toFixed(2)}R planned
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400">Session</p>
                              <p className="text-slate-100">{t.session}</p>
                            </div>
                            <div>
                              <p className="text-slate-400">Emotion / note</p>
                              <p className="line-clamp-2 text-slate-100">
                                {t.emotionNote || "No comment"}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex gap-2">
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
                    )}
                  </React.Fragment>
                ))}

                {filteredTrades.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
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
