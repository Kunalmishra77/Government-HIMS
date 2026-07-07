"use client"

import { useEffect } from "react"
import { useLabStore } from "@/store/useLabStore"
import { useLabOrdersStore } from "@/store/useLabOrdersStore"
import { useRadiologyStore } from "@/store/useRadiologyStore"
import { useRadiologyStudiesStore } from "@/store/useRadiologyStudiesStore"

// Simulates instrument results coming back over time: every few seconds it
// advances one already-accepted lab test and one already-started scan a step.
// When a lab finalises it sets a result + fires the ordering doctor's
// notification (critical values escalate), so the Results inbox fills live
// without a reload.
//
// It only ever touches work a human has already accepted (lab: onto a bench;
// radiology: acquisition started). It must NOT auto-collect a specimen or
// auto-claim a queued order — sample collection and technician accept are
// mandatory human gates, so a doctor's new lab/radiology order stays "In Queue"
// / "Ordered" until a real lab/radiology-role user picks it up in their portal.
// This is also what keeps cross-device orders visible: a freshly dispatched
// order (or one pulled from the shared board) arrives at awaiting_collection /
// ordered — deliberately NOT auto-advanceable — so it shows in the worklist
// instead of being ticked straight through to released. Mounted in the doctor layout.
const AUTO_ADVANCEABLE_TEST = new Set(['in_progress', 'entered', 'verified'])
const AUTO_ADVANCEABLE_SCAN = new Set(['acquiring', 'acquired', 'reading'])

export function ResultsTicker() {
  useEffect(() => {
    const iv = setInterval(() => {
      const processing = useLabOrdersStore.getState().orders
        .flatMap(o => o.tests)
        .find(t => AUTO_ADVANCEABLE_TEST.has(t.status))
      if (processing) useLabStore.getState().advanceStatus(processing.id)

      const pendingScan = useRadiologyStudiesStore.getState().studies
        .find(s => AUTO_ADVANCEABLE_SCAN.has(s.status))
      if (pendingScan) useRadiologyStore.getState().advanceStatus(pendingScan.id)
    }, 6000)
    return () => clearInterval(iv)
  }, [])
  return null
}
