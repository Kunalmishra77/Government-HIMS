"use client"

/* Patient Profile — the primary identity card and the first thing the patient
 * sees on their portal home. Surfaces every essential identity, verification
 * and care-team detail at a glance: name, photo, UHID, ABHA, Aadhaar &
 * Ayushman status, blood group, age/gender, primary doctor & hospital, and the
 * emergency contact. Composes the OPD record (usePatientStore) with the
 * clinical profile (usePatientProfileStore) via the shared usePatientMe hook. */

import {
  BadgeCheck, ShieldCheck, ShieldAlert, Stethoscope, Building2, Phone,
  Droplet, IdCard, HeartPulse, MapPin, Languages,
} from "lucide-react"
import { usePatientMe } from "@/lib/usePatientMe"

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
}

function Field({ icon: Icon, label, value }: { icon: typeof IdCard; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3">
      <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-secondary-light text-white">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="t-overline text-foreground-lighter">{label}</p>
        <p className="t-body font-semibold text-foreground break-words">{value}</p>
      </div>
    </div>
  )
}

export function PatientProfileCard() {
  const { me, profile } = usePatientMe()
  if (!me) return null

  const abhaLinked = !!me.abhaId
  const ayushmanStatus = profile?.ayushmanCardStatus ?? "Not enrolled"
  const ayushmanActive = ayushmanStatus === "Active"

  return (
    <section className="hms-card-elevated overflow-hidden" aria-label="Patient profile">
      {/* Identity hero — distinctive teal band carrying the patient's name & photo. */}
      <div className="relative gradient-hero px-5 py-5 sm:px-6">
        <div className="flex items-center gap-4">
          {me.photoUrl ? (
            <span
              className="h-16 w-16 flex-shrink-0 rounded-2xl bg-cover bg-center ring-2 ring-white/30"
              style={{ backgroundImage: `url(${me.photoUrl})` }}
              role="img"
              aria-label={`${me.name} photo`}
            />
          ) : (
            <span className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-2xl bg-white/15 text-white ring-2 ring-white/25 t-h2">
              {initials(me.name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="t-h2 text-white truncate">{me.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="chip bg-white/15 text-white">{me.age} yrs · {me.gender}</span>
              <span className="chip bg-white/15 text-white inline-flex items-center gap-1">
                <Droplet className="h-3 w-3" aria-hidden="true" /> {me.bloodGroup}
              </span>
              <span className="chip bg-white/15 text-white inline-flex items-center gap-1">
                <IdCard className="h-3 w-3" aria-hidden="true" /> UHID {me.uhid ?? "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Verification badges — every signal carries icon + text (never colour alone). */}
      <div className="flex flex-wrap gap-2 border-b border-border bg-surface-sunken px-5 py-3 sm:px-6">
        <span className={me.aadhaarVerified ? "chip chip-success" : "chip chip-warning"}>
          {me.aadhaarVerified ? <BadgeCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          Aadhaar {me.aadhaarVerified ? "verified" : "pending"}
        </span>
        <span className={abhaLinked ? "chip chip-success" : "chip chip-warning"}>
          {abhaLinked ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          ABHA {abhaLinked ? "linked" : "not linked"}
        </span>
        <span className={ayushmanActive ? "chip chip-success" : "chip chip-warning"}>
          {ayushmanActive ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          Ayushman card · {ayushmanStatus}
        </span>
        <span className={profile?.ayushmanLinked ? "chip chip-success" : "chip chip-neutral"}>
          {profile?.ayushmanLinked ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          Ayushman {profile?.ayushmanLinked ? "linked" : "not linked"}
        </span>
      </div>

      {/* Identity & care-team grid — balanced 2×3 so the area fills evenly. */}
      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 [&>*]:bg-surface">
        <Field icon={HeartPulse} label="Blood group" value={me.bloodGroup} />
        <Field icon={Languages} label="Preferred language" value={profile?.preferredLanguage ?? "—"} />
        <Field icon={Stethoscope} label="Primary doctor" value={`${me.doctor} · ${me.department}`} />
        <Field icon={Building2} label="Primary hospital" value={profile?.primaryHospital ?? "—"} />
        <Field
          icon={MapPin}
          label="Location"
          value={[profile?.city, profile?.pincode].filter(Boolean).join(" · ") || profile?.address || "—"}
        />
        <Field
          icon={Phone}
          label="Emergency contact"
          value={
            profile?.emergencyName
              ? `${profile.emergencyName}${profile.emergencyRelation ? ` (${profile.emergencyRelation})` : ""} · ${profile.emergencyPhone ?? ""}`
              : "Not on file"
          }
        />
      </div>
    </section>
  )
}
