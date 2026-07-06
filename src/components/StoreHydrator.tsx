"use client"

import { useEffect } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { getSupabaseClient } from "@/lib/supabase/client"
import { syncStoreAcrossTabs } from "@/lib/cross-tab-sync"
import { useMessagingStore } from "@/store/useMessagingStore"
import { useNotificationStore } from "@/store/useNotificationStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useDoctorProfileStore } from "@/store/useDoctorProfileStore"
import { useNursingStore } from "@/store/useNursingStore"
import { usePatientProfileStore } from "@/store/usePatientProfileStore"
import { useShiftStore } from "@/store/useShiftStore"
import { useHRStore } from "@/store/useHRStore"
import { useVendorStore } from "@/store/useVendorStore"
import { useStatutoryStore } from "@/store/useStatutoryStore"
import { useAuditStore } from "@/store/useAuditStore"

// Phase-1 Step-3: every clinical / operational / financial store now persists.
import { useAdmissionStore } from "@/store/useAdmissionStore"
import { useAmbulanceStore } from "@/store/useAmbulanceStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useBMWStore } from "@/store/useBMWStore"
import { useBillingStore } from "@/store/useBillingStore"
import { useBloodBankStore } from "@/store/useBloodBankStore"
import { useCSSDStore } from "@/store/useCSSDStore"
import { useConsultationStore } from "@/store/useConsultationStore"
import { useDietaryStore } from "@/store/useDietaryStore"
import { useHrmsStore } from "@/store/useHrmsStore"
import { useDischargeStore } from "@/store/useDischargeStore"
import { useDoctorStatsStore } from "@/store/useDoctorStatsStore"
import { useDrugMasterStore } from "@/store/useDrugMasterStore"
import { useERStore } from "@/store/useERStore"
import { useEmergencyStore } from "@/store/useEmergencyStore"
import { useFamilyTokenStore } from "@/store/useFamilyTokenStore"
import { useFeedbackStore } from "@/store/useFeedbackStore"
import { useFollowupStore } from "@/store/useFollowupStore"
import { useHousekeepingStore } from "@/store/useHousekeepingStore"
import { useInsuranceStore } from "@/store/useInsuranceStore"
import { useInventoryStore } from "@/store/useInventoryStore"
import { useJourneyStore } from "@/store/useJourneyStore"
import { useLabOrdersStore } from "@/store/useLabOrdersStore"
import { useLabQCStore } from "@/store/useLabQCStore"
import { useMortuaryStore } from "@/store/useMortuaryStore"
import { useNarcoticsStore } from "@/store/useNarcoticsStore"
import { useOTStore } from "@/store/useOTStore"
import { usePatientLiveStore } from "@/store/usePatientLiveStore"
import { usePatientOrdersStore } from "@/store/usePatientOrdersStore"
import { usePatientStore } from "@/store/usePatientStore"
import { usePharmacyInventoryStore } from "@/store/usePharmacyInventoryStore"
import { usePharmacyStore } from "@/store/usePharmacyStore"
import { useQualityStore } from "@/store/useQualityStore"
import { useRadiologyStudiesStore } from "@/store/useRadiologyStudiesStore"
import { useWardStore } from "@/store/useWardStore"
import { useWhatsAppStore } from "@/store/useWhatsAppStore"

// Persisted stores use `skipHydration: true` so server + first client render
// match. We rehydrate from localStorage post-mount.
//
// Phase-1: also bootstrap the mock API and bridge the audit store.
export function StoreHydrator() {
  useEffect(() => {
    // Pre-existing persisted stores (Phase 0).
    useMessagingStore.persist.rehydrate()
    useNotificationStore.persist.rehydrate()
    useInpatientStore.persist.rehydrate()
    useDoctorProfileStore.persist.rehydrate()
    useNursingStore.persist.rehydrate()
    usePatientProfileStore.persist.rehydrate()
    useShiftStore.persist.rehydrate()
    useHRStore.persist.rehydrate()
    useHrmsStore.persist.rehydrate()
    useVendorStore.persist.rehydrate()
    useStatutoryStore.persist.rehydrate()

    // Phase-1 Step-3 — newly persisted stores (collapses Lost-on-refresh).
    useAdmissionStore.persist.rehydrate()
    useAmbulanceStore.persist.rehydrate()
    useAuthStore.persist.rehydrate()
    useBMWStore.persist.rehydrate()
    useBillingStore.persist.rehydrate()
    useBloodBankStore.persist.rehydrate()
    useCSSDStore.persist.rehydrate()
    useConsultationStore.persist.rehydrate()
    useDietaryStore.persist.rehydrate()
    useDischargeStore.persist.rehydrate()
    useDoctorStatsStore.persist.rehydrate()
    useDrugMasterStore.persist.rehydrate()
    useERStore.persist.rehydrate()
    useEmergencyStore.persist.rehydrate()
    useFamilyTokenStore.persist.rehydrate()
    useFeedbackStore.persist.rehydrate()
    useFollowupStore.persist.rehydrate()
    useHousekeepingStore.persist.rehydrate()
    useInsuranceStore.persist.rehydrate()
    useInventoryStore.persist.rehydrate()
    useJourneyStore.persist.rehydrate()
    useLabOrdersStore.persist.rehydrate()
    useLabQCStore.persist.rehydrate()
    useMortuaryStore.persist.rehydrate()
    useNarcoticsStore.persist.rehydrate()
    useOTStore.persist.rehydrate()
    usePatientLiveStore.persist.rehydrate()
    usePatientOrdersStore.persist.rehydrate()
    usePatientStore.persist.rehydrate()
    usePharmacyInventoryStore.persist.rehydrate()
    usePharmacyStore.persist.rehydrate()
    useQualityStore.persist.rehydrate()
    useRadiologyStudiesStore.persist.rehydrate()
    useWardStore.persist.rehydrate()
    useWhatsAppStore.persist.rehydrate()

    // ── Live cross-tab real-time sync ──────────────────────────────────────
    // Each department runs in its own browser tab; an action in one tab (e.g.
    // Reception → Send to Vitals, Nurse → record vitals, Doctor → order labs)
    // is broadcast to every other tab so the next department's queue updates
    // instantly, with no page refresh. Only the shared clinical/workflow stores
    // are synced — per-user drafts (consultation notes, auth) stay tab-local.
    //
    // Set up AFTER the persist rehydrations above so a synced store already
    // holds its latest localStorage state before it starts broadcasting/
    // applying — otherwise a late async rehydrate could clobber a live update
    // just received from another tab.
    const syncCleanups = [
      syncStoreAcrossTabs(usePatientStore, 'patients'),
      syncStoreAcrossTabs(useLabOrdersStore, 'lab-orders'),
      syncStoreAcrossTabs(useRadiologyStudiesStore, 'radiology'),
      syncStoreAcrossTabs(usePharmacyStore, 'pharmacy'),
      syncStoreAcrossTabs(usePharmacyInventoryStore, 'pharmacy-inventory'),
      syncStoreAcrossTabs(useAdmissionStore, 'admission'),
      syncStoreAcrossTabs(useInpatientStore, 'inpatient'),
      syncStoreAcrossTabs(useNursingStore, 'nursing'),
    ]

    // ── Mock API boot + audit bridge + demo seed ─────────────────────────
    void (async () => {
      try {
        const { ensureSeeded, Audit, onAudit } = await import('@/lib/api')
        await ensureSeeded()
        const persisted = await Audit.recent(500)
        if (persisted.length > 0) {
          useAuditStore.getState().hydrate(persisted)
        }
        onAudit((entry) => useAuditStore.getState().push(entry))
        // Companion seed for legacy Zustand stores that the mock API doesn't
        // own (ER triage, OT procedure with WHO, Insurance claim with denial-
        // risk 0.72, Narcotics register, Drug Master Augmentin, Admission).
        // Idempotent — gated by a localStorage marker.
        const { seedAnilLegacyStores } = await import('@/lib/seed-legacy-stores')
        await seedAnilLegacyStores()
        // Family-tracking tokens for the seeded demo patients so their public
        // /p/<uhid> links open without first visiting an in-app share screen.
        const fam = useFamilyTokenStore.getState()
        if (!fam.get('PT-44012')) fam.issue('PT-44012', 'Anil Kumar Verma', { consent: true, issuedBy: 'seed' })
        if (!fam.get('PT-20394')) fam.issue('PT-20394', 'Kiran Patil', { consent: true, issuedBy: 'seed' })
      } catch (err) {
        console.error('[StoreHydrator] mock-API bootstrap failed:', err)
      }
    })()

    // ── Real-data bridge for useAdmissionStore / useInpatientStore ───────
    // Fixes the "gap" where only a handful of pages explicitly called
    // hydrateReal() on mount: most consumers of admissionRequests/inpatients
    // never triggered it, so real admitted-patient/admission-request rows
    // stayed invisible unless the user happened to land on one of those few
    // wired pages first. StoreHydrator mounts once per app session (root
    // layout), so calling both hydrateReal()s here closes the gap for every
    // current and future consumer, regardless of which page loads first.
    //
    // Both hydrateReal() implementations already no-op without a live
    // Supabase session AND are idempotent (they re-check current state at
    // commit time before appending), so calling them here is safe even
    // though a handful of pages (admission/dashboard, doctor/ipd,
    // doctor/ipd/[id], nurse/dashboard, patient/ipd) also still call
    // hydrateReal() on their own mount for freshness on revisit during a
    // long-lived session — see those files for why that's intentionally
    // kept, not removed. The session check below is a performance-only
    // skip (avoids the dynamic `@/lib/api` import + network round trip) for
    // the many fully public/unauthenticated pages (e.g. /p/[uhid]) that can
    // never have a live session — it is NOT a security/authorization gate.
    void (async () => {
      try {
        const { data: { session } } = await getSupabaseClient().auth.getSession()
        if (!session) return
        await Promise.all([
          usePatientStore.getState().hydrateReal(),
          useAdmissionStore.getState().hydrateReal(),
          useInpatientStore.getState().hydrateReal(),
        ])
      } catch (err) {
        console.error('[StoreHydrator] real hydration failed:', err)
      }
    })()

    // ── Cross-device real-time via Supabase Realtime ───────────────────────
    // The 7 department modules run in separate browsers / machines, so the OPD
    // queue lives in Postgres. Every connected module subscribes to row changes
    // on the shared tables and re-hydrates instantly — a patient checked in on
    // one device appears in Reception/Nurse/Doctor on every other device with
    // no refresh. Realtime respects RLS, so each module only receives rows it
    // may read. Complements the same-browser BroadcastChannel sync above.
    let liveChannel: RealtimeChannel | null = null
    try {
      const rehydratePatients = () => { void usePatientStore.getState().hydrateReal() }
      liveChannel = getSupabaseClient()
        .channel('hims-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, rehydratePatients)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, rehydratePatients)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'admission_requests' }, () => { void useAdmissionStore.getState().hydrateReal() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ipd_stays' }, () => { void useInpatientStore.getState().hydrateReal() })
        .subscribe()
    } catch (err) {
      console.error('[StoreHydrator] realtime subscribe failed:', err)
    }

    return () => {
      syncCleanups.forEach((fn) => fn())
      if (liveChannel) void getSupabaseClient().removeChannel(liveChannel)
    }
  }, [])
  return null
}
