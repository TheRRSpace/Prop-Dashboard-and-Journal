// app/components/EventsTable.tsx

type EventRow = {
  date: string; // "YYYY-MM-DD"
  propFirm: string;
  type: "payout" | "fee" | string;
  amount: number;
};

function formatDateYMD(dateStr: string) {
  // Input: "2025-03-10"  -> Output: "10/03/2025"
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export default function EventsTable({ events }: { events: EventRow[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">
          Events (Payouts & Fees)
        </h2>
        <p className="text-xs text-slate-400">
          This is the raw data feeding your KPIs and charts.
        </p>
      </div>

      <div className="max-h-80 overflow-auto text-xs">
        <table className="min-w-full border-t border-slate-800">
          <thead className="bg-slate-900 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-400">
                Date
              </th>
              <th className="px-4 py-2 text-left font-medium text-slate-400">
                Prop Firm
              </th>
              <th className="px-4 py-2 text-left font-medium text-slate-400">
                Type
              </th>
              <th className="px-4 py-2 text-right font-medium text-slate-400">
                Amount (USD)
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, idx) => (
              <tr
                key={`${e.date}-${e.propFirm}-${idx}`}
                className={idx % 2 === 0 ? "bg-slate-950" : "bg-slate-900/70"}
              >
                <td className="px-4 py-2 text-slate-200">
                  {formatDateYMD(e.date)}
                </td>
                <td className="px-4 py-2 text-slate-200">{e.propFirm}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                      (e.type === "payout"
                        ? "bg-emerald-900/60 text-emerald-300"
                        : e.type === "fee"
                        ? "bg-red-900/60 text-red-300"
                        : "bg-slate-800 text-slate-200")
                    }
                  >
                    {e.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-slate-200">
                  {e.amount.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
