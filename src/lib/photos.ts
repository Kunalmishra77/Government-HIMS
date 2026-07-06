/* Curated human-centred photography (Unsplash, free license).
 * Used ONLY on landing + patient-facing pages — never clinical worklists.
 * Served through next/image (see src/components/ui/Photo.tsx + next.config.ts).
 *
 * Every entry was reviewed visually at the real crop aspect (rendered preview),
 * so alt text matches the actual image and patient-facing surfaces get WARM,
 * reassuring care imagery — never cold equipment/OR shots. */

const U = (id: string, w = 1400) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`

export const PHOTOS = {
  // Doctor in warm conversation with a seated patient — reassuring (check-in).
  doctorPatient: {
    src: U("photo-1622253692010-333f2da6031d"),
    alt: "An Indian doctor consulting with a patient in a clinic",
  },
  // Doctor reviewing results with an older patient — collaborative, gentle.
  consult: {
    src: U("photo-1581056771107-24ca5f033842"),
    alt: "A doctor reviewing results together with an older patient",
  },
  // Approachable clinician portrait.
  clinician: {
    src: U("photo-1612531386530-97286d97c2d2"),
    alt: "An approachable doctor in a white coat",
  },
  // Surgical team in theatre — capability/expertise (landing CTA).
  careTeam: {
    src: U("photo-1631217868264-e5b90bb7e133"),
    alt: "A surgical team working together in the operating theatre",
  },
  // Calm, modern hospital ward.
  ward: {
    src: U("photo-1538108149393-fbbd81895907"),
    alt: "A calm, modern hospital ward",
  },
} as const

export type PhotoKey = keyof typeof PHOTOS
