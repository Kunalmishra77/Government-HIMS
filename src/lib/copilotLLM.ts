import { respond, type CopilotCtx, type CopilotReply } from './doctorCopilot'
import { respondAdmin, type AdminAnswer, type AdminContext } from './adminCopilot'

// Pluggable copilot engine. Today it runs the grounded, records-only rule engine
// (no hallucination — every answer derives from the doctor's actual data). A real
// LLM can be wired here behind a configured endpoint/key without touching the UI:
// the page only depends on `runCopilot`, not on how the reply is produced.
export function runCopilot(query: string, ctx: CopilotCtx): CopilotReply {
  // When NEXT_PUBLIC_LLM_ENDPOINT is configured, route to the model here and fall
  // back to the grounded engine on any error. Left as the integration seam.
  return respond(query, ctx)
}

// Admin assistant seam. Today it runs the grounded, whole-hospital rule engine
// (reads the live stores; never invents). When a real LLM is wired, route here
// and let the model call the same grounded readers as tools, falling back to
// `respondAdmin` on any error — the page only depends on `runAdminCopilot`.
export function runAdminCopilot(query: string, ctx: AdminContext = {}): AdminAnswer {
  return respondAdmin(query, ctx)
}

export type { CopilotCtx, CopilotReply, AdminAnswer, AdminContext }
