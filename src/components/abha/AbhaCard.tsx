"use client"

import React from "react"
import { QRCodeSVG } from "qrcode.react"
import { ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

// Official NHA / ABHA card palette — deliberately NOT the app's teal brand.
const ABHA_NAVY = "#1b2a80"
const ABHA_LINK = "#16324A"

export interface AbhaCardData {
  name: string
  nameHindi?: string
  fathersName?: string
  abhaNumber: string
  abhaAddress: string
  gender: string
  genderHindi?: string
  dob: string
  mobile: string
  address?: string
  district?: string
  state?: string
  pincode?: string
  aadhaarVerified?: boolean
  photoUrl?: string
}

const DEFAULT_DATA: AbhaCardData = {
  name: "Mithlesh Mishra",
  nameHindi: "मिथलेश मिश्रा",
  fathersName: "Ram Prasad Mishra",
  abhaNumber: "91-4110-1750-4142",
  abhaAddress: "mithlesh007@abdm",
  gender: "Male",
  genderHindi: "पुरुष",
  dob: "18-05-1999",
  mobile: "7985203818",
  aadhaarVerified: true,
}

export interface AbhaCardProps {
  data?: Partial<AbhaCardData>
  /** Render the reverse (instructions) face below the front. Default true. */
  showBack?: boolean
  /** Denser layout that fits narrow containers (drawers) without scrolling. */
  compact?: boolean
  className?: string
}

// ── National Emblem (stylised Lion Capital of Ashoka) ────────────────────────
function NationalEmblem({ className }: { className?: string }) {
  const spokes = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <svg viewBox="0 0 64 86" className={className} fill="none" aria-hidden="true">
      <g fill="currentColor">
        {/* Three lion heads */}
        {[18, 32, 46].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="14" r="6.4" />
            <path d={`M${cx - 5} 9 L${cx - 7} 3 L${cx - 2.5} 7 Z`} />
            <path d={`M${cx + 5} 9 L${cx + 7} 3 L${cx + 2.5} 7 Z`} />
          </g>
        ))}
        <ellipse cx="32" cy="20" rx="20" ry="4.5" />
        {/* Abacus */}
        <rect x="14" y="24" width="36" height="6" rx="1" />
        {/* Ashoka Chakra */}
        <g transform="translate(32 44)" stroke="currentColor" strokeWidth="1.1">
          <circle r="9.5" fill="none" />
          <circle r="2" fill="currentColor" stroke="none" />
          {spokes.map((deg) => (
            <line key={deg} x1="0" y1="0" x2="0" y2="-9.5" transform={`rotate(${deg})`} />
          ))}
        </g>
        {/* Bell base */}
        <path d="M22 56 L42 56 L38 64 L26 64 Z" />
      </g>
      <text
        x="32"
        y="78"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="currentColor"
        style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}
      >
        सत्यमेव जयते
      </text>
    </svg>
  )
}

// ── Ayushman Bharat Digital Mission circular logo ────────────────────────────
function AbdmLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="49" fill="#ffffff" stroke="#e2e6f0" strokeWidth="1" />
      <defs>
        <path id="abdm-top" d="M50 10 a40 40 0 0 1 0 80" fill="none" />
        <path id="abdm-bot" d="M14 62 a40 40 0 0 0 72 0" fill="none" />
      </defs>
      <text fontSize="7.6" fontWeight="700" fill={ABHA_NAVY} letterSpacing="0.5">
        <textPath href="#abdm-top" startOffset="6%">AYUSHMAN BHARAT</textPath>
      </text>
      <text fontSize="7" fontWeight="600" fill="#2e7d32" letterSpacing="0.4">
        <textPath href="#abdm-bot" startOffset="14%">DIGITAL MISSION</textPath>
      </text>
      {/* Green leaf cradle */}
      <path
        d="M30 64 C24 46 36 30 50 30 C46 40 40 47 34 52 C40 50 47 47 52 40 C52 56 44 66 30 64 Z"
        fill="#2e9e4f"
      />
      {/* Saffron figure forming a care/heart motif */}
      <circle cx="56" cy="36" r="6.5" fill="#F58C4E" />
      <path
        d="M44 64 C44 50 52 44 58 44 C66 44 72 52 70 64 C62 60 52 60 44 64 Z"
        fill="#F58C4E"
      />
      {/* Health cross */}
      <g fill="#ffffff">
        <rect x="55.5" y="49" width="5" height="13" rx="1" />
        <rect x="51.5" y="53" width="13" height="5" rx="1" />
      </g>
    </svg>
  )
}

// ── National Health Authority lockup (emblem + wordmark) ─────────────────────
function NhaLockup({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-white">
      <NationalEmblem className={cn("w-auto shrink-0", compact ? "h-8" : "h-12")} />
      <div className="leading-[0.95]">
        <p className={cn("font-extrabold lowercase tracking-tight", compact ? "text-[9px]" : "text-[15px]")}>national</p>
        <p className={cn("font-extrabold lowercase tracking-tight", compact ? "text-[9px]" : "text-[15px]")}>health</p>
        <p className={cn("font-extrabold lowercase tracking-tight", compact ? "text-[9px]" : "text-[15px]")}>authority</p>
        <p className={cn("mt-0.5 font-semibold tracking-[0.18em] text-white/80", compact ? "text-[5px]" : "text-[6px]")} style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}>
          सत्यमेव जयते
        </p>
      </div>
    </div>
  )
}

function CardHeader({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", compact ? "px-3 py-2" : "px-5 py-3.5")} style={{ backgroundColor: ABHA_NAVY }}>
      <NhaLockup compact={compact} />
      <div className="text-center text-white">
        <p className={cn("font-semibold leading-tight", compact ? "text-[9px]" : "text-[15px]")}>Ayushman Bharat Health Account (ABHA)</p>
        <p className={cn("leading-tight", compact ? "text-[8px]" : "text-[14px]")} style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}>
          आयुष्मान भारत स्वास्थ्य खाता (आभा)
        </p>
      </div>
      <AbdmLogo className={cn("shrink-0", compact ? "h-9 w-9" : "h-14 w-14")} />
    </div>
  )
}

function Field({ label, labelHindi, compact, children }: { label: string; labelHindi: string; compact?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className={cn("text-slate-700", compact ? "text-[10px]" : "text-[13px]")}>
        {label}/{" "}
        <span style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}>{labelHindi}</span>
      </p>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}

function AbhaCardFront({ data, compact }: { data: AbhaCardData; compact?: boolean }) {
  const qrPayload = JSON.stringify({
    name: data.name,
    abhaNumber: data.abhaNumber,
    abhaAddress: data.abhaAddress,
    gender: data.gender,
    dob: data.dob,
    mobile: data.mobile,
  })

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader compact={compact} />
      <div className={compact ? "px-4 py-4" : "px-6 py-6"}>
        <div className={cn("flex", compact ? "gap-3" : "gap-6")}>
          {/* Photo */}
          <div className="shrink-0">
            <div className={cn("overflow-hidden rounded-sm border border-slate-300 bg-slate-100", compact ? "h-[86px] w-[68px]" : "h-[136px] w-[112px]")}>
              {data.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.photoUrl} alt={data.name} className="h-full w-full object-cover" />
              ) : (
                <svg viewBox="0 0 112 136" className="h-full w-full text-slate-300" aria-hidden="true">
                  <rect width="112" height="136" fill="#eef1f6" />
                  <circle cx="56" cy="52" r="24" fill="currentColor" />
                  <path d="M16 130 C16 100 40 88 56 88 C72 88 96 100 96 130 Z" fill="currentColor" />
                </svg>
              )}
            </div>
            {data.aadhaarVerified && (
              <span className={cn("mt-2 inline-flex items-center gap-1 rounded-full bg-green-50 font-bold text-green-700 border border-green-200", compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10.5px]")}>
                <ShieldCheck className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} /> Aadhaar verified
              </span>
            )}
          </div>

          {/* Identity block */}
          <div className={cn("min-w-0 flex-1", compact ? "space-y-2" : "space-y-3")}>
            <Field label="Name" labelHindi="नाम" compact={compact}>
              <p className={cn("font-bold leading-tight text-slate-900", compact ? "text-[15px]" : "text-[20px]")}>{data.name}</p>
              {data.nameHindi && (
                <p className={cn("font-bold leading-tight text-slate-900", compact ? "text-[13px]" : "text-[18px]")} style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}>
                  {data.nameHindi}
                </p>
              )}
            </Field>

            <Field label="Abha Number" labelHindi="आभा-संख्या" compact={compact}>
              <p className={cn("font-bold leading-tight tracking-wide text-slate-900", compact ? "text-[17px]" : "text-[24px]")}>{data.abhaNumber}</p>
            </Field>

            <Field label="Abha Address" labelHindi="आभा पता" compact={compact}>
              <p className={cn("font-bold leading-tight text-slate-900 break-all", compact ? "text-[14px]" : "text-[20px]")}>{data.abhaAddress}</p>
            </Field>
          </div>

          {/* QR */}
          <div className="shrink-0 self-start">
            <QRCodeSVG value={qrPayload} size={compact ? 76 : 132} level="M" marginSize={0} />
          </div>
        </div>

        {/* Demographics row */}
        <div className={cn("grid grid-cols-3", compact ? "mt-4 gap-3" : "mt-7 gap-4")}>
          <Field label="Gender" labelHindi="लिंग" compact={compact}>
            <p className={cn("font-bold text-slate-900", compact ? "text-[13px]" : "text-[17px]")}>
              {data.gender}
              {data.genderHindi && (
                <>
                  {" / "}
                  <span style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}>{data.genderHindi}</span>
                </>
              )}
            </p>
          </Field>
          <Field label="Date Of Birth" labelHindi="जन्मतिथि" compact={compact}>
            <p className={cn("font-bold text-slate-900", compact ? "text-[13px]" : "text-[17px]")}>{data.dob}</p>
          </Field>
          <Field label="Mobile" labelHindi="मोबाइल" compact={compact}>
            <p className={cn("font-bold text-slate-900", compact ? "text-[13px]" : "text-[17px]")}>{data.mobile}</p>
          </Field>
        </div>

        {/* Guardian + address */}
        {(data.fathersName || data.address) && (
          <div className={cn("grid grid-cols-3 border-t border-slate-100", compact ? "mt-4 gap-3 pt-3" : "mt-5 gap-4 pt-4")}>
            {data.fathersName && (
              <Field label="Father's Name" labelHindi="पिता का नाम" compact={compact}>
                <p className={cn("font-bold text-slate-900", compact ? "text-[12px]" : "text-[15px]")}>{data.fathersName}</p>
              </Field>
            )}
            {data.address && (
              <div className="col-span-2">
                <Field label="Address" labelHindi="पता" compact={compact}>
                  <p className={cn("font-semibold leading-snug text-slate-800", compact ? "text-[11.5px]" : "text-[13.5px]")}>
                    {[data.address, data.district, data.state].filter(Boolean).join(", ")}{data.pincode ? ` – ${data.pincode}` : ""}
                  </p>
                </Field>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const INSTRUCTIONS: { en: React.ReactNode; hi: string }[] = [
  {
    en: "With this ABHA you have become a part of India's digital health ecosystem.",
    hi: "इस आभा के साथ आप भारत के डिजिटल हेल्थ इकोसिस्टम का हिस्सा बन गए हैं।",
  },
  {
    en: "ABHA provides you a unique identification and helps in storing - safekeeping all your digital health records at one place.",
    hi: "आभा आपको एक विशिष्ट पहचान प्रदान करता है और आपके सभी डिजिटल स्वास्थ्य रिकॉर्ड को सुरक्षित एक ही स्थान पर संग्रहीत रखने में मदद करता है।",
  },
  {
    en: "You can download the ABHA mobile app, Aarogya Setu or other ABDM enabled app to view and share your digital health records with ABDM registered healthcare service providers.",
    hi: "आप एबीडीएम पंजीकृत स्वास्थ्य सेवा प्रदाताओं के साथ अपने डिजिटल स्वास्थ्य रिकॉर्ड देखने और साझा करने के लिए आभा मोबाइल ऐप, आरोग्य सेतु या अन्य एबीडीएम सक्षम ऐप डाउनलोड कर सकते हैं।",
  },
  {
    en: (
      <>
        If this card is lost kindly download it from{" "}
        <span style={{ color: ABHA_LINK }}>www.abha.abdm.gov.in</span>, it is digitally acceptable.
      </>
    ),
    hi: "यदि यह कार्ड खो जाता है तो कृपया इसे www.abha.abdm.gov.in से डाउनलोड करें, यह डिजिटल रूप से स्वीकार्य है।",
  },
]

function AbhaCardBack({ compact }: { compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader compact={compact} />
      <div className={compact ? "px-4 py-4" : "px-6 py-5"}>
        <div className="flex items-center justify-between gap-2">
          <p className={cn("font-bold text-slate-900", compact ? "text-[12px]" : "text-[15px]")}>Instructions</p>
          <p className={cn("font-bold text-slate-900", compact ? "text-[11px]" : "text-[15px]")}>Toll-Free: 1800 114 477</p>
        </div>
        <ul className={cn(compact ? "mt-3 space-y-2" : "mt-4 space-y-3")}>
          {INSTRUCTIONS.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
              <div className="space-y-0.5">
                <p className={cn("leading-snug text-slate-800", compact ? "text-[11px]" : "text-[12.5px]")}>{item.en}</p>
                <p className={cn("leading-snug text-slate-800", compact ? "text-[11px]" : "text-[12.5px]")} style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}>
                  {item.hi}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function AbhaCard({ data, showBack = true, compact = false, className }: AbhaCardProps) {
  const merged = { ...DEFAULT_DATA, ...data }
  return (
    <div className={cn("mx-auto w-full", compact ? "max-w-full space-y-3" : "max-w-[680px] space-y-5", className)}>
      <AbhaCardFront data={merged} compact={compact} />
      {showBack && <AbhaCardBack compact={compact} />}
    </div>
  )
}
