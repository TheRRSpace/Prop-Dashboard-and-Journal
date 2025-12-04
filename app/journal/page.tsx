"use client";

import type React from "react";
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

const CARD_CLASS =
  "relative overflow-hidden rounded-3xl border border-jr-border " +
  "bg-gradient-to-b from-[#050816]/90 via-[#020617]/95 to-[#020617] " +
  "px-5 py-4 shadow-[0_24px_60px_rgba(15,23,42,0.95)] backdrop-blur-xl";

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

  // filters
  const [instrumentFilter, setInstrumentFilter] = useState("ALL");
  const [resultFilter, setResultFilter] = useState("ALL");
  const [macroFilter, setMacroFilter] = useState("ALL");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");

  // filtered trades
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

    // newest first
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

    // oldest to newest
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
  }

  return (
    <main className="relative min-h-screen bg-jr-bg text-jr-text">
      {/* background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[#020617]
        bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.35),transparent_60%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.18),transparent_55%)]"
      />

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        {/* HEADER */}
        <header>
          <h1 className="text-[22px] font-semibold tracking-tight text-jr-text">
            Trading journal
          </h1>
          <p className="mt-1 text-[11px] text-jr-muted">
            Log trades fast, track R, and check if you are actually respecting
            the macro story.
          </p>
        </header>

        {/* ADD TRADE FORM */}
        <section className={CARD_CLASS}>
          <h2 className="mb-1 text-xs font-semibold text-jr-text">
            {editingId ? "Edit trade" : "Add trade"}
          </h2>
          {editingId && (
            <p className="mb-3 text-[11px] text-jr-warning">
              Editing existing entry. Submit to save changes or refresh to
              cancel.
            </p>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-2 grid gap-4 md:grid-cols-2"
          >
            <div className="space-y-2 text-[11px]">
              <label className="block text-jr-muted">
                Date
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-jr-border bg-jr-surface px-2 py-1 text-[11px] text-jr-text outline-none focus:border-jr-primary"
                />
              </label>

              <label className="block text-jr-muted">
                Instrument
                <select
                  value={form.instrument}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, instrument: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-jr-border bg-jr-surface px-2 py-1 text-[11px] text-jr-text outline-none focus:border-jr-primary"
                >
                  {INSTRUMENTS.map((inst) => (
                    <option key={inst} value={inst}>
                      {inst}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-jr-muted">
                Direction
                <div className="mt-1 flex gap-2">
                  {(["LONG", "SHORT"] as const).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, direction: dir }))}
                      className={
                        "flex-1 rounded-md border px-2 py-1 " +
                        (form.direction === dir
                          ? "border-jr-primary bg-jr-primary/20 text-jr-text"
                          : "border-jr-border bg-jr-surface text-jr-muted")
                      }
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </label>

              <label className="block text-jr-muted">
                Session
                <select
                  value={form.session}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, session: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-jr-border bg-jr-surface px-2 py-1 text-[11px] text-jr-text outline-none focus:border-jr-primary"
                >
                  {SESSIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-jr-muted">
                Setup
                <input
                  type="text"
                  value={form.setup}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, setup: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-jr-border bg-jr-surface px-2 py-1 text-[11px] text-jr-text outline-none focus:border-jr-primary"
                  placeholder="liq grab + BOS"
                />
              </label>
            </div>

            <div className="space-y-2 text-[11px]">
              <label className="block text-jr-muted">
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
                  className="mt-1 w-full rounded-md border border-jr-border bg-jr-surface px-2 py-1 text-[11px] text-jr-text outline-none focus:border-jr-primary"
                >
                  <option value="With">With</option>
                  <option value="Against">Against</option>
                  <option value="Neutral">Neutral</option>
                </select>
              </label>

              <label className="block text-jr-muted">
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
                  className="mt-1 w-full rounded-md border border-jr-border bg-jr-surface px-2 py-1 text-[11px] text-jr-text outline-none focus:border-jr-primary"
                />
              </label>

              <label className="block text-jr-muted">
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
                  className="mt-1 w-full rounded-md border border-jr-border bg-jr-surface px-2 py-1 text-[11px] text-jr-text outline-none focus:border-jr-primary"
                />
              </label>

              <label className="block text-jr-muted">
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
                  className="mt-1 w-full rounded-md border border-jr-border bg-jr-surface px-2 py-1 text-[11px] text-jr-text outline-none focus:border-jr-primary"
                  placeholder="+2, -1"
                />
              </label>

              <label className="block text-jr-muted">
                Followed plan
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, followedPlan: true }))
                    }
                    className={
                      "flex-1 rounded-md border px-2 py-1 " +
                      (form.followedPlan
                        ? "border-jr-primary bg-jr-primary/20 text-jr-text"
                        : "border-jr-border bg-jr-surface text-jr-muted")
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
                      "flex-1 rounded-md border px-2 py-1 " +
                      (!form.followedPlan
                        ? "border-jr-loss bg-jr-loss/20 text-jr-text"
                        : "border-jr-border bg-jr-surface text-jr-muted")
                    }
                  >
                    No
                  </button>
                </div>
              </label>

              <label className="block text-jr-muted">
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
                  className="mt-1 w-full rounded-md border border-jr-border bg-jr-surface px-2 py-1 text-[11px] text-jr-text outline-none focus:border-jr-primary"
                  placeholder="chased, calm, revenge..."
                />
              </label>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full rounded-full bg-jr-primary px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg shadow-jr-primary/40 hover:bg-jr-primary-soft"
                >
                  {editingId ? "Update trade" : "Save trade"}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* STATS */}
        <section className={CARD_CLASS}>
          <h2 className="mb-4 text-xs font-semibold text-jr-text">Stats</h2>

          {/* Top row: big numbers */}
          <div className="grid gap-4 sm:grid-cols-4 text-[11px]">
            <div>
              <p className="text-jr-muted">Total trades</p>
              <p className="mt-1 text-lg font-semibold text-jr-text">
                {stats.total}
              </p>
            </div>

            <div>
              <p className="text-jr-muted">Win rate</p>
              <p className="mt-1 text-lg font-semibold text-jr-text">
                {stats.winRate.toFixed(1)}%
              </p>
            </div>

            <div>
              <p className="text-jr-muted">Average R</p>
              <p className="mt-1 text-lg font-semibold text-jr-text">
                {stats.avgR.toFixed(2)}R
              </p>
            </div>

            <div>
              <p className="text-jr-muted">Total R</p>
              <p className="mt-1 text-lg font-semibold text-jr-text">
                {stats.totalR.toFixed(2)}R
              </p>
            </div>
          </div>

          {/* Bottom row */}
          <div className="mt-6 grid gap-4 text-[11px] sm:grid-cols-3">
            <div className="rounded-2xl bg-jr-surface/60 p-3">
              <p className="mb-1 font-semibold text-jr-text">Macro alignment</p>
              <p className="text-jr-muted">
                With macro: {macroStats.withCount} trades, avg{" "}
                {macroStats.avgWith.toFixed(2)}R
              </p>
              <p className="text-jr-muted">
                Against macro: {macroStats.againstCount} trades, avg{" "}
                {macroStats.avgAgainst.toFixed(2)}R
              </p>
            </div>

            <div className="rounded-2xl bg-jr-surface/60 p-3">
              <p className="mb-1 font-semibold text-jr-text">Plan discipline</p>
              <p className="text-jr-muted">
                Plan = YES: {planStats.yesCount} trades, avg{" "}
                {planStats.avgYes.toFixed(2)}R
              </p>
              <p className="text-jr-muted">
                Plan = NO: {planStats.noCount} trades, avg{" "}
                {planStats.avgNo.toFixed(2)}R
              </p>
            </div>

            <div className="rounded-2xl bg-jr-surface/60 p-3">
              <p className="mb-1 font-semibold text-jr-text">Risk per trade</p>
              <p className="text-jr-muted">
                Average risk: {riskStats.avgRisk.toFixed(2)}%
              </p>
              <p className="text-jr-muted">
                Max risk: {riskStats.maxRisk.toFixed(2)}%
              </p>
            </div>
          </div>
        </section>

        {/* EQUITY CURVE */}
        <section className={CARD_CLASS}>
          <h2 className="mb-3 text-xs font-semibold text-jr-text">
            Equity curve (R)
          </h2>

          {equityData.length === 0 ? (
            <p className="text-[11px] text-jr-muted">
              No trades to display yet. Add some trades to see your R curve.
            </p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={equityData}
                  margin={{ top: 10, right: 20, bottom: 0, left: -20 }}
                >
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
                      borderRadius: 12,
                      fontSize: 11,
                      color: "#e5e7eb",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumR"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* TRADES TABLE */}
        <section className={CARD_CLASS}>
          <h2 className="mb-3 text-xs font-semibold text-jr-text">Trades</h2>

          {/* filters */}
          <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-jr-text">
            <label className="flex items-center gap-1">
              <span className="text-jr-muted">Date:</span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded-md border border-jr-border bg-jr-surface px-2 py-1 text-[11px] text-jr-text outline-none focus:border-jr-primary"
              >
                <option value="ALL">All time</option>
                <option value="7D">Last 7 days</option>
                <option value="30D">Last 30 days</option>
                <option value="90D">Last 90 days</option>
              </select>
            </label>

            <label className="flex items-center gap-1">
              <span className="text-jr-muted">Instrument:</span>
              <select
                value={instrumentFilter}
                onChange={(e) => setInstrumentFilter(e.target.value)}
                className="rounded-md border border-jr-border bg-jr-surface px-2 py-1 text-[11px] text-jr-text outline-none focus:border-jr-primary"
              >
                <option value="ALL">All</option>
                <option value="XAUUSD">XAUUSD</option>
                <option value="EURUSD">EURUSD</option>
              </select>
            </label>

            <label className="flex items-center gap-1">
              <span className="text-jr-muted">Result:</span>
              <select
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
                className="rounded-md border border-jr-border bg-jr-surface px-2 py-1 text-[11px] text-jr-text outline-none focus:border-jr-primary"
              >
                <option value="ALL">All</option>
                <option value="WINS">Wins</option>
                <option value="LOSSES">Losses</option>
              </select>
            </label>

            <label className="flex items-center gap-1">
              <span className="text-jr-muted">Macro:</span>
              <select
                value={macroFilter}
                onChange={(e) => setMacroFilter(e.target.value)}
                className="rounded-md border border-jr-border bg-jr-surface px-2 py-1 text-[11px] text-jr-text outline-none focus:border-jr-primary"
              >
                <option value="ALL">All</option>
                <option value="With">With</option>
                <option value="Against">Against</option>
                <option value="Neutral">Neutral</option>
              </select>
            </label>

            <label className="flex items-center gap-1">
              <span className="text-jr-muted">Plan:</span>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="rounded-md border border-jr-border bg-jr-surface px-2 py-1 text-[11px] text-jr-text outline-none focus:border-jr-primary"
              >
                <option value="ALL">All</option>
                <option value="YES">Followed</option>
                <option value="NO">Broke</option>
              </select>
            </label>
          </div>

          <div className="max-h-80 overflow-auto text-[11px]">
            <table className="min-w-full border-t border-jr-border/60">
              <thead className="sticky top-0 bg-[#020617]/95 backdrop-blur">
                <tr>
                  <th className="px-3 py-2 text-left font-normal text-jr-muted">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left font-normal text-jr-muted">
                    Instrument
                  </th>
                  <th className="px-3 py-2 text-left font-normal text-jr-muted">
                    Dir
                  </th>
                  <th className="px-3 py-2 text-right font-normal text-jr-muted">
                    R
                  </th>
                  <th className="px-3 py-2 text-left font-normal text-jr-muted">
                    Setup
                  </th>
                  <th className="px-3 py-2 text-left font-normal text-jr-muted">
                    Macro
                  </th>
                  <th className="px-3 py-2 text-left font-normal text-jr-muted">
                    Plan
                  </th>
                  <th className="px-3 py-2 text-left font-normal text-jr-muted">
                    Emotion
                  </th>
                  <th className="px-3 py-2 text-left font-normal text-jr-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((t, idx) => (
                  <tr
                    key={t.id}
                    className={
                      idx % 2 === 0 ? "bg-[#020617]" : "bg-[#020617]/70"
                    }
                  >
                    <td className="px-3 py-2 text-jr-text">{t.date}</td>
                    <td className="px-3 py-2 text-jr-text">{t.instrument}</td>
                    <td className="px-3 py-2 text-jr-text">{t.direction}</td>

                    <td
                      className={
                        "px-3 py-2 text-right " +
                        (t.resultR > 0
                          ? "text-jr-profit"
                          : t.resultR < 0
                          ? "text-jr-loss"
                          : "text-jr-text")
                      }
                    >
                      {t.resultR.toFixed(2)}R
                    </td>

                    <td className="px-3 py-2 text-jr-text">
                      <span className="line-clamp-1 max-w-[140px]">
                        {t.setup}
                      </span>
                    </td>

                    <td className="px-3 py-2">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                          (t.macroAlignment === "With"
                            ? "bg-jr-profit/20 text-jr-profit"
                            : t.macroAlignment === "Against"
                            ? "bg-jr-warning/20 text-jr-warning"
                            : "bg-jr-surface text-jr-muted")
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
                            ? "bg-jr-profit/20 text-jr-profit"
                            : "bg-jr-loss/20 text-jr-loss")
                        }
                      >
                        {t.followedPlan ? "YES" : "NO"}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-jr-muted">
                      <span className="line-clamp-1 max-w-[140px]">
                        {t.emotionNote}
                      </span>
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(t)}
                          className="rounded-md border border-jr-border px-2 py-0.5 text-[10px] text-jr-text hover:border-jr-primary hover:text-jr-primary-soft"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteTrade(t.id)}
                          className="rounded-md border border-jr-border px-2 py-0.5 text-[10px] text-jr-loss hover:border-jr-loss hover:text-jr-loss"
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
                      className="px-3 py-4 text-center text-jr-muted"
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
