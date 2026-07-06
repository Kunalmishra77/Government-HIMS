"use client"

import { useEffect } from "react"
import { useLabStore } from "@/store/useLabStore"
import { useRadiologyStore } from "@/store/useRadiologyStore"
import { useLabOrdersStore } from "@/store/useLabOrdersStore"
import { useRadiologyStudiesStore } from "@/store/useRadiologyStudiesStore"

// Simulates results coming back over time: every few seconds it advances one
// pending lab sample and one pending scan a step. When a lab finalises it sets a
// result + fires the ordering doctor's notification (critical values escalate),
// so the Results inbox fills live without a reload. Mounted in the doctor layout.
//
// Bugfix (real-backend gating): candidates are picked directly off the raw
// useLabOrdersStore/useRadiologyStudiesStore state, filtered to entries with
// no `realId` — i.e. this only ever fake-advances legacy/seed rows that were
// never materialized as a real `lab_tests`/`radiology_studies` row (matches
// this codebase's established realId-gating convention — see e.g.
// useLabOrdersStore's collectOrder). A freshly placed order gets its `realId`
// stamped moments after creation (dispatchLabOrder/dispatchRadOrder in
// doctor/dashboard/page.tsx), so this ticker must never grab it: without this
// filter, the newest order sorts first in useLabOrdersStore's `orders` array
// and was being ticked through claim/finishEntry/verifyTest/releaseTest (etc.)
// every 6s regardless of realId — those bridged actions always update local
// state unconditionally even though the real backend write they attempt gets
// correctly rejected by RLS for a doctor's session, so the order LOOKED
// released/reported on the doctor's own screen within moments of ordering
// while the real row correctly sat at awaiting_collection/ordered. A real
// order's local display must now only progress when an actual
// lab/radiology-role user acts on it in their own portal.
export function ResultsTicker() {
  useEffect(() => {
    const iv = setInterval(() => {
      const pendingLabTest = useLabOrdersStore.getState().orders
        .flatMap(o => o.tests)
        .find(t => t.status !== 'released' && t.status !== 'rejected' && !t.realId)
      if (pendingLabTest) useLabStore.getState().advanceStatus(pendingLabTest.id)

      const pendingScan = useRadiologyStudiesStore.getState().studies
        .find(s => s.status !== 'verified' && s.status !== 'released' && s.status !== 'cancelled' && !s.realId)
      if (pendingScan) useRadiologyStore.getState().advanceStatus(pendingScan.id)
    }, 6000)
    return () => clearInterval(iv)
  }, [])
  return null
}
