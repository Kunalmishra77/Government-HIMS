import { useAuthStore } from "@/store/useAuthStore"
import { usePatientStore, type Patient } from "@/store/usePatientStore"
import { usePatientProfileStore, type PatientProfile } from "@/store/usePatientProfileStore"

// Resolves the logged-in patient and their clinical profile for the patient
// portal. Centralises the "who is me" lookup that the dashboard cards share,
// falling back to the demo patient (Kiran Patil) when no user is resolved yet.

const DEMO_PATIENT_ID = "PT-20394"

export function usePatientMe(): { me: Patient | undefined; profile: PatientProfile | undefined } {
  const currentUser = useAuthStore((s) => s.currentUser)
  const patients = usePatientStore((s) => s.patients)
  const id = currentUser?.id ?? DEMO_PATIENT_ID
  const me = patients.find((p) => p.id === id) ?? patients.find((p) => p.id === DEMO_PATIENT_ID)
  const profile = usePatientProfileStore((s) => (me ? s.profiles[me.id] : undefined))
  return { me, profile }
}
