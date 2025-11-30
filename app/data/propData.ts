// app/data/propData.ts

// One row per "event" in your prop journey.
// You can replace these with your real numbers later.
export type PropEventType = "purchase" | "payout" | "fee";

export type PropEvent = {
  date: string; // "2025-11-20"
  propFirm: string; // "Alpha Capital Group"
  type: PropEventType; // "payout" | "fee" | "purchase"
  amount: number; // positive USD
};

export const events: PropEvent[] = [
  {
    date: "2025-09-22",
    propFirm: "FTMO",
    type: "fee",
    amount: 522.2,
  },
  {
    date: "2025-09-09",
    propFirm: "FTMO",
    type: "fee",
    amount: 1279.64,
  },
  {
    date: "2025-09-10",
    propFirm: "5ERS",
    type: "fee",
    amount: 505,
  },
  {
    date: "2025-07-10",
    propFirm: "5ERS",
    type: "fee",
    amount: 545,
  },
  {
    date: "2025-02-03",
    propFirm: "5ERS",
    type: "fee",
    amount: 165,
  },
  {
    date: "2025-01-01",
    propFirm: "5ERS",
    type: "fee",
    amount: 440.5,
  },
  {
    date: "2025-08-21",
    propFirm: "5ERS",
    type: "payout",
    amount: 4233,
  },
  {
    date: "2025-09-25",
    propFirm: "5ERS",
    type: "payout",
    amount: 4184,
  },
  {
    date: "2025-08-22",
    propFirm: "E8",
    type: "fee",
    amount: 471,
  },
  {
    date: "2025-08-25",
    propFirm: "THINK CAPITAL",
    type: "fee",
    amount: 523,
  },
  {
    date: "2025-05-05",
    propFirm: "BRIGHTFUNDED",
    type: "fee",
    amount: 473.51,
  },
  {
    date: "2025-11-28",
    propFirm: "BRIGHTFUNDED",
    type: "fee",
    amount: 401.98,
  },
];
