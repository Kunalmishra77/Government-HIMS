// Ambient voice scribe. Dictation uses the browser's Web Speech API
// (feature-detected, graceful fallback). `toSOAP` turns a free-text/dictated
// note into a structured S/O/A/P note the doctor can refine.

/* eslint-disable @typescript-eslint/no-explicit-any */

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}

export type Recognition = { stop: () => void }

const browserLang = () =>
  typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US'

// Score a candidate transcript by how digit-like it is: reward the digits it
// carries, penalise word-clutter (letters) that means the audio was misheard as
// words ("for"/"to") instead of digits. Density, not length — so it works the
// same whether the number arrives whole or streamed one digit-group at a time.
function phoneDigitScore(text: string): number {
  const digits = (text.match(/\d/g) ?? []).length
  if (!digits) return -1
  const clutter = text.replace(/[\d\s-]/g, '').length
  return digits * 2 - clutter
}

// Of a final result's alternatives, the one that best forms a mobile number.
function bestPhoneAlternative(result: any): string {
  let best = result[0]?.transcript ?? ''
  let bestScore = phoneDigitScore(best)
  for (let i = 1; i < result.length; i++) {
    const alt = result[i]?.transcript ?? ''
    const s = phoneDigitScore(alt)
    if (s > bestScore) { best = alt; bestScore = s }
  }
  return best
}

// Starts continuous dictation; `onText` receives finalised chunks. Returns a
// handle to stop, or null if unsupported / failed to start.
export function startDictation(onText: (chunk: string) => void, onEnd: () => void): Recognition | null {
  const SR = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null
  if (!SR) return null
  let rec: any
  try { rec = new SR() } catch { return null }
  rec.continuous = true
  rec.interimResults = false
  rec.lang = browserLang()
  rec.onresult = (e: any) => {
    let text = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) text += e.results[i][0].transcript
    }
    if (text.trim()) onText(text.trim())
  }
  rec.onend = onEnd
  // 'aborted' fires when stop() is called — treat it the same as natural end.
  rec.onerror = (e: any) => { if ((e?.error || '') !== 'aborted') onEnd() }
  try { rec.start() } catch { return null }
  return { stop: () => { try { rec.stop() } catch { /* ignore */ } } }
}

// Voice-command dictation for search/assistant: a SINGLE utterance with live
// interim text and explicit error reporting. `onPartial` streams the running
// transcript (replace the input); `onFinal` fires once with the complete phrase
// when the user stops (use it to auto-submit). `onError` surfaces problems like
// blocked-mic ('not-allowed') or 'no-speech' so the UI isn't silently dead.
export function startVoiceCommand(opts: {
  onPartial?: (text: string) => void
  onFinal: (text: string) => void
  onError?: (err: string) => void
  onEnd?: () => void
  lang?: string
  /** How long to keep waiting for the patient to START speaking before giving
   *  up (ms). Slow/elderly patients need a generous window — the browser's own
   *  no-speech timeout (~5-7s) is too short, so we auto-restart until this. */
  graceMs?: number
  /** Silence after the patient STOPS speaking before we finalize (ms). Short
   *  (~900ms) for snappy one-word answers; long for free-form answers where the
   *  patient pauses between thoughts (symptoms, history). */
  endpointMs?: number
  /** Keep one recognition session alive across natural pauses instead of ending
   *  on the first silence — lets the patient describe several symptoms, duration
   *  and history in one breath without being cut off. */
  continuous?: boolean
  /** Hard cap on a single answer once speech has started (ms). Safety bound for
   *  continuous mode so a noisy room can't keep the mic open indefinitely. */
  maxMs?: number
  /** Capturing a phone number: ask the recognizer for several alternatives and
   *  keep the one that best forms a 10-digit mobile, so it lands first try. */
  digits?: boolean
}): Recognition | null {
  const SR = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null
  if (!SR) { opts.onError?.('unsupported'); return null }

  const grace = opts.graceMs ?? 15000
  const endpointMs = opts.endpointMs ?? 900
  const continuous = opts.continuous ?? false
  const maxMs = opts.maxMs ?? 0
  const digits = opts.digits ?? false
  const startedAt = Date.now()
  let finalText = ''
  let lastInterim = ''    // best interim transcript seen — used if no final arrives
  let spoke = false       // patient has produced some speech (interim or final)
  let stopped = false     // explicit stop() or a final result — do not restart
  let settleTimer: ReturnType<typeof setTimeout> | null = null
  let maxTimer: ReturnType<typeof setTimeout> | null = null
  let rec: any

  const clearSettle = () => { if (settleTimer) { clearTimeout(settleTimer); settleTimer = null } }
  const clearMax = () => { if (maxTimer) { clearTimeout(maxTimer); maxTimer = null } }

  const build = (): any | null => {
    let r: any
    try { r = new SR() } catch { opts.onError?.('init-failed'); return null }
    r.continuous = continuous
    r.interimResults = true
    // More alternatives for phone capture so a dropped/misheard digit in the top
    // pick can be recovered from a sibling candidate (see bestPhoneAlternative).
    r.maxAlternatives = digits ? 6 : 1
    r.lang = opts.lang ?? browserLang()
    r.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalText += digits ? bestPhoneAlternative(res) : res[0].transcript
        else interim += res[0].transcript
      }
      if (interim) lastInterim = interim
      if (interim || finalText) spoke = true
      opts.onPartial?.((finalText + interim).trim())
      // Endpointing: once we have a confident transcript, finalize after a short
      // silence instead of waiting for the browser's slow timeout. The window is
      // tunable — short for snappy one-word answers ("Male" / "28"), long for
      // free-form answers where the patient pauses mid-thought (symptoms).
      clearSettle()
      if (finalText.trim() || lastInterim.trim()) {
        settleTimer = setTimeout(() => { try { r.stop() } catch { /* ignore */ } }, endpointMs)
      }
      // Once speech has started, bound a single answer so continuous mode can't
      // stay open forever in a noisy room.
      if (maxMs && !maxTimer) {
        maxTimer = setTimeout(() => { stopped = true; try { r.stop() } catch { /* ignore */ } }, maxMs)
      }
    }
    r.onerror = (e: any) => {
      const err: string = e?.error || 'error'
      // 'aborted'/'no-speech' are expected silence outcomes, not failures.
      if (err !== 'aborted' && err !== 'no-speech') { stopped = true; opts.onError?.(err) }
    }
    r.onend = () => {
      clearSettle()
      clearMax()
      // Use the final transcript, or fall back to the best interim — Chrome
      // frequently ends short utterances ("Male", "28") without ever marking a
      // result final, which previously dropped the answer and stalled the flow.
      const t = (finalText.trim() || lastInterim.trim())
      if (t) { stopped = true; opts.onFinal(t); opts.onEnd?.(); return }
      // Nothing heard yet. If still within the grace window, restart so slow
      // patients have more time to begin answering.
      if (!stopped && !spoke && Date.now() - startedAt < grace) {
        try { rec = build(); rec?.start() } catch { opts.onEnd?.() }
        return
      }
      opts.onEnd?.()
    }
    return r
  }

  rec = build()
  if (!rec) return null
  try { rec.start() } catch { opts.onError?.('start-failed'); return null }
  return { stop: () => { stopped = true; clearSettle(); clearMax(); try { rec?.stop() } catch { /* ignore */ } } }
}

// ── Text-to-speech (assistant voice) ─────────────────────────────────
// Speaks `text` via the browser's speechSynthesis, preferring a voice that
// matches the requested language. `onDone` fires when speech finishes (or
// immediately if TTS is unsupported) so callers can chain "speak → listen".
export function isSpeechOutputSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// Playback handles for the current clip, tracked so cancelSpeech() can stop it.
let currentAudio: HTMLAudioElement | null = null
let currentSource: AudioBufferSourceNode | null = null
let audioCtx: AudioContext | null = null
// Monotonic token identifying the latest speak() request. Because TTS audio is
// fetched asynchronously, a newer speak() (or cancelSpeech()) must invalidate any
// in-flight request so two clips can never play at once — this is the guard that
// prevents overlapping / duplicate voice (e.g. a re-run effect firing twice).
let speakSeq = 0

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || (window as any).webkitAudioContext
  if (!Ctor) return null
  if (!audioCtx) { try { audioCtx = new Ctor() } catch { return null } }
  return audioCtx
}

// Warm up the audio engine on a user gesture: create + resume the AudioContext
// and play one silent sample. Browsers start an AudioContext "suspended" until a
// gesture, and resuming lazily (mid-conversation) delays/clips the first word.
// Unlocking early guarantees the engine is fully initialized before the
// assistant's first greeting plays. Idempotent.
let audioUnlocked = false
export function unlockAudio(): void {
  const ctx = getAudioCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  try {
    const buf = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start(0)
    audioUnlocked = true
  } catch { /* ignore */ }
}

// Register once: the patient taps several times (Get started → consult type →
// method → Continue) before the voice greeting, so the context is already
// running and warm by the time the assistant speaks.
if (typeof window !== 'undefined') {
  const handler = () => {
    unlockAudio()
    if (audioUnlocked) {
      window.removeEventListener('pointerdown', handler)
      window.removeEventListener('touchstart', handler)
      window.removeEventListener('keydown', handler)
    }
  }
  window.addEventListener('pointerdown', handler)
  window.addEventListener('touchstart', handler)
  window.addEventListener('keydown', handler)
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_HI = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्तूबर', 'नवंबर', 'दिसंबर']

// Rewrite any machine-format date ("2026-08-24", "24-08-26", "24/08/2026") into
// spoken words in the active language ("24 August 2026" / "24 अगस्त 2026") so the
// TTS never reads a separator as "minus" or spells the date out digit by digit.
// ISO (year-first) is handled before day-first so the two patterns can't overlap.
function humanizeDatesForSpeech(text: string, lang: 'en' | 'hi'): string {
  const months = lang === 'hi' ? MONTHS_HI : MONTHS_EN
  const fullYear = (y: number) => (y < 100 ? 2000 + y : y)
  const out = text.replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (m, y, mo, d) => {
    const mi = parseInt(mo, 10) - 1
    return mi >= 0 && mi <= 11 ? `${parseInt(d, 10)} ${months[mi]} ${fullYear(parseInt(y, 10))}` : m
  })
  return out.replace(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/g, (m, d, mo, y) => {
    const mi = parseInt(mo, 10) - 1
    return mi >= 0 && mi <= 11 ? `${parseInt(d, 10)} ${months[mi]} ${fullYear(parseInt(y, 10))}` : m
  })
}

// ── Product names & healthcare abbreviations ─────────────────────────────────
// Left alone, the TTS engine (and the browser fallback) guess at acronyms — it
// spells "HIMS" out letter by letter, mangles "UHID", and reads "ABHA" as four
// letters instead of the word it actually is. These rules rewrite each known
// term into a phonetic form so it is spoken the same, correct way everywhere the
// assistant talks — static lines and anything the LLM generates alike.

// Spell an acronym so the TTS reads it one letter at a time. English uses
// dotted capitals ("UHID" → "U.H.I.D") — the format ElevenLabs reliably reads as
// letter names; Hindi uses the Devanagari letter names spaced apart.
const LETTER_HI: Record<string, string> = {
  A: 'ए', B: 'बी', C: 'सी', D: 'डी', E: 'ई', F: 'एफ़', G: 'जी', H: 'एच',
  I: 'आई', J: 'जे', K: 'के', L: 'एल', M: 'एम', N: 'एन', O: 'ओ', P: 'पी',
  Q: 'क्यू', R: 'आर', S: 'एस', T: 'टी', U: 'यू', V: 'वी', W: 'डब्ल्यू',
  X: 'एक्स', Y: 'वाई', Z: 'ज़ेड',
}
const spellLetters = (word: string, lang: 'en' | 'hi'): string =>
  lang === 'hi'
    ? word.split('').map((c) => LETTER_HI[c.toUpperCase()] ?? c).join(' ')
    : word.toUpperCase().split('').join('.')
const spelled = (word: string) => ({ en: spellLetters(word, 'en'), hi: spellLetters(word, 'hi') })

// Each rule is a case-sensitive, whole-word match (acronyms are only ever
// written in caps in spoken copy, so matching case avoids catching ordinary
// words like "it"/"im"/"ct"). Multi-word/product rules run first so a
// single-word rule can't re-touch what they already rewrote; because every
// replacement is lower-case or Devanagari, the caps-only patterns never rematch.
const PRONUNCIATION: Array<{ re: RegExp; en: string; hi: string }> = [
  // Product name — "HIMS" is read letter by letter ("H.I.M.S").
  { re: /\bAgentix\s+HIMS\b/g, en: `Agentix ${spellLetters('HIMS', 'en')}`, hi: `एजेंटिक्स ${spellLetters('HIMS', 'hi')}` },
  { re: /\bHIMS\b/g, ...spelled('HIMS') },
  // ABHA (Ayushman Bharat Health Account) is a spoken word — "Ah-bha".
  { re: /\bABHA\b/g, en: 'Abha', hi: 'आभा' },
  // Everything below is read out letter by letter.
  { re: /\bABDM\b/g, ...spelled('ABDM') },
  { re: /\bUHID\b/g, ...spelled('UHID') },
  { re: /\bNICU\b/g, ...spelled('NICU') },
  { re: /\bICU\b/g, ...spelled('ICU') },
  { re: /\bOPD\b/g, ...spelled('OPD') },
  { re: /\bIPD\b/g, ...spelled('IPD') },
  { re: /\bTPA\b/g, ...spelled('TPA') },
  { re: /\bCMO\b/g, ...spelled('CMO') },
  { re: /\bMRD\b/g, ...spelled('MRD') },
  { re: /\bEMR\b/g, ...spelled('EMR') },
  { re: /\bEHR\b/g, ...spelled('EHR') },
  { re: /\bECG\b/g, ...spelled('ECG') },
  { re: /\bEKG\b/g, ...spelled('EKG') },
  { re: /\bCBC\b/g, ...spelled('CBC') },
  { re: /\bMRI\b/g, ...spelled('MRI') },
  { re: /\bSpO2\b/g, en: 'S.P.O.2', hi: 'एस पी ओ टू' },
  { re: /\bOT\b/g, ...spelled('OT') },
  { re: /\bBP\b/g, ...spelled('BP') },
  { re: /\bIV\b/g, ...spelled('IV') },
  { re: /\bIM\b/g, ...spelled('IM') },
  { re: /\bCT\b/g, ...spelled('CT') },
]

// Rewrite product names and healthcare abbreviations into their spoken forms so
// the assistant pronounces them naturally and identically every time.
export function humanizeAbbrevsForSpeech(text: string, lang: 'en' | 'hi'): string {
  return PRONUNCIATION.reduce((s, r) => s.replace(r.re, lang === 'hi' ? r.hi : r.en), text)
}

// Hindi cardinal numbers 0–59 — used to speak clock times as words.
const NUM_HI = [
  'शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ',
  'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस',
  'बीस', 'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस',
  'तीस', 'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस',
  'चालीस', 'इकतालीस', 'बयालीस', 'तैंतालीस', 'चौवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास',
  'पचास', 'इक्यावन', 'बावन', 'तिरेपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ',
]

// Natural Hindi spoken form of a clock time, per receptionist convention:
//   HH:00 -> "X बजे"   ·   HH:30 -> "साढ़े X बजे"   ·   else -> "X YY पर"
function spokenTimeHi(h24: number, m: number): string {
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const hw = NUM_HI[h12]
  if (m === 0) return `${hw} बजे`
  if (m === 30) return `साढ़े ${hw} बजे`
  return `${hw} ${NUM_HI[m] ?? String(m)} पर`
}

// Convert a "HH:MM AM/PM" / "HH:MM" string to its spoken form. Hindi uses the
// natural word rules above; English just strips the leading zero ("2:00 PM").
export function spokenTime(t: string, lang: 'en' | 'hi'): string {
  const mt = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!mt) return t
  let h = parseInt(mt[1], 10); const min = parseInt(mt[2], 10); const ap = (mt[3] || '').toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  if (lang !== 'hi') return `${h % 12 === 0 ? 12 : h % 12}:${mt[2]}${ap ? ` ${ap}` : ''}`
  return spokenTimeHi(h, min)
}

// Rewrite any clock time the assistant says ("11:00 AM", "दोपहर 1:30 बजे", "10:32")
// into natural Hindi words so the TTS never reads it as raw digits. Absorbs a
// leading part-of-day word and a trailing AM/PM/बजे so nothing is left dangling.
function humanizeTimesForSpeech(text: string, lang: 'en' | 'hi'): string {
  if (lang !== 'hi') return text
  return text.replace(
    /(?:(?:सुबह|दोपहर|शाम|सवेरे|रात)\s*)?(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm|बजे))?/g,
    (_full, hh, mm, suffix) => {
      let h = parseInt(hh, 10); const m = parseInt(mm, 10)
      const ap = (suffix || '').toUpperCase()
      if (ap === 'PM' && h < 12) h += 12
      if (ap === 'AM' && h === 12) h = 0
      return spokenTimeHi(h, m)
    },
  )
}

// Read a spoken phone number digit by digit. Left alone, TTS voices "9876543210"
// as one gigantic number ("nine billion…") — the patient can't verify it. Matches
// a 7–13 digit run (optionally +91 / a leading 0, grouped with spaces or hyphens)
// and expands the trailing 10 digits: Hindi as number words, English as spaced
// digits the engine voices one at a time. Runs AFTER date/time humanization so
// those are already words and can never be caught here.
function humanizePhoneForSpeech(text: string, lang: 'en' | 'hi'): string {
  return text.replace(/(?:\+?91[\s-]?)?\d(?:[\s-]?\d){6,12}/g, (m) => {
    const d = m.replace(/\D/g, '')
    if (d.length < 7 || d.length > 13) return m
    const core = d.length > 10 ? d.slice(-10) : d
    return core.split('').map(c => (lang === 'hi' ? NUM_HI[Number(c)] : c)).join(' ')
  })
}

// Speaks via the ElevenLabs proxy (`/api/voice/tts`) for a natural assistant
// voice, falling back to the browser's speechSynthesis if the request fails or
// the key isn't configured. `onDone` fires exactly once when audio finishes.
export function speak(text: string, lang: 'en' | 'hi' = 'en', onDone?: () => void): void {
  cancelSpeech()
  if (typeof window === 'undefined' || !text.trim()) { onDone?.(); return }

  const spoken = humanizeAbbrevsForSpeech(humanizePhoneForSpeech(humanizeTimesForSpeech(humanizeDatesForSpeech(text, lang), lang), lang), lang)
  const seq = ++speakSeq
  let settled = false
  const finish = () => { if (!settled) { settled = true; onDone?.() } }

  fetch('/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: spoken, lang }),
  })
    .then(async (res) => {
      // A newer speak()/cancelSpeech() superseded this request — drop it before
      // it can start a competing audio clip.
      if (seq !== speakSeq) return
      if (!res.ok) throw new Error(`tts ${res.status}`)
      const bytes = await res.arrayBuffer()
      if (seq !== speakSeq) return

      // Preferred path: decode the WHOLE clip with the Web Audio API before
      // playing. `decodeAudioData` only resolves once every sample is decoded, so
      // an AudioBufferSourceNode plays from sample 0 with zero warm-up — this is
      // what guarantees the sentence starts on the very first word (no clipping).
      const ctx = getAudioCtx()
      if (ctx) {
        try {
          if (ctx.state === 'suspended') { try { await ctx.resume() } catch { /* ignore */ } }
          const decoded = await ctx.decodeAudioData(bytes.slice(0))
          if (seq !== speakSeq) return

          // Prepend ~200ms of silence to the decoded clip. The audio engine can
          // drop its first render quantum while spinning up, which clips the
          // opening word ("Thank you…"). With a silent lead, any dropped warm-up
          // samples come from the silence — the speech itself always plays in
          // full from its first word. This is the definitive anti-clip fix.
          const padSec = 0.2
          const pad = Math.floor(decoded.sampleRate * padSec)
          const buffer = ctx.createBuffer(decoded.numberOfChannels, decoded.length + pad, decoded.sampleRate)
          for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
            buffer.getChannelData(ch).set(decoded.getChannelData(ch), pad)
          }

          const source = ctx.createBufferSource()
          source.buffer = buffer
          source.connect(ctx.destination)
          source.onended = () => { if (currentSource === source) currentSource = null; finish() }
          currentSource = source
          // Schedule a hair ahead of now so the graph is fully live before the
          // buffer begins, rather than racing an "immediate" start.
          source.start(ctx.currentTime + 0.02)
          return
        } catch { /* fall through to HTMLAudio */ }
      }

      // Fallback: HTMLAudioElement, played only once fully ready (canplaythrough)
      // so the first word still isn't clipped on browsers without Web Audio.
      // Resume a suspended context first so autoplay isn't blocked here either.
      if (ctx && ctx.state === 'suspended') { try { await ctx.resume() } catch { /* ignore */ } }
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
      if (seq !== speakSeq) { URL.revokeObjectURL(url); return }
      const audio = new Audio()
      audio.preload = 'auto'
      currentAudio = audio
      const cleanup = () => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null }
      audio.onended = () => { cleanup(); finish() }
      audio.onerror = () => { cleanup(); if (seq === speakSeq) browserSpeak(spoken, lang, finish) }
      let started = false
      const start = () => {
        if (started || seq !== speakSeq) return
        started = true
        audio.play().catch(() => { cleanup(); if (seq === speakSeq) browserSpeak(spoken, lang, finish) })
      }
      audio.addEventListener('canplaythrough', start, { once: true })
      audio.src = url
      audio.load()
      const poll = setInterval(() => {
        if (started || seq !== speakSeq) { clearInterval(poll); return }
        if (audio.readyState >= 4) { clearInterval(poll); start() }
      }, 60)
      setTimeout(() => { if (!started) { clearInterval(poll); start() } }, 2500)
    })
    .catch(() => { if (seq === speakSeq) browserSpeak(spoken, lang, finish) })
}

function browserSpeak(text: string, lang: 'en' | 'hi', onDone?: () => void): void {
  if (!isSpeechOutputSupported()) { onDone?.(); return }
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const target = lang === 'hi' ? 'hi-IN' : 'en-IN'
  u.lang = target
  const match = synth.getVoices().find(v => v.lang === target) || synth.getVoices().find(v => v.lang.startsWith(lang))
  if (match) u.voice = match
  u.rate = 0.92   // calm, unhurried pace to match the primary voice
  u.pitch = 1
  u.onend = () => onDone?.()
  u.onerror = () => onDone?.()
  synth.speak(u)
}

export function cancelSpeech(): void {
  speakSeq++ // invalidate any in-flight speak() so it can't start playing
  if (currentSource) {
    currentSource.onended = null
    try { currentSource.stop() } catch { /* already stopped */ }
    try { currentSource.disconnect() } catch { /* ignore */ }
    currentSource = null
  }
  if (currentAudio) {
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio.pause()
    currentAudio = null
  }
  if (isSpeechOutputSupported()) window.speechSynthesis.cancel()
}

export function toSOAP(text: string, opts: { diagnosis?: string; vitals?: string }): string {
  const t = text.trim()
  return [
    `S (Subjective): ${t || '—'}`,
    `O (Objective): ${opts.vitals ? opts.vitals : 'Examination findings / vitals — to complete.'}`,
    `A (Assessment): ${opts.diagnosis?.trim() || 'Working diagnosis — to complete.'}`,
    `P (Plan): Investigations / medications as ordered above; follow-up and red-flag advice given.`,
  ].join('\n')
}
