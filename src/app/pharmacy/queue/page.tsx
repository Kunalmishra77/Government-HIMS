"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState, type ReactNode, type ComponentType } from "react"
import {
  Pill, ChevronDown, ChevronRight, IndianRupee, Bed, ShieldAlert, Package,
  CheckCircle, Clock, Minus, Plus, ShoppingCart, ExternalLink, UserCheck,
  PackageX, Hand, Search, Stethoscope, Repeat, X,
} from "lucide-react"
import {
  usePharmacyStore, UNIT_PRICES,
  type PharmacyPrescription, type PharmacyMedicine, type PrepStatus,
  type RxSource, type ModificationReason, type Pharmacist,
} from "@/store/usePharmacyStore"
import { usePharmacyInventoryStore } from "@/store/usePharmacyInventoryStore"
import { useNarcoticsStore } from "@/store/useNarcoticsStore"
import { usePatientProfileStore } from "@/store/usePatientProfileStore"
import { useDischargeStore } from "@/store/useDischargeStore"
import { useNotificationStore } from "@/store/useNotificationStore"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { useAuthStore } from "@/store/useAuthStore"
import { checkRx } from "@/lib/drugSafety"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const SOURCE_STYLE: Record<RxSource, string> = {
  OPD: "bg-[rgba(8,145,178,0.07)] text-[var(--color-primary)] ring-blue-200",
  IPD: "bg-[rgba(8,145,178,0.07)] text-[var(--color-primary)] ring-cyan-200",
  ICU: "bg-red-50 text-red-700 ring-red-200",
  OT: "bg-[rgba(8,145,178,0.07)] text-[var(--color-primary)] ring-blue-200",
  "Home Rx": "bg-[rgba(8,145,178,0.07)] text-[var(--color-primary)] ring-blue-200",
  Discharge: "bg-amber-50 text-amber-700 ring-amber-200",
}
const STATUS_STYLE: Record<PrepStatus, string> = {
  queued: "bg-amber-100 text-amber-700",
  preparing: "bg-[rgba(8,145,178,0.12)] text-[var(--color-primary)]",
  ready: "bg-green-100 text-green-700",
  collected: "bg-slate-100 text-slate-500",
}
const REASONS: ModificationReason[] = ["Partial fill", "Out of stock", "Has at home", "Unable to afford", "Travelling today"]

const srcOf = (p: PharmacyPrescription): RxSource => p.source ?? "OPD"
const qtyOf = (rx: PharmacyPrescription, m: PharmacyMedicine) =>
  rx.quantityModifications?.find(q => q.medicineName === m.name)?.adjustedQty ?? m.quantity
const billOf = (rx: PharmacyPrescription) =>
  rx.adjustedBillTotal ?? rx.medicines.reduce((s, m) => s + qtyOf(rx, m) * (UNIT_PRICES[m.name] ?? 0), 0)
const outOfStockCount = (rx: PharmacyPrescription) =>
  rx.medicines.filter(m => m.inStock === false && m.supply !== "advised_outside").length
const timeAgo = (iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export default function PharmacyQueue() {
  const prescriptions = usePharmacyStore(s => s.prescriptions)
  const claim = usePharmacyStore(s => s.claim)
  const release = usePharmacyStore(s => s.release)
  const updateStatus = usePharmacyStore(s => s.updateStatus)
  const markCollected = usePharmacyStore(s => s.markCollected)
  const adjustQuantity = usePharmacyStore(s => s.adjustQuantity)
  const approveSupervisorOverride = usePharmacyStore(s => s.approveSupervisorOverride)
  const setMedicineSupply = usePharmacyStore(s => s.setMedicineSupply)
  const substituteMedicine = usePharmacyStore(s => s.substituteMedicine)

  const decrementByName = usePharmacyInventoryStore(s => s.decrementByName)
  const raisePurchaseOrder = usePharmacyInventoryStore(s => s.raisePurchaseOrder)
  const substitutesFor = usePharmacyInventoryStore(s => s.substitutesFor)
  const addNarcoticEntry = useNarcoticsStore(s => s.addEntry)
  const profiles = usePatientProfileStore(s => s.profiles)
  const setClearance = useDischargeStore(s => s.setClearance)
  const addNotification = useNotificationStore(s => s.add)
  const currentUser = useAuthStore(s => s.currentUser)

  const me: Pharmacist = { id: currentUser?.id ?? "PH-301", name: currentUser?.name ?? "Ritu Sharma" }

  const [tab, setTab] = useState<"queue" | "collected">("queue")
  const [scope, setScope] = useState<"all" | "mine">("all")
  const [query, setQuery] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [collectingId, setCollectingId] = useState<string | null>(null)
  const [collector, setCollector] = useState("")
  const [reasonById, setReasonById] = useState<Record<string, ModificationReason>>({})
  const [substitutingKey, setSubstitutingKey] = useState<string | null>(null)

  const { active, collected } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (p: PharmacyPrescription) =>
      !q || p.patientName.toLowerCase().includes(q) || p.doctorName.toLowerCase().includes(q) ||
      srcOf(p).toLowerCase().includes(q) || p.medicines.some(m => m.name.toLowerCase().includes(q))
    const all = prescriptions.filter(match)
    return {
      active: all.filter(p => p.status !== "collected")
        .filter(p => scope === "all" || p.assignedTo?.id === me.id),
      collected: all.filter(p => p.status === "collected")
        .filter(p => scope === "all" || p.dispensedBy?.id === me.id)
        .sort((a, b) => (b.collectedAt ?? "").localeCompare(a.collectedAt ?? "")),
    }
  }, [prescriptions, query, scope, me.id])

  const rows = tab === "queue" ? active : collected

  const advanceToReady = (rx: PharmacyPrescription) => {
    updateStatus(rx.id, "ready")
    const isWard = ["IPD", "ICU", "OT"].includes(srcOf(rx))
    notifyAndAudit({
      to: isWard ? 'nurse' : 'patient',
      type: 'medicines_ready', priority: 'medium',
      title: 'Medicines ready for collection',
      body: `${rx.patientName} — Rx ready at pharmacy. ${isWard ? 'Please collect from ward pharmacy counter.' : 'Please collect from the OPD pharmacy counter.'}`,
      patientName: rx.patientName,
      audit: { action: 'drug_dispense', resource: 'prescription', resourceId: rx.id, detail: `Rx for ${rx.patientName} marked ready (${isWard ? 'ward' : 'patient'}-side notification)`, userName: me.name },
    })
    toast.success(`${rx.patientName} — meds ready · ${isWard ? "ward" : "patient"} notified`)
  }

  const openCollect = (rx: PharmacyPrescription) => {
    setCollectingId(rx.id)
    setCollector(srcOf(rx) === "OPD" || srcOf(rx) === "Home Rx" ? "Self (patient)" : "Ward nurse")
    setExpandedId(rx.id)
  }

  // Final dispense: record collector, decrement stock for lines we actually
  // supply, auto-log controlled drugs, and clear the discharge pharmacy pillar.
  //
  // Phase 6 Task 6 — `decrementByName` is now `Promise<StockItem | undefined>`
  // (bridged into the real backend), so its return value — read synchronously
  // right here to gate the controlled-substance auto-log — must be awaited.
  // `forEach` can't do that, so this loop is a `for...of` instead; each
  // medicine line is still processed in its original prescribed order.
  const confirmCollect = async (rx: PharmacyPrescription) => {
    const who = collector.trim() || "Self (patient)"
    markCollected(rx.id, who)
    const now = new Date()
    for (const m of rx.medicines) {
      if (m.supply === "advised_outside") continue // bought outside — not our stock
      const item = await decrementByName(m.name, qtyOf(rx, m))
      if (item?.schedule) {
        addNarcoticEntry({
          drug: item.name, date: now.toISOString().slice(0, 10),
          time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          patient: rx.patientName, patientId: rx.patientId, dose: m.dosage,
          prescriber: rx.doctorName, dispenser: me.name, secondSignatory: rx.doctorName,
          batchNo: "BTH-20240501-M", runningStock: Math.max(0, item.qty - qtyOf(rx, m)),
        })
      }
    }
    if (srcOf(rx) === "Discharge") {
      setClearance(rx.patientId, "pharmacy", "cleared")
      notifyAndAudit({
        to: 'discharge', type: 'discharge_ready', priority: 'medium',
        title: `TTO meds dispensed — ${rx.patientName}`,
        body: `Take-home medicines dispensed to ${who}; pharmacy clearance done. Discharge desk may proceed.`,
        patientName: rx.patientName,
        audit: { action: 'drug_dispense', resource: 'prescription', resourceId: rx.id, detail: `TTO dispensed to ${who} · pharmacy clearance set`, userName: me.name },
      })
    } else {
      notifyAndAudit({
        to: 'discharge', type: 'system', priority: 'low',
        title: `Rx dispensed · ${rx.patientName}`,
        body: `${rx.medicines.length} item${rx.medicines.length !== 1 ? 's' : ''} dispensed to ${who} for ${rx.patientName} (${srcOf(rx)}).`,
        patientName: rx.patientName,
        audit: { action: 'drug_dispense', resource: 'prescription', resourceId: rx.id, detail: `Rx dispensed to ${who}`, userName: me.name },
      })
    }
    setCollectingId(null)
    toast.success(`${rx.patientName} — dispensed to ${who} · stock updated`)
  }

  const step = (rx: PharmacyPrescription, m: PharmacyMedicine, delta: number) => {
    const reason = reasonById[rx.id] ?? "Partial fill"
    adjustQuantity(rx.id, m.name, qtyOf(rx, m) + delta, reason, me.name)
  }

  const orderFromInventory = (rx: PharmacyPrescription, m: PharmacyMedicine) => {
    raisePurchaseOrder({ drug: m.name, qty: Math.max(qtyOf(rx, m), 50), kind: 'patient', forPatient: rx.patientName, raisedBy: me.name })
    setMedicineSupply(rx.id, m.name, "order_raised")
    toast.success(`Purchase order raised to inventory manager — ${m.name}`)
  }
  const adviseOutside = (rx: PharmacyPrescription, m: PharmacyMedicine) => {
    setMedicineSupply(rx.id, m.name, "advised_outside")
    notifyAndAudit({
      to: 'patient', type: 'medicines_ready', priority: 'medium',
      title: `${m.name} — please buy outside`,
      body: `Hospital pharmacy is out of stock of ${m.name}. Please source from an outside pharmacy — your e-prescription has the brand details.`,
      patientName: rx.patientName,
      audit: { action: 'pharmacy_substituted', resource: 'prescription', resourceId: rx.id, detail: `${m.name} advised-outside (out of stock)`, userName: me.name },
    })
    notifyAndAudit({
      to: 'doctor', type: 'system', priority: 'low',
      title: `Rx fulfilment routed outside · ${rx.patientName}`,
      body: `${m.name} not in stock — advised outside. Re-prescribe if you need a specific brand.`,
      patientName: rx.patientName,
      audit: { action: 'pharmacy_substituted', resource: 'prescription', resourceId: rx.id, detail: `${m.name} advised-outside`, userName: me.name },
    })
    toast(`${m.name} advised-outside — doctor + patient notified`)
  }
  const substitute = (rx: PharmacyPrescription, originalName: string, newName: string) => {
    // M9-E — NABH MOM traceability. Capture the substitution reason before
    // committing, and notify the prescribing doctor so a second-pair-of-eyes
    // sees the change.
    const reason = typeof window !== 'undefined'
      ? window.prompt(`Substitution reason for ${originalName} → ${newName}\n(e.g. "Out of stock", "Same-API generic")`)
      : null
    if (!reason || reason.trim().length < 3) {
      toast.error('Substitution reason required (≥ 3 chars)')
      return
    }
    substituteMedicine(rx.id, originalName, newName, me.name)
    setSubstitutingKey(null)
    notifyAndAudit({
      to: 'doctor', type: 'system', priority: 'high',
      title: `Rx substitution · ${rx.patientName}`,
      body: `${originalName} → ${newName} for ${rx.patientName}. Reason: ${reason.trim()}. Approved by ${me.name}.`,
      patientName: rx.patientName,
      audit: { action: 'pharmacy_substituted', resource: 'prescription', resourceId: rx.id, detail: `${originalName} → ${newName} · ${reason.trim()}`, userName: me.name },
    })
    toast.success(`Substituted ${originalName} → ${newName} · Doctor notified`)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Prescription Queue</h1>
        <p className="text-sm text-[#64748B] mt-1">One row per patient · every order tagged by source · accept → ready → collected</p>
      </div>

      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          {([["queue", `Queue (${active.length})`], ["collected", `Collected (${collected.length})`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn("px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition", tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{label}</button>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          {([["all", "All"], ["mine", "My counter"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setScope(k)}
              className={cn("px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition", scope === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{label}</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search patient, doctor, drug, source…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Pill className="h-9 w-9 mb-2 opacity-40" />
            <p className="text-sm font-semibold">{tab === "queue" ? "Queue is clear" : "No collected records yet"}</p>
          </div>
        )}
        {rows.map(rx => (
          <QueueRow
            key={rx.id} rx={rx} me={me}
            expanded={expandedId === rx.id}
            collecting={collectingId === rx.id}
            collector={collector} setCollector={setCollector}
            reason={reasonById[rx.id] ?? "Partial fill"}
            setReason={(r) => setReasonById(s => ({ ...s, [rx.id]: r }))}
            allergies={profiles[rx.patientId]?.allergies ?? []}
            onToggle={() => setExpandedId(id => (id === rx.id ? null : rx.id))}
            onClaim={() => { claim(rx.id, me); toast.success(`Accepted ${rx.patientName} onto your counter`) }}
            onRelease={() => { release(rx.id); toast(`Released ${rx.patientName} back to the queue`) }}
            onReady={() => advanceToReady(rx)}
            onOpenCollect={() => openCollect(rx)}
            onConfirmCollect={() => confirmCollect(rx)}
            onCancelCollect={() => setCollectingId(null)}
            onStep={(m, d) => step(rx, m, d)}
            onApproveOverride={(m) => { approveSupervisorOverride(rx.id, m.name, me.name); toast.success("Supervisor override approved") }}
            onOrder={(m) => orderFromInventory(rx, m)}
            onAdviseOutside={(m) => adviseOutside(rx, m)}
            substitutingMed={substitutingKey?.startsWith(`${rx.id}::`) ? substitutingKey.slice(rx.id.length + 2) : null}
            onStartSubstitute={(m) => setSubstitutingKey(`${rx.id}::${m.name}`)}
            onCancelSubstitute={() => setSubstitutingKey(null)}
            getSubstitutes={(name) => substitutesFor(name)}
            onSubstitute={(originalName, newName) => substitute(rx, originalName, newName)}
          />
        ))}
      </div>
    </div>
  )
}

function QueueRow(props: {
  rx: PharmacyPrescription; me: Pharmacist; expanded: boolean; collecting: boolean
  collector: string; setCollector: (v: string) => void
  reason: ModificationReason; setReason: (r: ModificationReason) => void
  allergies: string[]
  onToggle: () => void; onClaim: () => void; onRelease: () => void; onReady: () => void
  onOpenCollect: () => void; onConfirmCollect: () => void; onCancelCollect: () => void
  onStep: (m: PharmacyMedicine, delta: number) => void
  onApproveOverride: (m: PharmacyMedicine) => void
  onOrder: (m: PharmacyMedicine) => void; onAdviseOutside: (m: PharmacyMedicine) => void
  substitutingMed: string | null
  onStartSubstitute: (m: PharmacyMedicine) => void
  onCancelSubstitute: () => void
  getSubstitutes: (name: string) => string[]
  onSubstitute: (originalName: string, newName: string) => void
}) {
  const { rx, me, expanded, collecting, allergies } = props
  const src = srcOf(rx)
  const oos = outOfStockCount(rx)
  const mine = rx.assignedTo?.id === me.id
  const warnings = useMemo(() => checkRx(rx.medicines.map(m => m.name), { allergies }), [rx.medicines, allergies])
  const blocking = warnings.some(w => w.type === "allergy" || w.severity === "major")
  const ward = ["IPD", "ICU", "OT"].includes(src)

  return (
    <div className="rounded-xl bg-white ring-1 ring-slate-200/70 overflow-hidden">
      {/* Collapsed row */}
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <span className={cn("flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg ring-1", SOURCE_STYLE[src])}>{src}</span>

        <button onClick={props.onToggle} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 truncate">{rx.patientName}</span>
            {rx.tokenNumber > 0 && <span className="text-[11px] font-bold text-slate-400">#{rx.tokenNumber}</span>}
            {rx.wardBed && <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-0.5"><Bed className="h-3 w-3" />{rx.wardBed}</span>}
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize", STATUS_STYLE[rx.status])}>{rx.status}</span>
            {oos > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 flex items-center gap-0.5"><PackageX className="h-3 w-3" />{oos} not in stock</span>}
            {blocking && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 flex items-center gap-0.5"><ShieldAlert className="h-3 w-3" />safety</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            <Stethoscope className="h-3 w-3 inline -mt-0.5 mr-0.5" />{rx.doctorName} · {rx.department} · {rx.medicines.length} item{rx.medicines.length > 1 ? "s" : ""}
            {rx.assignedTo && <span className="text-slate-400"> · {mine ? "your counter" : `on ${rx.assignedTo.name}`}</span>}
          </p>
        </button>

        <div className="hidden md:flex flex-col items-end flex-shrink-0 w-24">
          <span className="text-sm font-bold text-slate-800 flex items-center"><IndianRupee className="h-3.5 w-3.5" />{billOf(rx)}</span>
          <span className="text-[11px] font-semibold text-slate-400">{rx.paymentMode ?? "Cash"}</span>
        </div>

        {/* Status-driven primary action (hidden while collecting) */}
        {!collecting && (
          <div className="flex-shrink-0 flex items-center gap-2">
            {rx.status === "queued" && !rx.assignedTo && (
              <ActionBtn onClick={props.onClaim} tone="brand" icon={Hand}>Accept</ActionBtn>
            )}
            {rx.status === "queued" && rx.assignedTo && !mine && (
              <ActionBtn onClick={props.onClaim} tone="ghost" icon={UserCheck}>Take over</ActionBtn>
            )}
            {rx.status === "preparing" && (
              <ActionBtn onClick={props.onReady} tone="brand" icon={Package}>Mark ready</ActionBtn>
            )}
            {rx.status === "ready" && (
              <ActionBtn onClick={props.onOpenCollect} tone="brand" icon={CheckCircle}>Mark collected</ActionBtn>
            )}
            {rx.status === "collected" && (
              <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" />Collected</span>
            )}
            <button onClick={props.onToggle} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-400">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        )}

        {/* Inline collector picker */}
        {collecting && (
          <div className="flex-shrink-0 flex items-center gap-2 flex-wrap justify-end">
            <span className="text-xs font-semibold text-slate-500">Collected by:</span>
            {["Self (patient)", "Relative", "Ward nurse"].map(c => (
              <button key={c} onClick={() => props.setCollector(c)}
                className={cn("text-[11px] font-semibold px-2 py-1 rounded-lg cursor-pointer", props.collector === c ? "bg-[rgba(8,145,178,0.12)] text-[var(--color-primary)]" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{c}</button>
            ))}
            <input value={props.collector} onChange={e => props.setCollector(e.target.value)}
              className="w-32 px-2 py-1 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            <ActionBtn onClick={props.onConfirmCollect} tone="brand" icon={CheckCircle}>Confirm</ActionBtn>
            <button onClick={props.onCancelCollect} className="text-xs font-semibold text-slate-400 px-2 py-1.5 hover:text-slate-600 cursor-pointer">Cancel</button>
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
          {/* Collected audit */}
          {rx.status === "collected" && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
              <span><span className="text-slate-400">Dispensed by</span> <b>{rx.dispensedBy?.name ?? "—"}</b></span>
              <span><span className="text-slate-400">Collected by</span> <b>{rx.collectedBy ?? "—"}</b></span>
              <span><span className="text-slate-400">When</span> <b>{timeAgo(rx.collectedAt)}</b></span>
              <span><span className="text-slate-400">Payment</span> <b>{rx.paymentMode ?? "Cash"}</b></span>
            </div>
          )}

          {/* Reason selector (only while editable) */}
          {rx.status !== "collected" && (
            <div className="flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-500 font-semibold">Reason for quantity changes:</span>
              <Select value={props.reason} onChange={e => props.setReason(e.target.value as ModificationReason)}
                className="text-xs font-semibold rounded-lg border border-slate-200 bg-white px-2 py-1 cursor-pointer">
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </div>
          )}

          {/* Medicine lines */}
          <div className="space-y-2">
            {rx.medicines.map((m, i) => {
              const mod = rx.quantityModifications?.find(q => q.medicineName === m.name)
              const qty = qtyOf(rx, m)
              const editable = rx.status !== "collected" && rx.status !== "ready"
              const oosLine = m.inStock === false && m.supply !== "advised_outside"
              return (
                <div key={i} className="rounded-lg bg-white ring-1 ring-slate-200/70 p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        <Pill className="h-3.5 w-3.5 text-[var(--color-primary)]" />{m.name}
                        {m.inStock === false && m.supply === "pharmacy" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">OUT OF STOCK</span>}
                        {m.supply === "order_raised" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[rgba(8,145,178,0.12)] text-[var(--color-primary)]">PO RAISED</span>}
                        {m.supply === "advised_outside" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">BUY OUTSIDE</span>}
                        {m.substitutedFrom && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[rgba(8,145,178,0.12)] text-[var(--color-primary)] flex items-center gap-0.5"><Repeat className="h-2.5 w-2.5" />substituted ← {m.substitutedFrom}</span>}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{m.dosage} · {m.frequency} · {m.duration} · ₹{UNIT_PRICES[m.name] ?? 0}/unit</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {editable ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => props.onStep(m, -1)} disabled={qty <= 0}
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer"><Minus className="h-3.5 w-3.5" /></button>
                          <span className="w-10 text-center text-sm font-bold text-slate-900 tabular-nums">{qty}</span>
                          <button onClick={() => props.onStep(m, +1)} disabled={qty >= m.quantity}
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-slate-700">×{qty}</span>
                      )}
                      <span className="w-16 text-right text-sm font-bold text-slate-800 flex items-center justify-end"><IndianRupee className="h-3 w-3" />{qty * (UNIT_PRICES[m.name] ?? 0)}</span>
                    </div>
                  </div>

                  {mod && mod.adjustedQty !== mod.originalQty && (
                    <p className="text-[11px] text-slate-400 mt-1">Adjusted from {mod.originalQty} · {mod.reason}
                      {mod.requiresSupervisorOverride && !mod.supervisorApprovedBy && (
                        <button onClick={() => props.onApproveOverride(m)} className="ml-2 text-[11px] font-bold text-red-600 underline cursor-pointer">needs supervisor override — approve</button>
                      )}
                      {mod.supervisorApprovedBy && <span className="ml-2 text-green-600 font-semibold">override approved</span>}
                    </p>
                  )}

                  {/* Out-of-stock actions */}
                  {oosLine && rx.status !== "collected" && (() => {
                    const alts = props.getSubstitutes(m.name)
                    const picking = props.substitutingMed === m.name
                    if (picking) {
                      return (
                        <div className="mt-2 rounded-lg bg-[rgba(8,145,178,0.07)] ring-1 ring-blue-200 p-2">
                          <p className="text-[11px] font-bold text-[var(--color-primary)] flex items-center gap-1 mb-1.5"><Repeat className="h-3 w-3" />Substitute with an in-stock alternative:</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {alts.map(a => (
                              <button key={a} onClick={() => props.onSubstitute(m.name, a)}
                                className="text-[11px] font-bold text-[var(--color-primary)] bg-white hover:bg-[rgba(8,145,178,0.14)] ring-1 ring-blue-200 px-2.5 py-1 rounded-lg cursor-pointer">{a}</button>
                            ))}
                            <button onClick={props.onCancelSubstitute} className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 px-1.5 py-1 cursor-pointer flex items-center gap-0.5"><X className="h-3 w-3" />Cancel</button>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {alts.length > 0 && (
                          <button onClick={() => props.onStartSubstitute(m)} className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-primary)] bg-[rgba(8,145,178,0.07)] hover:bg-[rgba(8,145,178,0.14)] px-2.5 py-1 rounded-lg cursor-pointer"><Repeat className="h-3 w-3" />Substitute ({alts.length})</button>
                        )}
                        {m.supply !== "order_raised" && (
                          <button onClick={() => props.onOrder(m)} className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-primary)] bg-[rgba(8,145,178,0.07)] hover:bg-[rgba(8,145,178,0.14)] px-2.5 py-1 rounded-lg cursor-pointer"><ShoppingCart className="h-3 w-3" />Order from inventory manager</button>
                        )}
                        <button onClick={() => props.onAdviseOutside(m)} className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg cursor-pointer"><ExternalLink className="h-3 w-3" />Advise buy outside</button>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>

          {/* AI safety badge */}
          {warnings.length > 0 && (
            <div className={cn("rounded-lg border p-2.5", blocking ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50")}>
              <p className={cn("flex items-center gap-1.5 text-xs font-bold", blocking ? "text-red-700" : "text-amber-700")}><ShieldAlert className="h-3.5 w-3.5" />AI dispense check</p>
              {warnings.map((w, i) => <p key={i} className={cn("text-[11px] font-semibold mt-0.5", w.severity === "major" || w.type === "allergy" ? "text-red-600" : "text-amber-600")}>{w.title}: {w.note}</p>)}
            </div>
          )}

          {/* Secondary actions for active rows */}
          {rx.status !== "collected" && (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-slate-400">{ward ? "Notifies ward on ready" : "Notifies patient on ready"}</span>
              {rx.assignedTo?.id === me.id && rx.status === "preparing" && (
                <button onClick={props.onRelease} className="text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer ml-auto">Release to queue</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ActionBtn({ onClick, children, icon: Icon, tone }: { onClick: () => void; children: ReactNode; icon: ComponentType<{ className?: string }>; tone: "brand" | "ghost" }) {
  return (
    <button onClick={onClick}
      className={cn("flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-all whitespace-nowrap",
        tone === "ghost" && "text-slate-600 bg-slate-100 hover:bg-slate-200")}
      style={tone === "brand" ? { background: "linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))", color: "#fff", boxShadow: "0 2px 8px rgba(8,145,178,0.25)" } : undefined}>
      <Icon className="h-3.5 w-3.5" />{children}
    </button>
  )
}
