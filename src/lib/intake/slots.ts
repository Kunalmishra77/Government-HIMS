// Deterministic mock doctor-availability for the voice check-in.
//
// Seeded purely by the date string (and optional doctor) so a given day ALWAYS
// yields the same open times — no backend, no Math.random/Date.now. The
// conversation layer only ever consumes string[] of times, so this can be
// swapped for a real availability API later without touching the UI or prompt.

const GRID = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
  '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
]

// FNV-1a — small, stable string hash. Same input → same number every run.
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Open times for a date, in chronological order. ~60% of the grid is open and
// varies by date so different days feel genuinely different; never fewer than 4
// so the slot conversation can't dead-end.
export function availableSlots(dateIso: string, doctorId = ''): string[] {
  if (!dateIso) return []
  const open = GRID.filter(time => hash(`${dateIso}|${doctorId}|${time}`) % 10 < 6)
  return open.length >= 4 ? open : GRID.slice(0, 6)
}

// The next up-to-`count` open times not already mentioned — powers "suggest 3"
// and the "anything other than 11?" follow-up.
export function suggestSlots(
  dateIso: string,
  alreadyOffered: string[] = [],
  count = 3,
  doctorId = '',
): string[] {
  const offered = new Set(alreadyOffered)
  return availableSlots(dateIso, doctorId).filter(t => !offered.has(t)).slice(0, count)
}

export function isSlotAvailable(dateIso: string, time: string, doctorId = ''): boolean {
  return availableSlots(dateIso, doctorId).includes(time)
}
