"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { QrCode, ExternalLink, Share2 } from "lucide-react"
import { usePatientStore } from "@/store/usePatientStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useFamilyTokenStore } from "@/store/useFamilyTokenStore"

export function FamilyTrackingCard() {
  const router = useRouter()
  const currentUser = useAuthStore(s => s.currentUser)
  const patients = usePatientStore(s => s.patients)
  const me = patients.find(p => p.id === currentUser?.id)
  // M13.11 — Public WhatsApp-style page; same URL we SMS to the attendant
  // at ER registration. The link now carries a consented, time-boxed access
  // token (?t=…) so the UHID alone can't open the page.
  const uhid = me?.id ?? currentUser?.id ?? 'PT-20394'
  const issue = useFamilyTokenStore(s => s.issue)
  const record = useFamilyTokenStore(s => s.records[uhid.toUpperCase()])
  // Ensure a consented token exists for the patient's own share link.
  useEffect(() => {
    if (uhid && (!record || record.expiresAt <= Date.now())) {
      issue(uhid, me?.name ?? 'Patient', { consent: true, issuedBy: currentUser?.id })
    }
  }, [uhid, record, me?.name, currentUser?.id, issue])
  const query = record?.token ? `?t=${record.token}` : ''
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/p/${uhid}${query}`
    : `/p/${uhid}${query}`

  const share = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'My live status', text: 'Track me at Agentix HIMS', url })
    } else if (typeof navigator !== 'undefined') {
      navigator.clipboard?.writeText(url)
    }
  }

  return (
    <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-xl bg-[rgba(238,107,38,0.07)] flex items-center justify-center"><QrCode className="h-4.5 w-4.5 text-[var(--color-accent)]" /></span>
        <div>
          <h3 className="text-[15px] font-bold text-slate-900 leading-tight">Family live tracking</h3>
          <p className="text-[12px] text-slate-400">Let your family follow your visit — no medical data</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100 flex-shrink-0">
          <QRCodeSVG value={url} size={78} bgColor="#F8FAFC" fgColor="#0F172A" level="M" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] text-slate-500 mb-2">They&apos;ll see your ward, condition &amp; wait time — and can request a live room view (nurse-approved).</p>
          <p className="text-[10px] text-slate-400 font-mono mb-2 break-all">{url}</p>
          <div className="flex gap-2">
            <button onClick={() => router.push(`/p/${uhid}${query}`)}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-emerald-600 px-3 py-2 rounded-xl active:scale-95 transition-transform">
              <ExternalLink className="h-3.5 w-3.5" /> Open family view
            </button>
            <button onClick={share}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-600 bg-slate-100 px-3 py-2 rounded-xl active:scale-95 transition-transform">
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
