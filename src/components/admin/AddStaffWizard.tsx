"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, ArrowRight, ArrowLeft, Check, User, Briefcase, Shield,
  Mail, Phone, Calendar, IndianRupee, BadgeCheck,
} from "lucide-react"
import { useHRStore, DEFAULT_BRANCH, BRANCH_LABEL, type BranchId, type ContractType, type StaffMember } from "@/store/useHRStore"
import { useAuthStore } from "@/store/useAuthStore"
import { canDo } from "@/lib/permissions"
import type { Role } from "@/types/roles"
import { ALL_ROLES } from "@/types/roles"
import { PERMISSIONS_MATRIX } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { toast } from "sonner"

export interface AddStaffWizardProps {
  open: boolean
  onClose: () => void
  onCreated?: (staffId: string) => void
}

type Step = 1 | 2 | 3

type IdentityFields = {
  name: string
  email: string
  phone: string
  role: Role
  department: string
  designation: string
  branchId: BranchId
  joiningDate: string
  contractType: ContractType
}

type RoleSpecificFields = {
  // Doctor / clinical
  mciNumber?: string
  speciality?: string
  opdFee?: number
  onlineFee?: number
  consultationHours?: string
  // Nurse
  nursingCouncilNumber?: string
  blsExpiry?: string
  primaryWard?: string
  // Lab tech
  benchSpecializations?: string
  // Radiology
  aerbBadge?: string
  modalityCompetence?: string
  // Pharmacist
  pharmacistLicence?: string
  // Compensation
  monthlyRate?: number
  hourlyOTRate?: number
}

type AccessFields = {
  loginId: string
  sendInvite: boolean
}

const ROLE_DEPTS: Partial<Record<Role, string[]>> = {
  doctor:    ['General Medicine', 'Cardiology', 'Dermatology', 'Orthopaedics', 'Gynaecology', 'ENT', 'Ophthalmology', 'Paediatrics'],
  nurse:     ['General Ward', 'ICU', 'Cardiac Care', 'Maternity', 'Paediatrics', 'Emergency Room', 'OT'],
  emergency: ['Emergency Room'],
  ot:        ['Operation Theater'],
  radiology: ['Radiology'],
  lab:       ['Pathology', 'Microbiology'],
  pharmacy:  ['Pharmacy'],
  reception: ['Front Desk', 'OPD'],
  bed_manager: ['Admission Desk'],
  discharge: ['Discharge Desk'],
  billing:   ['Billing'],
  insurance: ['TPA Desk'],
  blood_bank: ['Blood Bank'],
  cssd:      ['CSSD'],
  dietary:   ['Dietary & Nutrition'],
  bmw:       ['Bio-Medical Waste'],
  mortuary:  ['Mortuary'],
  ambulance: ['Ambulance Services'],
  housekeeping: ['Housekeeping'],
  inventory: ['Procurement'],
  admin:     ['Administration'],
  quality:   ['Quality & Compliance'],
  audit_officer: ['Audit & Compliance'],
}

const DESIGNATIONS: Partial<Record<Role, string[]>> = {
  doctor: ['Consultant', 'Senior Consultant', 'Senior Resident', 'Junior Resident', 'Visiting Specialist'],
  nurse: ['Staff Nurse', 'Senior Staff Nurse', 'Nurse Manager', 'ICU Staff Nurse', 'Triage Nurse'],
  lab: ['Lab Technician', 'Senior Lab Technician', 'Microbiologist', 'Pathologist'],
  pharmacy: ['Pharmacist', 'Senior Pharmacist', 'Pharmacy Manager'],
  radiology: ['X-Ray Technologist', 'CT Technologist', 'MRI Technologist', 'Radiologist'],
}

const today = () => new Date().toISOString().split('T')[0]!

export function AddStaffWizard({ open, onClose, onCreated }: AddStaffWizardProps) {
  const currentUser = useAuthStore(s => s.currentUser)
  const addStaff = useHRStore(s => s.addStaff)
  const addCredential = useHRStore(s => s.addCredential)

  const [step, setStep] = useState<Step>(1)
  const [identity, setIdentity] = useState<IdentityFields>({
    name: '', email: '', phone: '',
    role: 'nurse', department: 'General Ward', designation: 'Staff Nurse',
    branchId: DEFAULT_BRANCH, joiningDate: today(), contractType: 'permanent',
  })
  const [specifics, setSpecifics] = useState<RoleSpecificFields>({})
  const [access, setAccess] = useState<AccessFields>({ loginId: '', sendInvite: true })

  const canSubmit = canDo(currentUser?.role, 'hr.staff.write')

  const depts = ROLE_DEPTS[identity.role] ?? [identity.department]
  const designations = DESIGNATIONS[identity.role] ?? []

  const previewPerms = useMemo(() => {
    const perms = PERMISSIONS_MATRIX[identity.role]
    return Array.from(perms).sort()
  }, [identity.role])

  const isIdentityValid = identity.name.trim().length > 1 && identity.email.includes('@') && identity.phone.trim().length >= 8
  const isAccessValid = access.loginId.trim().length > 1

  // Auto-generate login ID
  const suggestLoginId = () => {
    const first = identity.name.split(' ').filter(w => !/^dr\.?$/i.test(w))[0] ?? 'staff'
    const prefix = identity.role === 'doctor' ? 'DR'
      : identity.role === 'nurse' ? 'NR'
      : identity.role === 'lab' ? 'LB'
      : identity.role === 'pharmacy' ? 'PH'
      : identity.role.slice(0, 2).toUpperCase()
    return `${prefix}-${first.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`
  }

  const handleNext = () => {
    if (step === 1) {
      if (!isIdentityValid) { toast.error('Fill name, email, and phone to continue'); return }
      if (!access.loginId) setAccess({ ...access, loginId: suggestLoginId() })
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    }
  }
  const handleBack = () => setStep(s => Math.max(1, s - 1) as Step)

  const handleCreate = () => {
    if (!canSubmit) { toast.error("You don't have permission to add staff"); return }
    if (!isIdentityValid) { toast.error('Identity fields are incomplete'); return }
    if (!isAccessValid) { toast.error('Login ID is required'); return }

    const actorName = currentUser?.name ?? 'Administrator'

    const input: Omit<StaffMember, 'id' | 'employeeId'> = {
      name: identity.name.trim(),
      email: identity.email.trim().toLowerCase(),
      phone: identity.phone.trim(),
      role: identity.role,
      department: identity.department,
      designation: identity.designation,
      branchId: identity.branchId,
      joiningDate: identity.joiningDate,
      contractType: identity.contractType,
      status: 'active',
      credentials: [],
      monthlyRate: specifics.monthlyRate,
      hourlyOTRate: specifics.hourlyOTRate,
    }

    const id = addStaff(input, actorName)

    // Seed initial role-specific credential(s)
    const today2 = today()
    const oneYear = new Date(); oneYear.setFullYear(oneYear.getFullYear() + 1)
    const twoYears = new Date(); twoYears.setFullYear(twoYears.getFullYear() + 2)
    const isoNext = (d: Date) => d.toISOString().split('T')[0]!

    if (identity.role === 'doctor' && specifics.mciNumber) {
      addCredential(id, { type: 'MCI', label: 'Medical Council Reg.', number: specifics.mciNumber,
        issuedDate: identity.joiningDate, expiryDate: isoNext(twoYears) }, actorName)
    }
    if (identity.role === 'nurse' && specifics.nursingCouncilNumber) {
      addCredential(id, { type: 'Nursing Council', label: 'KNMC Reg.', number: specifics.nursingCouncilNumber,
        issuedDate: identity.joiningDate, expiryDate: isoNext(twoYears) }, actorName)
    }
    if (identity.role === 'nurse' && specifics.blsExpiry) {
      addCredential(id, { type: 'BLS', label: 'Basic Life Support', number: 'BLS-' + Date.now().toString().slice(-6),
        issuedDate: today2, expiryDate: specifics.blsExpiry }, actorName)
    }
    if (identity.role === 'radiology' && specifics.aerbBadge) {
      addCredential(id, { type: 'AERB', label: 'AERB Operator Badge', number: specifics.aerbBadge,
        issuedDate: identity.joiningDate, expiryDate: isoNext(twoYears) }, actorName)
    }
    if (identity.role === 'pharmacy' && specifics.pharmacistLicence) {
      addCredential(id, { type: 'Pharmacist', label: 'Karnataka Pharmacy Council', number: specifics.pharmacistLicence,
        issuedDate: identity.joiningDate, expiryDate: isoNext(twoYears) }, actorName)
    }

    // M11-A — wire the login-id persist + send-invite. Mock: store the
    // login ID and an invite-pending flag against the staff member's notes,
    // and fire a notification to the new hire (in-app + audit).
    if (access.loginId.trim()) {
      const noteLine = `Login ID: ${access.loginId.trim()}${access.sendInvite ? ' · invite pending' : ''}`
      useHRStore.getState().updateStaff(id, { notes: noteLine }, actorName)
      if (access.sendInvite) {
        notifyAndAudit({
          to: identity.role, type: 'system', priority: 'medium',
          title: `Welcome to Agentix HIMS · login created`,
          body: `${input.name} — your login ID is "${access.loginId.trim()}". Activation email sent to ${input.email}.`,
          audit: { action: 'hr_staff_created', resource: 'login_account', resourceId: id, detail: `Login ${access.loginId.trim()} provisioned · invite sent to ${input.email}`, userName: actorName },
        })
      }
    }
    toast.success(`${input.name} added · ${id}${access.sendInvite ? ' · invite sent' : ''}`)
    if (onCreated) onCreated(id)

    // Reset
    setStep(1)
    setIdentity({
      name: '', email: '', phone: '',
      role: 'nurse', department: 'General Ward', designation: 'Staff Nurse',
      branchId: DEFAULT_BRANCH, joiningDate: today2, contractType: 'permanent',
    })
    setSpecifics({})
    setAccess({ loginId: '', sendInvite: true })
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <User className="h-5 w-5 text-[var(--color-accent)]" />Add Staff Member
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Step {step} of 3 · {step === 1 ? 'Identity' : step === 2 ? 'Role-specific fields' : 'Access & permissions'}</p>
                </div>
                <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>

              {/* Step indicator */}
              <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                {[1, 2, 3].map(n => (
                  <div key={n} className="flex items-center gap-2 flex-1">
                    <span className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                      step === n ? 'bg-[var(--color-primary)] text-white'
                      : step > n ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500')}>
                      {step > n ? <Check className="h-3 w-3" /> : n}
                    </span>
                    {n < 3 && <div className={cn('h-0.5 flex-1', step > n ? 'bg-emerald-500' : 'bg-slate-200')} />}
                  </div>
                ))}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {step === 1 && (
                  <>
                    <Field label="Full name" icon={User} required>
                      <input value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })}
                        placeholder="e.g., Dr. Anjali Mehra" className={INPUT} autoFocus />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Email" icon={Mail} required>
                        <input type="email" value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })}
                          placeholder="anjali.mehra@agentix.in" className={INPUT} />
                      </Field>
                      <Field label="Phone" icon={Phone} required>
                        <input value={identity.phone} onChange={(e) => setIdentity({ ...identity, phone: e.target.value })}
                          placeholder="+91 98xxx xxxxx" className={INPUT} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Role" icon={Briefcase} required>
                        <Select value={identity.role} onChange={(e) => {
                          const role = e.target.value as Role
                          const newDept = (ROLE_DEPTS[role] ?? [identity.department])[0]!
                          const newDesignation = (DESIGNATIONS[role] ?? [])[0] ?? identity.designation
                          setIdentity({ ...identity, role, department: newDept, designation: newDesignation })
                        }} className={INPUT}>
                          {ALL_ROLES.filter(r => r !== 'patient').map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                        </Select>
                      </Field>
                      <Field label="Department" icon={Briefcase}>
                        <Select value={identity.department} onChange={(e) => setIdentity({ ...identity, department: e.target.value })} className={INPUT}>
                          {depts.map(d => <option key={d}>{d}</option>)}
                        </Select>
                      </Field>
                    </div>
                    <Field label="Designation" icon={Briefcase}>
                      {designations.length > 0 ? (
                        <Select value={identity.designation} onChange={(e) => setIdentity({ ...identity, designation: e.target.value })} className={INPUT}>
                          {designations.map(d => <option key={d}>{d}</option>)}
                        </Select>
                      ) : (
                        <input value={identity.designation} onChange={(e) => setIdentity({ ...identity, designation: e.target.value })}
                          placeholder="e.g., Senior Consultant" className={INPUT} />
                      )}
                    </Field>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Branch" icon={Briefcase}>
                        <Select value={identity.branchId} onChange={(e) => setIdentity({ ...identity, branchId: e.target.value as BranchId })} className={INPUT}>
                          {Object.entries(BRANCH_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                      </Field>
                      <Field label="Joining date" icon={Calendar}>
                        <input type="date" value={identity.joiningDate}
                          onChange={(e) => setIdentity({ ...identity, joiningDate: e.target.value })} className={INPUT} />
                      </Field>
                      <Field label="Contract" icon={Briefcase}>
                        <Select value={identity.contractType} onChange={(e) => setIdentity({ ...identity, contractType: e.target.value as ContractType })} className={INPUT}>
                          {['permanent', 'visiting', 'locum', 'intern', 'contract'].map(c => <option key={c}>{c}</option>)}
                        </Select>
                      </Field>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    {identity.role === 'doctor' && (
                      <>
                        <Field label="MCI / KMC Registration #" icon={BadgeCheck}>
                          <input value={specifics.mciNumber ?? ''} onChange={(e) => setSpecifics({ ...specifics, mciNumber: e.target.value })}
                            placeholder="KMC-2014-78321" className={INPUT} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Speciality" icon={Briefcase}>
                            <input value={specifics.speciality ?? ''} onChange={(e) => setSpecifics({ ...specifics, speciality: e.target.value })}
                              placeholder="e.g., Interventional Cardiology" className={INPUT} />
                          </Field>
                          <Field label="Consultation hours" icon={Calendar}>
                            <input value={specifics.consultationHours ?? ''} onChange={(e) => setSpecifics({ ...specifics, consultationHours: e.target.value })}
                              placeholder="09:00 – 17:00" className={INPUT} />
                          </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="OPD fee (₹)" icon={IndianRupee}>
                            <input type="number" value={specifics.opdFee ?? ''} onChange={(e) => setSpecifics({ ...specifics, opdFee: Number(e.target.value) })}
                              placeholder="600" className={INPUT} />
                          </Field>
                          <Field label="Online fee (₹)" icon={IndianRupee}>
                            <input type="number" value={specifics.onlineFee ?? ''} onChange={(e) => setSpecifics({ ...specifics, onlineFee: Number(e.target.value) })}
                              placeholder="500" className={INPUT} />
                          </Field>
                        </div>
                      </>
                    )}

                    {identity.role === 'nurse' && (
                      <>
                        <Field label="Nursing Council Registration #" icon={BadgeCheck}>
                          <input value={specifics.nursingCouncilNumber ?? ''}
                            onChange={(e) => setSpecifics({ ...specifics, nursingCouncilNumber: e.target.value })}
                            placeholder="KNMC-2018-08821" className={INPUT} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="BLS expiry" icon={Calendar}>
                            <input type="date" value={specifics.blsExpiry ?? ''}
                              onChange={(e) => setSpecifics({ ...specifics, blsExpiry: e.target.value })} className={INPUT} />
                          </Field>
                          <Field label="Primary ward" icon={Briefcase}>
                            <input value={specifics.primaryWard ?? ''}
                              onChange={(e) => setSpecifics({ ...specifics, primaryWard: e.target.value })}
                              placeholder="e.g., ICU" className={INPUT} />
                          </Field>
                        </div>
                      </>
                    )}

                    {identity.role === 'lab' && (
                      <Field label="Bench specializations" icon={Briefcase}>
                        <input value={specifics.benchSpecializations ?? ''}
                          onChange={(e) => setSpecifics({ ...specifics, benchSpecializations: e.target.value })}
                          placeholder="e.g., HEMA, BIOCHEM" className={INPUT} />
                      </Field>
                    )}

                    {identity.role === 'radiology' && (
                      <>
                        <Field label="AERB Badge #" icon={BadgeCheck}>
                          <input value={specifics.aerbBadge ?? ''}
                            onChange={(e) => setSpecifics({ ...specifics, aerbBadge: e.target.value })}
                            placeholder="AERB-RAD-2024-1102" className={INPUT} />
                        </Field>
                        <Field label="Modality competence" icon={Briefcase}>
                          <input value={specifics.modalityCompetence ?? ''}
                            onChange={(e) => setSpecifics({ ...specifics, modalityCompetence: e.target.value })}
                            placeholder="e.g., X-Ray, CT, MRI" className={INPUT} />
                        </Field>
                      </>
                    )}

                    {identity.role === 'pharmacy' && (
                      <Field label="Pharmacist licence #" icon={BadgeCheck}>
                        <input value={specifics.pharmacistLicence ?? ''}
                          onChange={(e) => setSpecifics({ ...specifics, pharmacistLicence: e.target.value })}
                          placeholder="KPC-2015-44218" className={INPUT} />
                      </Field>
                    )}

                    {/* Universal: compensation */}
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Compensation (optional)</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Monthly rate (₹)" icon={IndianRupee}>
                          <input type="number" value={specifics.monthlyRate ?? ''}
                            onChange={(e) => setSpecifics({ ...specifics, monthlyRate: Number(e.target.value) })}
                            placeholder="e.g., 45000" className={INPUT} />
                        </Field>
                        <Field label="OT rate (₹/hr)" icon={IndianRupee}>
                          <input type="number" value={specifics.hourlyOTRate ?? ''}
                            onChange={(e) => setSpecifics({ ...specifics, hourlyOTRate: Number(e.target.value) })}
                            placeholder="e.g., 350" className={INPUT} />
                        </Field>
                      </div>
                    </div>

                    {!(['doctor', 'nurse', 'lab', 'radiology', 'pharmacy'] as Role[]).includes(identity.role) && (
                      <p className="text-xs text-slate-400 italic">
                        No role-specific fields for <b>{identity.role.replace('_', ' ')}</b>. Compensation only.
                      </p>
                    )}
                  </>
                )}

                {step === 3 && (
                  <>
                    <div className="rounded-xl border border-primary/20 bg-[rgba(238,107,38,0.07)]/30 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-accent)] mb-2">Login & access</p>
                      <Field label="Login ID" icon={Shield} required>
                        <div className="flex items-center gap-2">
                          <input value={access.loginId} onChange={(e) => setAccess({ ...access, loginId: e.target.value })}
                            className={INPUT} />
                          <button type="button"
                            onClick={() => setAccess({ ...access, loginId: suggestLoginId() })}
                            className="text-[11px] font-bold text-[var(--color-accent)] hover:underline cursor-pointer whitespace-nowrap">Suggest</button>
                        </div>
                      </Field>
                      <label className="flex items-center gap-2 mt-3 cursor-pointer">
                        <input type="checkbox" checked={access.sendInvite}
                          onChange={(e) => setAccess({ ...access, sendInvite: e.target.checked })} />
                        <span className="text-[12px] text-slate-700">Send invite email to <b>{identity.email || '—'}</b></span>
                      </label>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Permissions preview · role {identity.role}</p>
                      <div className="flex flex-wrap gap-1">
                        {previewPerms.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No permissions for this role.</p>
                        ) : previewPerms.map(p => (
                          <span key={p} className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{p}</span>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2">
                        Permissions are derived from <code>src/lib/permissions.ts</code> — edit there to change defaults.
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-2">Summary</p>
                      <ul className="text-xs text-slate-700 space-y-1">
                        <li><b>{identity.name}</b> · {identity.designation}</li>
                        <li>{identity.role.replace('_', ' ')} · {identity.department} · {BRANCH_LABEL[identity.branchId]}</li>
                        <li>{identity.email} · {identity.phone}</li>
                        <li>Joining {identity.joiningDate} · {identity.contractType}</li>
                        {specifics.monthlyRate ? <li>Monthly rate ₹{specifics.monthlyRate.toLocaleString('en-IN')}</li> : null}
                      </ul>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2 justify-between bg-slate-50/30">
                <div>
                  {step > 1 && (
                    <button onClick={handleBack}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
                      <ArrowLeft className="h-3.5 w-3.5" />Back
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={onClose}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
                  {step < 3 ? (
                    <button onClick={handleNext} disabled={step === 1 && !isIdentityValid}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      Next<ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button onClick={handleCreate} disabled={!canSubmit || !isAccessValid}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      <Check className="h-3.5 w-3.5" />Create staff
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────
const INPUT = 'w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary'

function Field({ label, icon: Icon, required, children }: { label: string; icon: React.ElementType; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1">
        <Icon className="h-3 w-3" />{label}
        {required && <span className="text-red-500">*</span>}
      </p>
      {children}
    </div>
  )
}
