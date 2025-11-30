"use client";

import { useEffect, useMemo, useState } from "react";

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

  // simple stats
  const stats = useMemo(() => {
    if (trades.length === 0) {
      return {
        total: 0,
        winRate: 0,
        avgR: 0,
      };
    }
    const total = trades.length;
    const wins = trades.filter((t) => t.resultR > 0).length;
    const winRate = (wins / total) * 100;
    const avgR = trades.reduce((sum, t) => sum + t.resultR, 0) / total;

    return { total, winRate, avgR };
  }, [trades]);

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
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Stats</h2>
          <div className="grid gap-4 text-xs sm:grid-cols-3">
            <div>
              <p className="text-slate-400">Total trades</p>
              <p className="text-lg font-semibold">{stats.total}</p>
            </div>
            <div>
              <p className="text-slate-400">Win rate</p>
              <p className="text-lg font-semibold">
                {stats.winRate.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-slate-400">Average R</p>
              <p className="text-lg font-semibold">{stats.avgR.toFixed(2)}R</p>
            </div>
          </div>
        </section>

        {/* Trades list */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Trades</h2>
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
                {trades.map((t, idx) => (
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
                    <td className="px-3 py-2 text-slate-200">
                      {t.macroAlignment}
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

                {trades.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-4 text-center text-slate-500"
                    >
                      No trades logged yet.
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
