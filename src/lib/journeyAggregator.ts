// M13.0 — Cross-store patient journey aggregator.
//
// Hospitals run on traceability — every department needs to know what
// happened to a patient before they arrived and what comes next. This file
// stitches together events from the seven major department stores
// (reception, ER, lab, radiology, OT, inpatient, discharge, billing,
// insurance) into a single time-ordered timeline keyed by patientId.
//
// Pure function: takes Zustand state snapshots, returns a JourneyEvent[].
// Called by PatientJourneyTimeline (drawer, /journey/[id] page).

import { usePatientStore } from "@/store/usePatientStore"
import { useERStore } from "@/store/useERStore"
import { useLabOrdersStore } from "@/store/useLabOrdersStore"
import { useRadiologyStudiesStore } from "@/store/useRadiologyStudiesStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useOTStore } from "@/store/useOTStore"
import { useDischargeStore } from "@/store/useDischargeStore"
import { useBillingStore } from "@/store/useBillingStore"
import { useInsuranceStore } from "@/store/useInsuranceStore"

export type Department =
  | 'Reception' | 'Emergency' | 'Nursing' | 'Doctor'
  | 'Lab' | 'Radiology' | 'Pharmacy' | 'OT' | 'IPD'
  | 'Discharge' | 'Billing' | 'Insurance'

export type EventSeverity = 'info' | 'success' | 'warning' | 'critical'

export interface JourneyEvent {
  at: string                   // ISO timestamp
  dept: Department
  title: string                // one-line headline
  detail?: string              // body text
  actor?: string               // who did it
  severity: EventSeverity
  resourceId?: string          // link back to source (orderId, studyId, etc.)
}

// ── Helpers ───────────────────────────────────────────────────────────────

const fmtTimeStr = (iso: string): string => {
  try {
    return new Date(iso).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

// ── Per-store collectors ──────────────────────────────────────────────────

function fromReception(patientId: string, patientName: string): JourneyEvent[] {
  const out: JourneyEvent[] = []
  const p = usePatientStore.getState().patients.find(x => x.id === patientId)
  if (!p) return out
  // Registration event — derived from registeredDate + registeredAt.
  if (p.registeredDate) {
    out.push({
      at: `${p.registeredDate}T${parseTimeOfDay(p.registeredAt)}:00.000Z`,
      dept: 'Reception',
      title: `Registered · Token #${p.token} · ${p.department}`,
      detail: `${patientName} registered as ${p.queueStatus === 'done' ? 'OPD (completed)' : 'OPD visit'} with Dr. ${stripDr(p.doctor)}. ${p.symptoms.length ? `Chief complaint: ${p.symptoms.join(', ')}.` : ''}`,
      actor: 'Front desk',
      severity: 'info',
      resourceId: p.id,
    })
  }
  // Vitals captured?
  if (p.vitals && p.vitals.bp !== '—') {
    out.push({
      at: `${p.registeredDate ?? new Date().toISOString().slice(0, 10)}T${parseTimeOfDay(p.registeredAt)}:30.000Z`,
      dept: 'Nursing',
      title: 'OPD vitals recorded',
      detail: `BP ${p.vitals.bp} · SpO₂ ${p.vitals.spo2} · Pulse ${p.vitals.pulse} · Temp ${p.vitals.temp}`,
      severity: p.triageFlag?.band === 'high' ? 'warning' : 'info',
    })
  }
  return out
}

function fromER(patientId: string): JourneyEvent[] {
  const out: JourneyEvent[] = []
  const ep = useERStore.getState().patients.find(x => x.patientId === patientId)
  if (!ep) return out
  out.push({
    at: ep.arrivedAt, dept: 'Emergency',
    title: `ER arrival · ${ep.arrival === 'ambulance' ? '108 ambulance' : ep.arrival === 'transfer' ? 'Transfer-in' : 'Walk-in'}`,
    detail: ep.chiefComplaint + (ep.trauma ? ' · Trauma case' : ''),
    severity: 'warning',
  })
  if (ep.triagedAt) {
    out.push({
      at: ep.triagedAt, dept: 'Emergency',
      title: `Triaged ESI ${ep.esi}${ep.area ? ` · ${ep.area}` : ''}`,
      detail: ep.esiReason,
      severity: (ep.esi === 1 || ep.esi === 2) ? 'critical' : 'warning',
    })
  }
  if (ep.doctorClaimAt && ep.assignedTo) {
    out.push({
      at: ep.doctorClaimAt, dept: 'Emergency',
      title: `Claimed by ${ep.assignedTo.name}${ep.bedNumber ? ` · ${ep.bedNumber}` : ''}`,
      severity: 'info', actor: ep.assignedTo.name,
    })
  }
  for (const v of ep.vitalsHistory) {
    out.push({
      at: v.at, dept: 'Emergency',
      title: 'ER vitals',
      detail: `HR ${v.hr} · BP ${v.sbp} · SpO₂ ${v.spo2}% · RR ${v.rr} · Temp ${v.temp}°C · GCS ${v.gcs}${v.onOxygen ? ' · O₂' : ''}`,
      actor: v.by, severity: 'info',
    })
  }
  if (ep.decisionAt && ep.disposition) {
    const sev: EventSeverity =
      ep.disposition === 'deceased' ? 'critical' :
      ep.disposition === 'against_medical_advice' ? 'warning' :
      ep.disposition.startsWith('admit') ? 'warning' : 'success'
    const label =
      ep.disposition === 'admit_ward' ? 'Admit to ward' :
      ep.disposition === 'admit_icu' ? 'Admit to ICU' :
      ep.disposition === 'admit_hdu' ? 'Admit to HDU' :
      ep.disposition === 'discharge' ? 'Discharge from ER' :
      ep.disposition === 'transfer' ? 'Transfer out' :
      ep.disposition === 'deceased' ? 'Deceased in ER' : 'AMA / DAMA'
    out.push({
      at: ep.decisionAt, dept: 'Emergency',
      title: `Disposition · ${label}`,
      detail: ep.dispositionNote, severity: sev,
    })
  }
  return out
}

function fromLab(patientId: string): JourneyEvent[] {
  const out: JourneyEvent[] = []
  for (const o of useLabOrdersStore.getState().orders) {
    if (o.patientId !== patientId) continue
    out.push({
      at: o.orderedAt, dept: 'Lab',
      title: `Lab ordered · ${o.tests.length} test${o.tests.length !== 1 ? 's' : ''} (${o.source})`,
      detail: o.tests.map(t => t.name).join(' · '),
      actor: o.doctorName, severity: 'info', resourceId: o.id,
    })
    for (const sp of o.specimens) {
      if (sp.collectedAt) {
        out.push({
          at: sp.collectedAt, dept: 'Lab',
          title: `Specimen collected · ${sp.type}`,
          detail: `Accession ${sp.accession} · ${sp.container}`,
          actor: sp.collectedBy, severity: 'info',
        })
      }
      if (sp.rejectReason) {
        out.push({
          at: sp.collectedAt ?? o.orderedAt, dept: 'Lab',
          title: `Specimen rejected · ${sp.rejectReason}`,
          detail: `Accession ${sp.accession} — recollect required`,
          severity: 'warning',
        })
      }
    }
    for (const t of o.tests) {
      if (t.releasedAt) {
        const crit = t.analytes.some(a => a.flag === 'CH' || a.flag === 'CL')
        const abn = t.analytes.filter(a => a.flag !== 'N')
        out.push({
          at: t.releasedAt, dept: 'Lab',
          title: `${t.name} released${crit ? ' · CRITICAL' : ''}`,
          detail: abn.length ? abn.map(a => `${a.analyte} ${a.value} ${a.unit} ${a.flag}`).join(' · ') : 'Within reference range',
          actor: t.verifiedBy?.name, severity: crit ? 'critical' : abn.length ? 'warning' : 'success',
          resourceId: t.id,
        })
      }
    }
  }
  return out
}

function fromRadiology(patientId: string): JourneyEvent[] {
  const out: JourneyEvent[] = []
  for (const s of useRadiologyStudiesStore.getState().studies) {
    if (s.patientId !== patientId) continue
    out.push({
      at: s.orderedAt, dept: 'Radiology',
      title: `Imaging ordered · ${s.modality} ${s.name}`,
      detail: `${s.priority} priority · TAT ${s.expectedTATmin}m`,
      actor: s.doctorName, severity: 'info', resourceId: s.id,
    })
    if (s.acquiredAt) {
      out.push({
        at: s.acquiredAt, dept: 'Radiology',
        title: `Study acquired · ${s.modality}`, severity: 'info',
      })
    }
    if (s.reportedAt) {
      out.push({
        at: s.reportedAt, dept: 'Radiology',
        title: `Report drafted · ${s.name}`,
        actor: s.readingBy?.name, severity: 'info',
      })
    }
    if (s.verifiedAt) {
      const impressionTxt = s.reportSections.impression ?? ''
      const isCrit = /\b(haemorrhage|hemorrhage|bleed|pneumothorax|tamponade|stroke|infarct|free air|pe\b|pulmonary embolism)\b/i.test(impressionTxt)
      out.push({
        at: s.verifiedAt, dept: 'Radiology',
        title: `Report verified${isCrit ? ' · CRITICAL' : ''}`,
        detail: impressionTxt.slice(0, 200), actor: s.verifiedBy?.name,
        severity: isCrit ? 'critical' : 'success',
      })
    }
  }
  return out
}

function fromIPD(patientId: string): JourneyEvent[] {
  const out: JourneyEvent[] = []
  const ip = useInpatientStore.getState().inpatients.find(x => x.patientId === patientId)
  if (!ip) return out
  for (const ev of ip.events) {
    const sev: EventSeverity =
      ev.severity === 'critical' ? 'critical' :
      ev.severity === 'warning' ? 'warning' :
      ev.severity === 'success' ? 'success' : 'info'
    out.push({
      at: ev.at, dept: 'IPD',
      title: ev.title, detail: ev.detail, actor: ev.actor, severity: sev,
    })
  }
  return out
}

function fromOT(patientId: string): JourneyEvent[] {
  const out: JourneyEvent[] = []
  for (const proc of useOTStore.getState().procedures) {
    if (proc.patientId !== patientId) continue
    out.push({
      at: new Date().toISOString().slice(0, 10) + 'T' + proc.scheduledTime + ':00.000Z',
      dept: 'OT',
      title: `OT booked · ${proc.procedureName}`,
      detail: `${proc.otRoom} · Surgeon ${proc.surgeon} · Anaes ${proc.anaesthetist} · ${proc.durationMinutes}min`,
      severity: 'info', resourceId: proc.id,
    })
    if (proc.startedAt) {
      out.push({
        at: proc.startedAt, dept: 'OT',
        title: 'Surgery started · WHO Time-Out complete',
        severity: 'warning',
      })
    }
    if (proc.completedAt) {
      out.push({
        at: proc.completedAt, dept: 'OT',
        title: 'Surgery completed · WHO Sign-Out',
        severity: 'success',
      })
    }
  }
  return out
}

function fromDischarge(patientId: string): JourneyEvent[] {
  const out: JourneyEvent[] = []
  const d = useDischargeStore.getState().dischargeQueue.find(x => x.patientId === patientId)
  if (!d) return out
  out.push({
    at: d.admittedOn, dept: 'Discharge',
    title: 'Discharge initiated',
    detail: `Owner: ${d.attendingDoctor} · Expected ${new Date(d.expectedDischarge).toLocaleDateString('en-IN')}`,
    severity: 'info',
  })
  const cleared = Object.entries(d.clearances).filter(([, s]) => s === 'cleared').map(([k]) => k)
  const pending = Object.entries(d.clearances).filter(([, s]) => s === 'pending').map(([k]) => k)
  if (cleared.length > 0) {
    out.push({
      at: d.admittedOn, dept: 'Discharge',
      title: `${cleared.length} pillar${cleared.length !== 1 ? 's' : ''} cleared`,
      detail: cleared.join(' · '),
      severity: 'success',
    })
  }
  for (const b of d.blockers) {
    out.push({
      at: d.admittedOn, dept: 'Discharge',
      title: `Blocker · ${b.type}`,
      detail: `${b.description} (owner: ${b.owner})`,
      severity: 'warning',
    })
  }
  if (pending.length > 0 && d.blockers.length === 0) {
    out.push({
      at: d.admittedOn, dept: 'Discharge',
      title: `${pending.length} pillar${pending.length !== 1 ? 's' : ''} pending`,
      detail: pending.join(' · '),
      severity: 'info',
    })
  }
  if (d.exitClearanceIssued) {
    out.push({
      at: d.expectedDischarge, dept: 'Discharge',
      title: 'Exit clearance issued · patient may leave',
      severity: 'success',
    })
  }
  return out
}

function fromBilling(patientId: string): JourneyEvent[] {
  const out: JourneyEvent[] = []
  const b = useBillingStore.getState().bills.find(x => x.patientId === patientId)
  if (!b) return out
  if (b.status === 'frozen' || b.status === 'settled') {
    out.push({
      at: new Date().toISOString(), dept: 'Billing',
      title: b.status === 'settled' ? `Bill settled · ₹${b.paidAmount.toLocaleString('en-IN')}` : `Bill frozen · ₹${b.subtotal.toLocaleString('en-IN')}`,
      detail: `${b.visitType} · ${b.payerType}`,
      severity: b.status === 'settled' ? 'success' : 'info',
    })
  }
  return out
}

function fromInsurance(patientId: string): JourneyEvent[] {
  const out: JourneyEvent[] = []
  for (const c of useInsuranceStore.getState().claims) {
    if (c.patientId !== patientId) continue
    out.push({
      at: new Date().toISOString(), dept: 'Insurance',
      title: `Claim ${c.status} · ${c.provider}`,
      detail: `${c.id} · ₹${c.amount.toLocaleString('en-IN')}${c.tpaReferenceId ? ` · TPA ${c.tpaReferenceId}` : ''}`,
      severity: c.status === 'Approved' ? 'success' : c.status === 'Rejected' ? 'warning' : 'info',
      resourceId: c.id,
    })
  }
  return out
}

// ── Helpers ───────────────────────────────────────────────────────────────

function parseTimeOfDay(s: string): string {
  // Accept "09:30 AM" or "9:30 AM" or "09:30" — return "HH:MM" in 24h.
  if (!s) return '09:00'
  const m = s.match(/(\d{1,2}):(\d{2})(?:\s*([AaPp])[Mm]?)?/)
  if (!m) return '09:00'
  let h = parseInt(m[1]!, 10)
  const min = m[2]!
  const ap = m[3]?.toLowerCase()
  if (ap === 'p' && h < 12) h += 12
  if (ap === 'a' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${min}`
}

function stripDr(s: string): string {
  return s.replace(/^Dr\.?\s+/i, '')
}

// ── Public API ────────────────────────────────────────────────────────────

/** Aggregate every department's events for a given patient, sorted chronologically. */
export function aggregateJourney(patientId: string, patientName: string): JourneyEvent[] {
  const all: JourneyEvent[] = [
    ...fromReception(patientId, patientName),
    ...fromER(patientId),
    ...fromLab(patientId),
    ...fromRadiology(patientId),
    ...fromIPD(patientId),
    ...fromOT(patientId),
    ...fromDischarge(patientId),
    ...fromBilling(patientId),
    ...fromInsurance(patientId),
  ]
  return all
    .map(e => ({ ...e, at: fmtTimeStr(e.at) }))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

export const DEPT_COLOR: Record<Department, string> = {
  Reception: '#0EA5E9',  // sky
  Emergency: '#DC2626',  // red
  Nursing:   '#10B981',  // emerald
  Doctor:    '#7C3AED',  // violet
  Lab:       '#F59E0B',  // amber
  Radiology: '#9333EA',  // purple
  Pharmacy:  '#EC4899',  // pink
  OT:        '#1976E6',  // blue
  IPD:       '#EE6B26',  // brand orange
  Discharge: '#059669',  // green
  Billing:   '#EAB308',  // yellow
  Insurance: '#64748B',  // slate
}
