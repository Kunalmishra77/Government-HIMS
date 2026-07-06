// Deterministic, network-free portrait avatars rendered as inline SVG data-URIs.
// Used to stand in for the Aadhaar photograph in the demo registration flow and
// as a photo fallback anywhere a patient has no uploaded image. Given the same
// seed it always produces the same illustrated headshot — no external requests.

export type AvatarGender = "Male" | "Female" | "Other"

// FNV-1a — small, stable string hash so colours/features are reproducible.
function hash(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const SKIN = ["#F1C7A5", "#E8B48C", "#D9A074", "#C68642", "#A9744B", "#8D5524"]
const HAIR = ["#2B2B2B", "#3B2417", "#5A3825", "#1C1C22", "#4A4A4A", "#20160E"]
const BG = [
  ["#E0ECFF", "#C7DBFF"], ["#FDE8D6", "#FBD3AE"], ["#DEF7E5", "#BFEFCE"],
  ["#EFE4FF", "#DECBFF"], ["#FFE4EC", "#FFC9D8"], ["#E2F4F7", "#C5E8EF"],
]

/** Illustrated headshot as an SVG data-URI, deterministic from `seed`. */
export function portraitDataUri(seed: string, gender: AvatarGender = "Other"): string {
  const h = hash(seed)
  const skin = SKIN[h % SKIN.length]
  const hair = HAIR[(h >> 3) % HAIR.length]
  const [bg1, bg2] = BG[(h >> 6) % BG.length]
  const gid = `g${h % 100000}`
  // Female → longer hair silhouette behind the shoulders; Male/Other → short crop.
  const longHair = gender === "Female"
  const hairShape = longHair
    ? `<path d="M28 74 C22 60 24 40 60 40 C96 40 98 60 92 74 L92 108 L82 108 L82 66 C82 54 74 50 60 50 C46 50 38 54 38 66 L38 108 L28 108 Z" fill="${hair}"/>`
    : `<path d="M34 58 C34 40 48 34 60 34 C72 34 86 40 86 58 C86 52 78 48 60 48 C42 48 34 52 34 58 Z" fill="${hair}"/>`
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">` +
      `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/>` +
      `</linearGradient></defs>` +
      `<rect width="120" height="120" fill="url(#${gid})"/>` +
      // shoulders / torso
      `<path d="M18 120 C18 96 38 84 60 84 C82 84 102 96 102 120 Z" fill="#F4F6FA"/>` +
      // neck
      `<rect x="52" y="70" width="16" height="20" rx="6" fill="${skin}"/>` +
      // head
      `<circle cx="60" cy="54" r="24" fill="${skin}"/>` +
      hairShape +
      // eyes + mouth
      `<circle cx="51" cy="54" r="2.6" fill="#33302E"/><circle cx="69" cy="54" r="2.6" fill="#33302E"/>` +
      `<path d="M53 64 Q60 69 67 64" stroke="#B5744F" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
