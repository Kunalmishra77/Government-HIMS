// Live cross-tab synchronisation for Zustand stores via BroadcastChannel.
//
// Every department is opened in its own browser tab. When a store changes in one
// tab (e.g. Reception clicks "Send to Vitals"), its data is broadcast to all
// other same-origin tabs, which apply it WITHOUT re-broadcasting — so the
// Nurse/Doctor/Lab/Radiology/Pharmacy tabs update instantly, with no page
// refresh. Last-write-wins; browser-only (guarded for SSR and older engines).
//
// This is the same-machine, multi-tab real-time layer. For a true multi-machine
// deployment the same subscribe/apply design can be re-pointed at Supabase
// Realtime (postgres_changes) — the store contract does not change.
import type { StoreApi } from 'zustand'

type AnyState = Record<string, unknown>

// Only data travels between tabs — Zustand action functions stay local (they are
// not structured-cloneable and each tab already has its own).
function dataOnly(state: AnyState): AnyState {
  const out: AnyState = {}
  for (const key in state) {
    if (typeof state[key] !== 'function') out[key] = state[key]
  }
  return out
}

/**
 * Keep one Zustand store live-synced across all same-origin tabs.
 * Returns an unsubscribe function. No-op during SSR / where BroadcastChannel is
 * unavailable.
 */
export function syncStoreAcrossTabs<T extends object>(store: StoreApi<T>, channelName: string): () => void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return () => {}

  const channel = new BroadcastChannel(`agentix-sync:${channelName}`)
  let applyingRemote = false

  const unsub = store.subscribe((state) => {
    if (applyingRemote) return // don't echo a change we just received
    try {
      channel.postMessage(dataOnly(state as AnyState))
    } catch {
      // Non-cloneable payload (rare) — skip this frame rather than throw.
    }
  })

  channel.onmessage = (event) => {
    applyingRemote = true
    try {
      // Merge (replace=false) so each tab's local action functions are preserved.
      store.setState(event.data as Partial<T>)
    } finally {
      applyingRemote = false
    }
  }

  return () => {
    unsub()
    channel.close()
  }
}
