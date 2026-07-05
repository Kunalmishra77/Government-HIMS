/* Agentix HIMS — Admin AI copilot (grounded answer engine).
 *
 * A ChatGPT-style assistant for the COO/admin that answers natural-language
 * questions about the WHOLE hospital. It is GROUNDED: every number comes from
 * the live Zustand stores (read synchronously via `.getState()`) and the pure
 * aggregators in opsMetrics — it never invents facts. Unmatched queries return
 * a helpful capability list. This mirrors the doctorCopilot pattern but spans
 * all operational domains, and attaches "Open …" navigation deep-links.
 *
 * The real-LLM swap point lives in copilotLLM.ts (runAdminCopilot) — when a
 * model is wired, it can call these same grounded readers as tools.
 */

import { useAdmissionStore } from "@/store/useAdmissionStore"
import { useBillingStore } from "@/store/useBillingStore"
import { useInsuranceStore } from "@/store/useInsuranceStore"
import { useHRStore, type ShiftType } from "@/store/useHRStore"
import { useStatutoryStore } from "@/store/useStatutoryStore"
import { useERStore } from "@/store/useERStore"
import { useOTStore } from "@/store/useOTStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { usePharmacyStore } from "@/store/usePharmacyStore"
import { useLabOrdersStore } from "@/store/useLabOrdersStore"
import { useInventoryStore } from "@/store/useInventoryStore"
import { useQualityStore } from "@/store/useQualityStore"
import { useVendorStore } from "@/store/useVendorStore"
import { usePatientStore } from "@/store/usePatientStore"
import {
  bedMetrics, erMetrics, otMetrics, ipdMetrics, revenueMetrics, claimMetrics, staffMetrics, inr,
} from "@/lib/opsMetrics"

export type AdminLink = { label: string; route: string }

// Conversational memory carried between turns so follow-ups resolve naturally:
// "how many OPDs today?" → "what about the revenue?" means *today's OPD revenue*.
export type AdminSubject = "OPD" | "IPD" | "Emergency" | "Day Care"
export type Timeframe = "today" | "yesterday"
export interface AdminContext { domain?: string; subject?: AdminSubject; timeframe?: Timeframe }

export interface AdminAnswer {
  text: string
  links?: AdminLink[]
  sources?: string[]
  confidence: number
  // Resolved context for this turn — the store carries it into the next question.
  context?: AdminContext
}

const has = (q: string, ...words: string[]) => words.some(w => q.includes(w))

function currentShift(): ShiftType {
  const h = new Date().getHours()
  return h >= 6 && h < 14 ? "Morning" : h >= 14 && h < 22 ? "Evening" : "Night"
}

const isoDay = (offset = 0): string => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function detectSubject(q: string): AdminSubject | undefined {
  if (/\bopds?\b|out ?patients?|out-patients?/.test(q)) return "OPD"
  if (/day ?care/.test(q)) return "Day Care"
  if (/\bipds?\b|in ?patients?|in-patients?|admission|admitted/.test(q)) return "IPD"
  if (/emergenc|casualty|\ber\b|trauma/.test(q)) return "Emergency"
  return undefined
}

function detectTimeframe(q: string): Timeframe | undefined {
  if (/yesterday|\bkal\b/.test(q)) return "yesterday"
  if (/today|\baaj\b|so far|right now|currently/.test(q)) return "today"
  return undefined
}

// ── Domain answerers ───────────────────────────────────────────────
// Each reads its store(s) at call time and returns a grounded answer.

function answerBeds(): AdminAnswer {
  const beds = useAdmissionStore.getState().beds
  const m = bedMetrics(beds)
  const top = m.byWard.slice(0, 4).map(w => `• ${w.ward}: ${w.occupied}/${w.total} (${w.pct}%)`).join("\n")
  const pending = useAdmissionStore.getState().admissionRequests?.filter(r => r.status === "Pending").length ?? 0
  return {
    text:
      `**Bed occupancy: ${m.occupancyPct}%** — ${m.occupied} occupied, **${m.available} available**, ${m.cleaning} in cleaning (of ${m.total} beds).\n` +
      `${pending} admission request(s) pending.\n\nBy ward:\n${top}`,
    links: [{ label: "Open bed map", route: "/admission/beds" }, { label: "Operations", route: "/admin/operations" }],
    sources: ["Admissions"],
    confidence: 0.95,
  }
}

// OPD footfall for today (or yesterday), with a day-over-day trend — grounded in
// the reception queue's registration dates. Answers "how many OPDs did we handle".
function answerOpd(tf: Timeframe = "today"): AdminAnswer {
  const patients = usePatientStore.getState().patients
  const dayOf = (p: (typeof patients)[number]) => p.registeredDate ?? p.registeredAt?.slice(0, 10)
  const countOn = (iso: string) => patients.filter(p => dayOf(p) === iso).length
  const target = tf === "yesterday" ? countOn(isoDay(-1)) : countOn(isoDay(0))
  const prevDay = tf === "yesterday" ? countOn(isoDay(-2)) : countOn(isoDay(-1))
  const label = tf === "yesterday" ? "yesterday" : "today"
  const delta = prevDay > 0 ? Math.round(((target - prevDay) / prevDay) * 100) : null
  const trend = delta == null ? "" : delta === 0 ? " — level with the day before"
    : delta > 0 ? ` — **${delta}% higher** than the day before` : ` — **${Math.abs(delta)}% lower** than the day before`
  const waiting = patients.filter(p => p.queueStatus === "waiting").length
  return {
    text: `We handled **${target} OPD consultation(s) ${label}**${trend}.` +
      (tf === "today" && waiting ? ` ${waiting} patient(s) currently waiting in the OPD queue.` : ""),
    links: [{ label: "Open OPD queue", route: "/reception/queue" }, { label: "COO dashboard", route: "/admin/dashboard" }],
    sources: ["Reception", "OPD"],
    confidence: 0.9,
  }
}

function answerRevenue(ctx: AdminContext = {}): AdminAnswer {
  const bills = useBillingStore.getState().bills
  const subject = ctx.subject
  const scoped = subject ? bills.filter(b => b.visitType === subject) : bills
  const m = revenueMetrics(scoped)
  // Cash = money actually received on non-insurance modes; insurance = insurer-borne
  // coverage on the same bills. Together they give the exec "total collection" view.
  const cash = scoped.filter(b => b.paymentMode !== "Insurance").reduce((s, b) => s + (b.paidAmount ?? 0), 0)
  const insurance = scoped.reduce((s, b) => s + (b.insuranceCovered ?? 0), 0)
  const scopeLabel = subject ? `${subject} ` : ""
  const head = subject
    ? `**${scopeLabel}revenue collected: ${inr(m.collected)}**`
    : `**Total collected: ${inr(cash + insurance)}** — cash ${inr(cash)} · insurance ${inr(insurance)}`
  return {
    text: `${head}, with **${inr(m.outstanding)} outstanding** across ${m.openCount} open bill(s). ${m.settledCount} bill(s) settled.`,
    links: [{ label: "Open Hospital P&L", route: "/admin/finance" }, { label: "Disputes", route: "/admin/disputes" }],
    sources: ["Billing"],
    confidence: 0.94,
  }
}

function answerClaims(): AdminAnswer {
  const claims = useInsuranceStore.getState().claims
  const m = claimMetrics(claims)
  const highRisk = claims
    .filter(c => (c.aiDenialRisk?.score ?? 0) > 60)
    .sort((a, b) => (b.aiDenialRisk?.score ?? 0) - (a.aiDenialRisk?.score ?? 0))
    .slice(0, 5)
  const list = highRisk.length
    ? "\n\nHighest denial-risk:\n" + highRisk.map(c => `• ${c.patientName} — ${c.aiDenialRisk?.score}% risk · ${inr(c.amount ?? 0)}`).join("\n")
    : ""
  return {
    text:
      `**${m.pending} claim(s) in progress** worth **${inr(m.atRiskValue)}** at risk · ${m.approved} approved · ${m.rejected} rejected.` + list,
    links: [{ label: "Open Insurance desk", route: "/insurance/dashboard" }],
    sources: ["Insurance"],
    confidence: 0.93,
  }
}

function answerCredentials(): AdminAnswer {
  const expiring = useHRStore.getState().getExpiringCredentials(30)
  if (!expiring.length) {
    return { text: "✅ No staff credentials or licences expire in the next 30 days.", links: [{ label: "Credentials", route: "/admin/credentials" }], sources: ["HR"], confidence: 0.92 }
  }
  const rows = expiring
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
    .slice(0, 8)
    .map(e => `• ${e.staff.name} — ${e.credential.type} · ${e.daysUntilExpiry <= 0 ? "**EXPIRED**" : `${e.daysUntilExpiry}d left`}`)
    .join("\n")
  return {
    text: `**${expiring.length} credential(s) expiring within 30 days:**\n${rows}`,
    links: [{ label: "Open Credentials", route: "/admin/credentials" }],
    sources: ["HR"],
    confidence: 0.94,
  }
}

function answerCoverage(): AdminAnswer {
  const hr = useHRStore.getState()
  const shift = currentShift()
  const today = new Date().toISOString().slice(0, 10)
  const depts = Array.from(new Set(hr.staff.map(s => s.department).filter(Boolean))) as string[]
  const gaps = depts
    .map(d => ({ dept: d, cov: hr.getCoverage(d, today, shift) }))
    .filter(x => x.cov.severity !== "ok")
    .sort((a, b) => (a.cov.severity === "critical" ? -1 : 1))
  if (!gaps.length) {
    return { text: `✅ All departments meet minimum coverage for the **${shift}** shift today.`, links: [{ label: "Coverage", route: "/admin/coverage" }], sources: ["HR"], confidence: 0.9 }
  }
  const rows = gaps.slice(0, 8).map(g =>
    `• ${g.dept} — ${g.cov.headcount}/${g.cov.min} (need ${g.cov.min}, ideal ${g.cov.ideal}) · ${g.cov.severity === "critical" ? "🔴 critical" : "🟡 short"}`,
  ).join("\n")
  return {
    text: `**${gaps.length} department(s) below coverage** for the ${shift} shift:\n${rows}`,
    links: [{ label: "Open Coverage", route: "/admin/coverage" }, { label: "Duty roster", route: "/admin/duty" }],
    sources: ["HR"],
    confidence: 0.92,
  }
}

function answerStaff(q: string): AdminAnswer {
  const staff = useHRStore.getState().staff
  const m = staffMetrics(staff)
  let roleNote = ""
  if (has(q, "doctor")) roleNote = ` · ${staff.filter(s => s.role === "doctor" && s.status === "active").length} active doctors`
  else if (has(q, "nurse")) roleNote = ` · ${staff.filter(s => s.role === "nurse" && s.status === "active").length} active nurses`
  return {
    text: `**${m.active} active staff** of ${m.total} total · ${m.onLeave} on leave${roleNote}.`,
    links: [{ label: "Open Staff directory", route: "/admin/users" }, { label: "Staffing", route: "/admin/staffing" }],
    sources: ["HR"],
    confidence: 0.9,
  }
}

function answerStatutory(): AdminAnswer {
  const st = useStatutoryStore.getState()
  const counts = st.getStatusCounts()
  const dueSoon = st.getNextDueDays(7)
  const soonList = dueSoon.length
    ? "\n\nDue in 7 days:\n" + dueSoon.slice(0, 6).map(e => `• ${e.type} — ${e.dueDate}${e.status === "overdue" ? " · 🔴 overdue" : ""}`).join("\n")
    : ""
  return {
    text:
      `**Statutory filings:** ${counts.overdue ?? 0} overdue 🔴 · ${counts.due_soon ?? 0} due soon 🟡 · ${counts.upcoming ?? 0} upcoming · ${counts.filed ?? 0} filed.` + soonList,
    links: [{ label: "Open Statutory calendar", route: "/admin/statutory" }, { label: "Compliance", route: "/admin/compliance" }],
    sources: ["Statutory"],
    confidence: 0.93,
  }
}

function answerQuality(): AdminAnswer {
  const qs = useQualityStore.getState()
  const open = qs.incidents.filter(i => i.status !== "Resolved")
  const high = open.filter(i => i.severity === "Critical" || i.severity === "High")
  return {
    text:
      `**${open.length} open incident(s)**${high.length ? `, ${high.length} high-severity` : ""}. ` +
      (qs.nabh ? `Hand-hygiene compliance ${qs.nabh.handHygieneCompliancePct ?? "—"}%.` : ""),
    links: [{ label: "Open Quality dashboard", route: "/quality/dashboard" }, { label: "Compliance", route: "/admin/compliance" }],
    sources: ["Quality"],
    confidence: 0.88,
  }
}

function answerER(): AdminAnswer {
  const m = erMetrics(useERStore.getState().patients)
  return {
    text: `**ER census: ${m.active}** active · ${m.highAcuity} high-acuity (ESI 1–2) · ${m.awaitingTriage} awaiting triage · ${m.awaitingDisposition} awaiting disposition.`,
    links: [{ label: "Open Emergency", route: "/emergency/dashboard" }],
    sources: ["Emergency"],
    confidence: 0.92,
  }
}

function answerOT(): AdminAnswer {
  const m = otMetrics(useOTStore.getState().procedures)
  return {
    text: `**OT today:** ${m.scheduled} scheduled · ${m.inProgress} in progress · ${m.completed} completed · ${m.utilizationPct}% utilisation.`,
    links: [{ label: "Open OT board", route: "/ot/dashboard" }],
    sources: ["OT"],
    confidence: 0.9,
  }
}

function answerIPD(): AdminAnswer {
  const m = ipdMetrics(useInpatientStore.getState().inpatients)
  return {
    text: `**IPD census: ${m.census}** · ${m.critical} critical/serious · ALOS ${m.alosDays}d · ${m.dischargePending} discharge-pending.`,
    links: [{ label: "Bed map", route: "/admission/beds" }, { label: "Discharge desk", route: "/discharge/dashboard" }],
    sources: ["Inpatient"],
    confidence: 0.9,
  }
}

function answerPharmacy(): AdminAnswer {
  const rx = usePharmacyStore.getState().prescriptions
  const queued = rx.filter(p => p.status === "queued").length
  const ready = rx.filter(p => p.status === "ready").length
  return {
    text: `**Pharmacy:** ${queued} prescription(s) queued · ${ready} ready for collection · ${rx.length} total in flight.`,
    links: [{ label: "Open Pharmacy queue", route: "/pharmacy/queue" }],
    sources: ["Pharmacy"],
    confidence: 0.88,
  }
}

function answerLab(): AdminAnswer {
  const orders = useLabOrdersStore.getState().orders
  const tests = orders.flatMap(o => o.tests)
  const pending = tests.filter(t => t.status !== "verified" && t.status !== "released").length
  return {
    text: `**Lab:** ${pending} test(s) pending across ${orders.length} order(s).`,
    links: [{ label: "Open Lab dashboard", route: "/lab/dashboard" }],
    sources: ["Lab"],
    confidence: 0.86,
  }
}

function answerInventory(): AdminAnswer {
  const assets = useInventoryStore.getState().assets
  const low = assets.filter(a => a.status === "Low Stock")
  const maint = assets.filter(a => a.status === "Maintenance Required")
  return {
    text: `**Inventory:** ${low.length} item(s) low on stock · ${maint.length} asset(s) need maintenance.` +
      (low.length ? "\n\nLow stock:\n" + low.slice(0, 6).map(a => `• ${a.name}`).join("\n") : ""),
    links: [{ label: "Vendors & POs", route: "/admin/vendors" }],
    sources: ["Inventory"],
    confidence: 0.86,
  }
}

function answerVendors(): AdminAnswer {
  const invoices = useVendorStore.getState().invoices
  const unpaid = invoices.filter(i => i.status !== "paid")
  const payable = unpaid.reduce((s, i) => s + (i.amount ?? 0), 0)
  return {
    text: `**${unpaid.length} unpaid vendor invoice(s)** worth **${inr(payable)}**.`,
    links: [{ label: "Open Vendors", route: "/admin/vendors" }, { label: "Payroll", route: "/admin/payroll" }],
    sources: ["Vendor"],
    confidence: 0.88,
  }
}

function answerPatientLookup(q: string): AdminAnswer | null {
  const patients = usePatientStore.getState().patients
  const inpatients = useInpatientStore.getState().inpatients
  const tokens = q.replace(/[^a-z\s]/g, "").split(/\s+/).filter(t => t.length > 2)
  const match = (name: string) => tokens.some(t => name.toLowerCase().includes(t))
  const p = patients.find(p => match(p.name))
  const ip = inpatients.find(i => match(i.name))
  if (!p && !ip) return null
  const who = ip ?? p
  const detail = ip
    ? `admitted in ${ip.ward} (${ip.bed}) · ${ip.diagnosis} · ${ip.condition}`
    : `OPD · ${p!.department || "—"} · ${p!.queueStatus || "registered"}`
  return {
    text: `**${who!.name}** — ${detail}.`,
    links: [{ label: "Open Patients", route: "/admin/patients" }],
    sources: [ip ? "Inpatient" : "Patient"],
    confidence: 0.82,
  }
}

function answerOverview(): AdminAnswer {
  const beds = bedMetrics(useAdmissionStore.getState().beds)
  const er = erMetrics(useERStore.getState().patients)
  const ipd = ipdMetrics(useInpatientStore.getState().inpatients)
  const rev = revenueMetrics(useBillingStore.getState().bills)
  const clm = claimMetrics(useInsuranceStore.getState().claims)
  return {
    text:
      `**Hospital snapshot**\n` +
      `• Beds: ${beds.occupancyPct}% occupied · ${beds.available} free\n` +
      `• IPD census: ${ipd.census} (${ipd.critical} critical)\n` +
      `• ER: ${er.active} active · ${er.highAcuity} high-acuity\n` +
      `• Revenue: ${inr(rev.collected)} collected · ${inr(rev.outstanding)} outstanding\n` +
      `• Claims: ${inr(clm.atRiskValue)} at risk (${clm.pending} pending)`,
    links: [{ label: "Command centre", route: "/admin/command-center" }, { label: "COO dashboard", route: "/admin/dashboard" }],
    sources: ["Admissions", "Emergency", "Inpatient", "Billing", "Insurance"],
    confidence: 0.92,
  }
}

const CAPABILITIES =
  "I'm the Agentix HIMS admin assistant, grounded in live hospital data. Ask me things like:\n" +
  "• \"What's today's revenue?\" / \"outstanding receivables\"\n" +
  "• \"ICU occupancy\" / \"how many beds are free?\"\n" +
  "• \"Which licences expire this month?\"\n" +
  "• \"Coverage gaps today\" / \"staff on leave\"\n" +
  "• \"High denial-risk claims\"\n" +
  "• \"Overdue statutory filings\"\n" +
  "• \"ER census\" / \"OT schedule\" / \"open incidents\"\n" +
  "• \"Give me a hospital snapshot\""

// ── Intent matching ────────────────────────────────────────────────
// Short, ambiguous tokens (≤3 chars or substrings of common words) must
// match on a word boundary; longer/specific terms can match as substrings
// and score higher. This lets the admin phrase questions naturally.
const SHORT = new Set(["ot", "er", "icu", "ccu", "pf", "esi", "tds", "gst", "rx", "po", "hai", "los", "kpi", "pnl", "bed", "lab", "ay"])

function score(q: string, words: string[]): number {
  let s = 0
  for (const w of words) {
    if (w.length <= 3 || SHORT.has(w)) {
      if (new RegExp(`\\b${w}\\b`, "i").test(q)) s += 2
    } else if (q.includes(w)) {
      s += w.length >= 6 ? 2 : 1
    }
  }
  return s
}

type Domain = { key: string; fn: (q: string, ctx: AdminContext) => AdminAnswer; words: string[] }

// Ordered by priority (earlier wins ties). Generous synonyms so natural
// phrasings ("how's the money", "any beds free", "who's on leave") resolve.
// `key` is what we remember as the conversational focus for follow-ups.
const DOMAINS: Domain[] = [
  { key: "beds", fn: () => answerBeds(), words: ["bed", "beds", "occupanc", "occupied", "vacant", "free bed", "available", "ward", "icu", "ccu", "capacity", "full", "empty"] },
  { key: "revenue", fn: (_q, ctx) => answerRevenue(ctx), words: ["revenue", "collected", "collection", "outstanding", "receivable", "billing", "bill", "cash", "income", "earning", "money", "financ", "turnover", "paid", "dues", "pnl", "profit", "p&l"] },
  { key: "opd", fn: (_q, ctx) => answerOpd(ctx.timeframe ?? "today"), words: ["opd", "opds", "consultation", "consult", "footfall", "out-patient", "outpatient", "out patient", "walk-in", "walkin", "how many patient"] },
  { key: "claims", fn: () => answerClaims(), words: ["claim", "denial", "denied", "deny", "pre-auth", "preauth", "tpa", "insurance", "insurer", "reimburs", "cashless"] },
  { key: "credentials", fn: () => answerCredentials(), words: ["licen", "credential", "certif", "expir", "registration", "council", "renew", "mci", "aerb"] },
  { key: "coverage", fn: () => answerCoverage(), words: ["coverage", "understaff", "short staff", "short-staff", "staffing gap", "shortfall", "cover", "minimum staff", "roster gap"] },
  { key: "statutory", fn: () => answerStatutory(), words: ["statutory", "filing", "file", "gst", "gstr", "pf", "esi", "tds", "professional tax", "return", "compliance", "overdue", "deadline", "due date", "regulatory"] },
  { key: "quality", fn: () => answerQuality(), words: ["incident", "quality", "nabh", "fall", "infection", "hai", "near miss", "safety", "complaint", "audit", "capa", "sentinel"] },
  { key: "er", fn: () => answerER(), words: ["emergency", "casualty", "triage", "acuity", "esi", "trauma", "er"] },
  { key: "ot", fn: () => answerOT(), words: ["theatre", "theater", "surger", "surgic", "operation", "procedure", "surgeon", "scheduled surg", "ot"] },
  { key: "ipd", fn: () => answerIPD(), words: ["ipd", "inpatient", "in-patient", "census", "admitted", "admission", "critical", "serious", "alos", "length of stay", "discharge", "ward patient"] },
  { key: "pharmacy", fn: () => answerPharmacy(), words: ["pharmac", "medicine", "medication", "prescription", "dispense", "drug", "rx", "stock out"] },
  { key: "lab", fn: () => answerLab(), words: ["laborator", "pathology", "blood test", "lab", "test", "sample", "report"] },
  { key: "inventory", fn: () => answerInventory(), words: ["inventory", "stock", "asset", "equipment", "maintenance", "reorder", "supply", "consumable"] },
  { key: "vendors", fn: () => answerVendors(), words: ["vendor", "payable", "invoice", "supplier", "payment", "procurement", "purchase order", "po"] },
  { key: "staff", fn: (q) => answerStaff(q), words: ["staff", "employee", "headcount", "doctor", "nurse", "technician", "workforce", "team", "people", "on leave", "leave", "attendance", "working", "manpower"] },
]

const OVERVIEW = ["snapshot", "overview", "summary", "how is", "how are", "status", "everything", "overall", "situation", "report", "briefing", "whats happening", "what's happening", "how's the hospital", "hospital today", "give me"]

// A bare follow-up ("and yesterday?", "what about it?", "the revenue?") carries
// no domain of its own — it leans on the previous turn's focus.
const FOLLOWUP = /^(and|what about|how about|ok|okay|so|then|also|that|it|same|more|those)\b/

/**
 * Grounded admin answer engine. Scores the query against every hospital domain
 * and answers from the best match — reading live store data, never inventing.
 * `prior` carries the last turn's focus so follow-ups resolve naturally; the
 * returned answer's `context` is what the caller should feed back in next turn.
 * Falls back to a useful snapshot (not a dead-end) when intent is unclear.
 */
export function respondAdmin(query: string, prior: AdminContext = {}): AdminAnswer {
  const q = query.trim().toLowerCase()
  const withCtx = (a: AdminAnswer, ctx: AdminContext): AdminAnswer => ({ ...a, context: ctx })
  if (!q) return withCtx({ text: CAPABILITIES, confidence: 0.4 }, {})

  // Greeting vs help.
  if (/^(hi|hey|hello|yo|namaste|namaskar)\b/.test(q))
    return withCtx({ text: "Hello! Welcome to Agentix HIMS. How can I help you run the hospital today?", confidence: 0.7 }, {})
  if (/^(help|what can you|who are you|what do you do)/.test(q) || q === "help")
    return withCtx({ text: CAPABILITIES, confidence: 0.6 }, {})

  // Carry forward the conversational focus: an explicit subject/timeframe in this
  // turn overrides the remembered one; otherwise we inherit the prior focus.
  const subject = detectSubject(q) ?? prior.subject
  const timeframe = detectTimeframe(q) ?? prior.timeframe
  const ctxIn: AdminContext = { subject, timeframe }

  // Explicit overview intent.
  const overviewScore = score(q, OVERVIEW)
  let best: { d: Domain | null; s: number } = { d: null, s: 0 }
  for (const d of DOMAINS) {
    const s = score(q, d.words)
    if (s > best.s) best = { d, s }
  }

  // A clear domain match wins unless the user explicitly asked for an overview.
  if (best.d && best.s >= (overviewScore >= 4 ? 99 : 1))
    return withCtx(best.d.fn(q, ctxIn), { domain: best.d.key, subject, timeframe })
  if (overviewScore >= 2) return withCtx(answerOverview(), { domain: "overview", subject, timeframe })

  // No domain of its own: if it reads as a follow-up, reuse the prior focus so
  // "what about yesterday?" after an OPD question stays on OPD.
  const isFollowup = FOLLOWUP.test(q) || q.split(/\s+/).length <= 3
  if (prior.domain && isFollowup) {
    if (prior.domain === "overview") return withCtx(answerOverview(), { domain: "overview", subject, timeframe })
    const d = DOMAINS.find(x => x.key === prior.domain)
    if (d) return withCtx(d.fn(q, ctxIn), { domain: d.key, subject, timeframe })
  }

  // Name lookup (e.g. "where is Kiran Patil", "patient Anil").
  const lookup = answerPatientLookup(q)
  if (lookup) return withCtx(lookup, { subject, timeframe })

  // Never dead-end: give the live snapshot plus a gentle nudge.
  const snap = answerOverview()
  return withCtx({
    ...snap,
    text: `I wasn't sure which area you meant, so here's where the hospital stands right now:\n\n${snap.text}\n\nYou can also ask about credentials, coverage, claims, statutory filings, OT, pharmacy, lab or inventory.`,
    confidence: 0.5,
  }, { subject, timeframe })
}
