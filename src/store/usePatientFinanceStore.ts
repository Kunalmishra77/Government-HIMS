import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// The patient's financial picture for the current episode of care — what the
// hospital has billed, what they've paid, and how much their insurance and
// Ayushman Bharat (PM-JAY) cover. Front-end simulation today; in production
// these roll up from the billing ledger + TPA/NHA claim engine. Amounts are in
// whole rupees. Seeded for the demo patient (Kiran Patil, PT-20394).

export interface FinanceState {
  totalExpenses: number   // everything billed this episode (consult + tests + meds + procedures)
  amountPaid: number      // settled out-of-pocket by the patient
  insurer?: string        // private payer name, if any
  insuranceCovered: number // amount the private insurer has approved/settled
  ayushmanLimit: number   // PM-JAY family floater eligible limit (₹5L/yr standard)
  ayushmanUsed: number    // PM-JAY amount consumed this year
}

// ---- Pure derivations (shared across the dashboard, billing & insurance pages) ----
export const outstanding = (s: FinanceState) =>
  Math.max(0, s.totalExpenses - s.amountPaid - s.insuranceCovered - s.ayushmanUsed)
export const ayushmanRemaining = (s: FinanceState) => Math.max(0, s.ayushmanLimit - s.ayushmanUsed)
export const coveredTotal = (s: FinanceState) => s.insuranceCovered + s.ayushmanUsed

// Consultation fee (₹600) + the accepted orders total (~₹1,460) + day-care
// procedure (₹2,220) — a realistic single-episode bill.
const SEED: FinanceState = {
  totalExpenses: 4280,
  amountPaid: 600,
  insurer: 'Star Health Insurance',
  insuranceCovered: 1460,
  ayushmanLimit: 500000,
  ayushmanUsed: 2220,
}

interface FinanceStore extends FinanceState {
  pay: (amount: number) => void
  reset: () => void
}

export const usePatientFinanceStore = create<FinanceStore>()(persist((set) => ({
  ...SEED,
  pay: (amount) => set((s) => ({ amountPaid: Math.min(s.totalExpenses, s.amountPaid + Math.max(0, amount)) })),
  reset: () => set(SEED),
}),
  {
    name: 'agentix-patientfinancestore', version: 1,
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  },
))
