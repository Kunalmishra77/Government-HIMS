"use client"

import { useState, useEffect } from "react"
import { Droplet, AlertTriangle, HeartPulse, Phone, Pill, ShieldCheck, MapPin, Activity, UserCheck, Pencil, X, Plus, Upload, FileText, Check } from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import { usePatientStore } from "@/store/usePatientStore"
import { usePatientProfileStore, type PatientProfile } from "@/store/usePatientProfileStore"
import { toast } from "sonner"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { uploadFile, type UploadResult } from "@/lib/fileIO"

function Card({ title, icon: Icon, children, action }: { title: string; icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2 flex-1"><Icon className="h-4.5 w-4.5 text-slate-400" /> {title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}
const line = (xs: (string | undefined)[]) => xs.filter(Boolean).join(" · ")

function ChipList({ values, onChange, disabled, placeholder }: { values: string[]; onChange: (next: string[]) => void; disabled?: boolean; placeholder: string }) {
  const [draft, setDraft] = useState('')
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.length === 0 ? <span className="text-[12px] text-slate-400 italic">None</span> : values.map((v, i) => (
          <span key={v + i} className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
            {v}
            {!disabled && (
              <button onClick={() => onChange(values.filter((_, j) => j !== i))} aria-label="Remove" className="text-slate-400 hover:text-rose-600">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <input value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { onChange([...values, draft.trim()]); setDraft('') } }}
            placeholder={placeholder}
            className="flex-1 h-8 px-2 rounded-md ring-1 ring-slate-200 text-[12.5px] focus:outline-none focus:ring-[var(--color-primary-light)]" />
          <button onClick={() => { if (draft.trim()) { onChange([...values, draft.trim()]); setDraft('') } }}
            className="h-8 w-8 rounded-md bg-[var(--color-primary)] text-white flex items-center justify-center hover:bg-[var(--color-primary-dark)] cursor-pointer">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const currentUser = useAuthStore(s => s.currentUser)
  const id = currentUser?.role === "patient" ? currentUser.id : "PT-20394"
  const profile = usePatientProfileStore(s => s.profiles[id])
  const saveProfile = usePatientProfileStore(s => s.saveProfile)
  const patient = usePatientStore(s => s.patients.find(p => p.id === id))
  const name = currentUser?.name ?? patient?.name ?? "Patient"
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<PatientProfile | null>(null)
  const [uploads, setUploads] = useState<UploadResult[]>([])

  // Initialise draft when entering edit mode.
  useEffect(() => { if (editing && profile && !draft) setDraft({ ...profile, allergies: [...profile.allergies], chronicConditions: [...profile.chronicConditions], currentMedications: [...profile.currentMedications] }) }, [editing, profile, draft])

  function startEdit() { if (profile) { setDraft({ ...profile, allergies: [...profile.allergies], chronicConditions: [...profile.chronicConditions], currentMedications: [...profile.currentMedications] }); setEditing(true) } }
  function cancel() { setEditing(false); setDraft(null) }
  function save() {
    if (!draft) return
    saveProfile(id, draft, 'Self · patient portal')
    notifyAndAudit({
      to: 'doctor', type: 'system', priority: 'low',
      title: `Profile updated · ${name}`,
      body: `${name} updated their clinical profile (allergies / meds / contact). Review on next visit.`,
      patientName: name,
      audit: { action: 'hitl_modify', resource: 'patient_profile', resourceId: id, detail: `Patient self-edited profile`, userName: name },
    })
    toast.success('Profile saved · your team is notified')
    setEditing(false); setDraft(null)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const r = await uploadFile(f)
    setUploads(u => [r, ...u])
    notifyAndAudit({
      to: 'reception', type: 'system', priority: 'low',
      title: `Document uploaded · ${name}`,
      body: `${name} uploaded "${r.filename}". Available in their record.`,
      patientName: name,
      audit: { action: 'insurance_doc_upload', resource: 'patient_document', resourceId: r.id, detail: `Patient uploaded ${r.filename}`, userName: name },
    })
    toast.success(`Uploaded ${r.filename}`)
    e.currentTarget.value = ''
  }

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Profile &amp; Privacy</h1>
          <p className="text-[13px] text-slate-500 mt-1">Your details, medical info, family &amp; data consent</p>
        </div>
        {profile?.completedAt && !editing && (
          <button onClick={startEdit} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[12.5px] font-semibold cursor-pointer">
            <Pencil className="h-3.5 w-3.5" /> Edit profile
          </button>
        )}
        {editing && (
          <div className="flex items-center gap-2">
            <button onClick={cancel} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-[12.5px] font-semibold cursor-pointer">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button onClick={save} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12.5px] font-semibold cursor-pointer">
              <Check className="h-3.5 w-3.5" /> Save changes
            </button>
          </div>
        )}
      </div>

      {/* Identity */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center text-white text-[20px] font-bold">{initials}</div>
        <div className="flex-1">
          <p className="text-[18px] font-bold text-slate-900">{name}</p>
          <p className="text-[13px] text-slate-500">{line([id, patient ? `${patient.age}y` : undefined, patient?.gender, profile?.abhaId ? `ABHA: ${profile.abhaId}` : undefined])}</p>
        </div>
        {profile?.completedAt && (
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1 flex items-center gap-1"><UserCheck className="h-3.5 w-3.5" /> Verified by nursing</span>
        )}
      </div>

      {!profile?.completedAt ? (
        <div className="rounded-3xl bg-amber-50 border border-amber-200 p-6 text-center">
          <Activity className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-[15px] font-bold text-amber-900">Your clinical profile isn&apos;t complete yet</p>
          <p className="text-[13px] text-amber-700 mt-1">The nursing team will complete it during your first vitals check. Only basic details were taken at registration to keep onboarding quick.</p>
        </div>
      ) : (
        <>
          {/* Medical info */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-1"><Droplet className="h-4 w-4 text-red-500" /><span className="text-[11px] font-bold uppercase tracking-wide">Blood group</span></div>
              <p className="text-[18px] font-bold text-slate-900">{profile.bloodGroup ?? "—"}</p>
            </div>
            <Card title="Allergies" icon={AlertTriangle}>
              {editing && draft ? (
                <ChipList values={draft.allergies} onChange={(v) => setDraft({ ...draft, allergies: v, noKnownAllergies: v.length === 0 })} placeholder="Type and press Enter" />
              ) : (
                <p className="text-[14px] font-semibold text-slate-900">{profile.noKnownAllergies ? "No known allergies" : (profile.allergies.join(", ") || "—")}</p>
              )}
            </Card>
            <Card title="Chronic conditions" icon={HeartPulse}>
              {editing && draft ? (
                <ChipList values={draft.chronicConditions} onChange={(v) => setDraft({ ...draft, chronicConditions: v })} placeholder="e.g. Hypertension" />
              ) : (
                <p className="text-[14px] font-semibold text-slate-900">{profile.chronicConditions.join(", ") || "—"}</p>
              )}
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Card title="Current medications" icon={Pill}>
              {editing && draft ? (
                <ChipList values={draft.currentMedications} onChange={(v) => setDraft({ ...draft, currentMedications: v })} placeholder="e.g. Metformin 500mg" />
              ) : profile.currentMedications.length ? (
                <div className="flex flex-wrap gap-1.5">{profile.currentMedications.map(m => <span key={m} className="text-[12px] font-semibold text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] px-2 py-0.5 rounded-full">{m}</span>)}</div>
              ) : <p className="text-[13px] text-slate-400">None recorded</p>}
            </Card>
            <Card title="Emergency contact" icon={Phone}>
              {editing && draft ? (
                <div className="space-y-1.5">
                  <input value={draft.emergencyName ?? ''} onChange={e => setDraft({ ...draft, emergencyName: e.target.value })} placeholder="Name" className="w-full h-8 px-2 rounded-md ring-1 ring-slate-200 text-[12.5px] focus:outline-none focus:ring-[var(--color-primary-light)]" />
                  <input value={draft.emergencyRelation ?? ''} onChange={e => setDraft({ ...draft, emergencyRelation: e.target.value })} placeholder="Relation" className="w-full h-8 px-2 rounded-md ring-1 ring-slate-200 text-[12.5px] focus:outline-none focus:ring-[var(--color-primary-light)]" />
                  <input value={draft.emergencyPhone ?? ''} onChange={e => setDraft({ ...draft, emergencyPhone: e.target.value })} placeholder="Phone" className="w-full h-8 px-2 rounded-md ring-1 ring-slate-200 text-[12.5px] focus:outline-none focus:ring-[var(--color-primary-light)]" />
                </div>
              ) : (
                <>
                  <p className="text-[14px] font-semibold text-slate-900">{profile.emergencyName ?? "—"} {profile.emergencyRelation ? <span className="text-slate-400 font-normal">· {profile.emergencyRelation}</span> : null}</p>
                  <p className="text-[13px] text-slate-500">{profile.emergencyPhone ?? ""}</p>
                </>
              )}
            </Card>
            <Card title="Contact & address" icon={MapPin}>
              {editing && draft ? (
                <div className="space-y-1.5">
                  <input value={draft.address ?? ''} onChange={e => setDraft({ ...draft, address: e.target.value })} placeholder="Address" className="w-full h-8 px-2 rounded-md ring-1 ring-slate-200 text-[12.5px] focus:outline-none focus:ring-[var(--color-primary-light)]" />
                  <div className="flex gap-1.5">
                    <input value={draft.city ?? ''} onChange={e => setDraft({ ...draft, city: e.target.value })} placeholder="City" className="flex-1 h-8 px-2 rounded-md ring-1 ring-slate-200 text-[12.5px] focus:outline-none focus:ring-[var(--color-primary-light)]" />
                    <input value={draft.pincode ?? ''} onChange={e => setDraft({ ...draft, pincode: e.target.value })} placeholder="Pincode" className="w-24 h-8 px-2 rounded-md ring-1 ring-slate-200 text-[12.5px] focus:outline-none focus:ring-[var(--color-primary-light)]" />
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[14px] text-slate-700">{line([profile.address, profile.city, profile.pincode])}</p>
                  <p className="text-[13px] text-slate-500 mt-1">{line([profile.preferredLanguage && `Language: ${profile.preferredLanguage}`, profile.occupation])}</p>
                </>
              )}
            </Card>
            <Card title="Lifestyle & measurements" icon={Activity}>
              <p className="text-[13px] text-slate-700">{line([profile.smoking && `Smoking: ${profile.smoking}`, profile.alcohol && `Alcohol: ${profile.alcohol}`, profile.pregnancy && profile.pregnancy !== "N/A" ? `Pregnancy: ${profile.pregnancy}` : undefined])}</p>
              <p className="text-[13px] text-slate-500 mt-1">{line([profile.heightCm ? `${profile.heightCm} cm` : undefined, profile.weightKg ? `${profile.weightKg} kg` : undefined])}</p>
            </Card>
          </div>

          {/* Consent */}
          <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5">
            <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2"><ShieldCheck className="h-4.5 w-4.5 text-[var(--color-accent)]" /> Data &amp; AI consent <span className="text-[11px] font-semibold text-slate-400">· DISHA</span></h3>
            <div className="space-y-2">
              {([
                ["consentRecords", "AI may read my records"],
                ["consentFamily", "Family live status tracking"],
                ["consentResearch", "Anonymised research use"],
              ] as const).map(([k, label]) => (
                <div key={k} className="flex items-center justify-between text-[14px]">
                  <span className="text-slate-700">{label}</span>
                  {editing && draft ? (
                    <button
                      onClick={() => setDraft({ ...draft, [k]: !draft[k] })}
                      className={`text-[12px] font-bold px-2 py-0.5 rounded-full cursor-pointer ${draft[k] ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                      {draft[k] ? "Allowed" : "Off"}
                    </button>
                  ) : (
                    <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${profile[k] ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{profile[k] ? "Allowed" : "Off"}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* My documents */}
          <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5">
            <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2"><FileText className="h-4.5 w-4.5 text-[var(--color-accent)]" /> My documents</h3>
            <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-slate-200 hover:bg-slate-50 cursor-pointer">
              <span className="h-9 w-9 rounded-full bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] flex items-center justify-center"><Upload className="h-4 w-4" /></span>
              <span className="flex-1">
                <span className="block text-[13px] font-semibold text-slate-800">Upload insurance card, ID proof, lab report…</span>
                <span className="block text-[11px] text-slate-500">PDF or image, max 5 MB. Available to your care team.</span>
              </span>
              <input type="file" className="hidden" accept="application/pdf,image/*" onChange={handleUpload} />
            </label>
            {uploads.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                {uploads.map((u) => (
                  <a key={u.id} href={u.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 hover:bg-slate-100">
                    <FileText className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                    <span className="flex-1 text-[12.5px] font-semibold text-slate-800 truncate">{u.filename}</span>
                    <span className="text-[10.5px] text-slate-400">{Math.round(u.size / 1024)} KB · {new Date(u.uploadedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
