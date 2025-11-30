// app/data/accountsData.ts

// One row per account. Change these later to your real accounts.
export const accounts = [
  {
    id: "FTMO-100-1",
    propFirm: "FTMO",
    size: 100000,
    type: "evaluation", // "evaluation" or "funded"
    stage: "phase1", // "phase1" | "phase2" | "funded" | "payout" | "failed"
    isActive: true,
  },
  {
    id: "FTMO-200-2",
    propFirm: "FTMO",
    size: 100000,
    type: "evaluation",
    stage: "phase1",
    isActive: true,
  },
  {
    id: "ACG-200-1",
    propFirm: "5ERS",
    size: 200000,
    type: "evaluation",
    stage: "phase1",
    isActive: true,
  },
  {
    id: "BrightFunded-100-1",
    propFirm: "BrightFunded",
    size: 100000,
    type: "evaluation",
    stage: "phase1",
    isActive: true,
  },
];
