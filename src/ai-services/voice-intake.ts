import { wrapAiResponse } from '@/lib/ai-helpers'
import type { AiEnvelope } from '@/types/ai'

export interface VoiceIntakeResult {
  extractedName?: string
  extractedAge?: number
  extractedGender?: 'Male' | 'Female' | 'Other'
  extractedPhone?: string
  extractedSymptoms: string[]
  extractedDepartmentPreference?: string
  detectedLanguage: 'en' | 'hi'
  rawTranscript: string
}

// Symptom recognition lexicon. Each entry maps many free-speech phrasings
// (English + Hindi, including common STT spellings) to ONE canonical symptom
// name that exactly matches `SYMPTOMS` in lib/intake/data — so triage and
// department suggestion stay correct. Patterns use word boundaries to avoid
// false matches (e.g. "ear" inside "hearing"/"year").
const SYMPTOM_LEXICON: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(fever|temperature|pyrexia|fevor|feaver|feverish)\b|बुखार|ज्वर|बुख़ार/i, 'Fever'],
  [/\b(cough|coughing|cof)\b|खांसी|खाँसी|खासी/i, 'Cough'],
  [/\b(cold|runny nose|running nose|blocked nose|stuffy nose|nasal congestion|sneez\w*)\b|सर्दी|ज़ुकाम|जुकाम|नाक बह/i, 'Cold'],
  [/\b(head ?ache|head pain|migraine|head is paining)\b|सिर ?दर्द|सर दर्द|माइग्रेन/i, 'Headache'],
  [/\b(chest pain|chest ache|chest tightness|heart pain|pain in (my )?chest)\b|सीने में दर्द|छाती में दर्द|सीने में/i, 'Chest Pain'],
  [/\b(breathless\w*|short(ness)? of breath|difficulty (in )?breathing|can'?t breathe|cannot breathe|breathing (problem|trouble|difficulty)|dyspn\w*)\b|सांस लेने|साँस लेने|सांस फूल|साँस/i, 'Breathlessness'],
  [/\b(sore throat|throat pain|throat infection|pain in (my )?throat|scratchy throat)\b|गले में दर्द|गला दर्द|गले में ख/i, 'Sore Throat'],
  [/\b(body ?ache|body pain|body pains|muscle pain|muscle ache|whole body pain)\b|बदन दर्द|शरीर दर्द|बदन में दर्द/i, 'Body Ache'],
  [/\b(stomach ?ache|stomach pain|abdominal pain|abdomen pain|belly (pain|ache)|tummy (pain|ache)|stomach problem|pain in (my )?stomach|gastric)\b|पेट दर्द|पेट में दर्द|पेट ख़राब|पेट खराब/i, 'Stomach Pain'],
  [/\b(vomit\w*|throwing up|throw up|nause\w*|feeling sick|i feel like vomiting)\b|उल्टी|उलटी|मितली|जी मिचला/i, 'Vomiting'],
  [/\b(diarr?h?oea|diarr?hea|loose motions?|loose stool|watery stool)\b|दस्त|पतला पाख़ाना|पतला पाखाना/i, 'Diarrhea'],
  [/\b(dizz\w*|giddy|giddiness|vertigo|light ?headed|feeling faint|spinning)\b|चक्कर|घुमनी/i, 'Dizziness'],
  [/\b(back ?ache|back pain|lower back pain|pain in (my )?back|spine pain)\b|कमर दर्द|पीठ दर्द|कमर में दर्द/i, 'Back Pain'],
  [/\b(joint pain|joints? (pain|ache)|knee pain|arthritis|pain in (my )?joints?)\b|जोड़ों में दर्द|जोड़ दर्द|घुटने में दर्द/i, 'Joint Pain'],
  [/\b(fatigue|tired(ness)?|weak(ness)?|exhaust\w*|no energy|lethargy|low energy)\b|थकान|कमज़ोरी|कमजोरी/i, 'Fatigue'],
  [/\b(skin rash|rash(es)?|itch\w*|skin (problem|allergy|irritation)|hives)\b|चकत्ते|खुजली|दाने|त्वचा पर/i, 'Skin Rash'],
  [/\b(vision (problem|issue|loss)|blurred vision|blurry vision|eye ?(pain|problem)|can'?t see|cannot see|eyesight|poor vision)\b|आँख|आंख|नज़र|धुंधला/i, 'Vision Issue'],
  [/\b(hearing (problem|loss|issue)|can'?t hear|cannot hear|ear ?(pain|ache|problem)|earache|deaf)\b|कान में दर्द|कान दर्द|सुनाई/i, 'Hearing Issue'],
  [/\b(swallow\w*|difficulty (in )?swallowing|pain (while|when) swallowing|painful swallowing)\b|निगलने में|निगलने/i, 'Swallowing Pain'],
  [/\b(injur\w*|wound|cut|fracture|sprain|accident|fell down|fall|hurt myself|broken bone|bleeding)\b|चोट|घाव|फ्रैक्चर|गिर गया/i, 'Injury'],
]

// All canonical symptoms mentioned anywhere in `text` (order = lexicon order).
export function matchSymptoms(text: string): string[] {
  const found: string[] = []
  for (const [re, name] of SYMPTOM_LEXICON) {
    if (re.test(text) && !found.includes(name)) found.push(name)
  }
  return found
}

export const DEPARTMENT_KEYWORDS: Record<string, string> = {
  'heart': 'Cardiology', 'cardio': 'Cardiology', 'cardiac': 'Cardiology', 'दिल': 'Cardiology',
  'bone': 'Orthopedics', 'ortho': 'Orthopedics', 'joint': 'Orthopedics', 'हड्डी': 'Orthopedics',
  'neuro': 'Neurology', 'brain': 'Neurology', 'nerve': 'Neurology', 'दिमाग': 'Neurology',
  'skin': 'Dermatology', 'derma': 'Dermatology', 'त्वचा': 'Dermatology',
  'ear': 'ENT', 'nose': 'ENT', 'throat': 'ENT', 'ent': 'ENT', 'कान': 'ENT',
  'eye': 'Ophthalmology', 'vision': 'Ophthalmology', 'आंख': 'Ophthalmology',
  'stomach': 'Gastroenterology', 'gastro': 'Gastroenterology', 'पेट': 'Gastroenterology',
  'general': 'General Medicine', 'medicine': 'General Medicine',
}

const HINDI_MARKERS = ['मेरा', 'मेरी', 'मुझे', 'है', 'हूं', 'हैं', 'और', 'दर्द', 'बुखार', 'खांसी', 'नाम']

export function detectLanguage(text: string): 'en' | 'hi' {
  const lower = text.toLowerCase()
  return HINDI_MARKERS.some(m => lower.includes(m)) ? 'hi' : 'en'
}

// Words that follow "I am / this is …" but are clearly NOT a name — symptoms,
// states, or fillers a patient says ("I am fever", "I'm fine"). Guards the
// permissive name patterns below from capturing junk as the patient's name.
const NON_NAME_WORDS = /^(fever|cough|cold|pain|sick|ill|fine|good|okay|ok|here|coming|having|feeling|not|very|so|the|a|years?|year)$/i

export function extractName(text: string): string | undefined {
  // Up to three name words after a self-introduction cue. STT often lowercases,
  // so the /i flag intentionally accepts lowercase output.
  const enMatch = text.match(/(?:my name is|i am|i'm|name is|this is|myself)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})/i)
  if (enMatch && !NON_NAME_WORDS.test(enMatch[1].split(/\s+/)[0])) return enMatch[1]
  const hiMatch = text.match(/(?:मेरा नाम|नाम है|मैं)\s+([^\s,।]+(?:\s+[^\s,।]+)?)/i)
  if (hiMatch) return hiMatch[1]
  return undefined
}

// Spoken number-words → digits, English + Hindi, plus the "double"/"triple"
// grouping patients use dictating a number ("double nine one…" → "991…"). STT
// for en-IN/hi-IN usually returns digits, but not always — normalizing first
// lets a word-y transcript still yield the number on the first attempt.
const DIGIT_WORDS: Record<string, string> = {
  zero: '0', oh: '0', nought: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  'शून्य': '0', 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पाँच': '5',
  'पांच': '5', 'छह': '6', 'छः': '6', 'सात': '7', 'आठ': '8', 'नौ': '9',
}
const MULTIPLIER_WORDS: Record<string, number> = { double: 2, triple: 3, 'डबल': 2, 'ट्रिपल': 3 }

export function normalizeSpokenDigits(text: string): string {
  let out = ''
  let repeat = 1
  for (const tok of text.toLowerCase().split(/[\s,]+/)) {
    // Keep combining marks (\p{M}) — stripping them mangles Devanagari digit
    // words ("पाँच" → "पच", "छः" → "छ") so Hindi numbers would stop matching.
    const word = tok.replace(/[^\p{L}\p{N}\p{M}]/gu, '')
    if (!word) continue
    if (word in MULTIPLIER_WORDS) { repeat = MULTIPLIER_WORDS[word]; continue }
    const d = word in DIGIT_WORDS ? DIGIT_WORDS[word] : (/^\d+$/.test(word) ? word : null)
    // A non-number word (or a stray multiplier) breaks the run so two separate
    // numbers — e.g. an age and a phone in one breath — never fuse into one.
    out += d !== null ? d.repeat(repeat) : ' '
    repeat = 1
  }
  return out
}

// First 10-digit Indian mobile (starts 6–9), tolerant of +91, spaces, hyphens.
// Falls back to spoken number-words ("nine eight seven…", "double five…") so a
// word-y transcript still resolves without asking the patient to repeat.
export function extractPhone(text: string): string | undefined {
  const m = text.match(/(?:\+?91[\s-]?)?([6-9](?:[\s-]?\d){9})\b/)
  if (m) return m[1].replace(/\D/g, '')
  const spoken = normalizeSpokenDigits(text).match(/[6-9]\d{9}/)
  return spoken ? spoken[0] : undefined
}

export function extractAge(text: string): number | undefined {
  const match = text.match(/(?:i am|i'm|age is|aged?|years? old|साल|उम्र|वर्ष)\s*(?:is\s*)?(\d{1,3})/i)
    ?? text.match(/(\d{1,3})\s*(?:years? old|साल|वर्ष)/i)
  if (match) {
    const age = parseInt(match[1])
    if (age >= 1 && age <= 120) return age
  }
  return undefined
}

export function extractGender(text: string): 'Male' | 'Female' | 'Other' | undefined {
  const lower = text.toLowerCase()
  // Check "other" first so it isn't shadowed, and match the option the prompt offers.
  if (/\b(other|others|transgender|trans|non[\s-]?binary|third\s?gender|prefer not)\b/.test(lower) || /अन्य|ट्रांस|थर्ड/.test(text)) return 'Other'
  if (/\b(female|woman|women|girl|lady|madam|wife|mother|daughter|sister)\b/.test(lower) || /महिला|लड़की|औरत|स्त्री|बेटी/.test(text)) return 'Female'
  if (/\b(male|man|boy|gentleman|husband|father|son|brother)\b/.test(lower) || /पुरुष|लड़का|आदमी|मर्द|बेटा/.test(text)) return 'Male'
  return undefined
}

export async function extractIntakeFromVoice(
  transcript: string,
  language: 'en' | 'hi',
): Promise<AiEnvelope<VoiceIntakeResult>> {
  await new Promise(r => setTimeout(r, 300))

  const lower = transcript.toLowerCase()

  const symptoms = matchSymptoms(transcript)

  let dept: string | undefined
  for (const [keyword, deptName] of Object.entries(DEPARTMENT_KEYWORDS)) {
    if (lower.includes(keyword)) { dept = deptName; break }
  }

  const detectedLang = detectLanguage(transcript) === 'hi' ? 'hi' : language

  const result: VoiceIntakeResult = {
    extractedName: extractName(transcript),
    extractedAge: extractAge(transcript),
    extractedGender: extractGender(transcript),
    extractedPhone: extractPhone(transcript),
    extractedSymptoms: symptoms,
    extractedDepartmentPreference: dept,
    detectedLanguage: detectedLang,
    rawTranscript: transcript,
  }

  const fieldsFound = Object.entries(result)
    .filter(([k, v]) => k !== 'rawTranscript' && k !== 'detectedLanguage' && v !== undefined && (Array.isArray(v) ? v.length > 0 : true))
    .length

  return wrapAiResponse<VoiceIntakeResult>(
    result,
    0.75 + fieldsFound * 0.03,
    `Voice extraction from ${language.toUpperCase()} speech. Detected: ${fieldsFound} fields. Transcript: "${transcript.slice(0, 80)}…"`,
  )
}
