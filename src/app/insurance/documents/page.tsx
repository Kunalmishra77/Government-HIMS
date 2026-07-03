"use client"

import { useState } from "react"
import { Upload, CheckCircle, AlertCircle, FileText, X } from "lucide-react"
import { toast } from "sonner"
import { uploadFile } from "@/lib/fileIO"
import { notifyAndAudit } from "@/lib/notifyAndAudit"

type DocStatus = 'required' | 'uploaded' | 'verified' | 'rejected'

interface RequiredDoc {
  id: string
  name: string
  description: string
  mandatory: boolean
  status: DocStatus
  uploadedFile?: string
  rejectionReason?: string
}

const INITIAL_DOCS: RequiredDoc[] = [
  { id: 'D-001', name: 'Admission Summary', description: 'Treating physician-signed admission note', mandatory: true, status: 'required' },
  { id: 'D-002', name: 'Pre-Auth Letter', description: 'Insurance pre-authorisation approval letter', mandatory: true, status: 'required' },
  { id: 'D-003', name: 'Lab Reports', description: 'All pathology and blood work reports', mandatory: true, status: 'uploaded', uploadedFile: 'lab_reports_kiran.pdf' },
  { id: 'D-004', name: 'Imaging Reports', description: 'X-ray, CT, MRI, USG reports', mandatory: true, status: 'verified', uploadedFile: 'imaging_kiran.pdf' },
  { id: 'D-005', name: 'OT Notes', description: 'Anaesthesia and surgical notes (if procedure done)', mandatory: false, status: 'required' },
  { id: 'D-006', name: 'Discharge Summary', description: 'Finalised discharge summary with physician signature', mandatory: true, status: 'required' },
  { id: 'D-007', name: 'Pharmacy Bills', description: 'Itemised pharmacy bills for the stay', mandatory: true, status: 'uploaded', uploadedFile: 'pharmacy_bills.pdf' },
  { id: 'D-008', name: 'Indoor Case Papers', description: 'Complete IPD case paper file', mandatory: false, status: 'rejected', rejectionReason: 'Illegible scan — re-upload required', uploadedFile: 'icp_old.pdf' },
  { id: 'D-009', name: 'Patient Consent Forms', description: 'Signed consent for procedure and data sharing', mandatory: true, status: 'verified', uploadedFile: 'consent_kiran.pdf' },
  { id: 'D-010', name: 'Insurance Policy Copy', description: 'Current policy document or e-card', mandatory: true, status: 'verified', uploadedFile: 'policy_doc.pdf' },
]

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; icon: React.ElementType }> = {
  required:  { label: 'Required',  color: 'bg-slate-100 text-slate-600',   icon: AlertCircle },
  uploaded:  { label: 'Uploaded',  color: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]',     icon: FileText },
  verified:  { label: 'Verified',  color: 'bg-green-100 text-green-700',   icon: CheckCircle },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-700',       icon: X },
}

export default function InsuranceDocumentsPage() {
  const [docs, setDocs] = useState<RequiredDoc[]>(INITIAL_DOCS)

  // M10-F — real file upload (mock backend). Caller picks a real file via
  // a hidden <input type="file">. We store the filename + object URL.
  const handleUpload = async (id: string, file: File) => {
    const result = await uploadFile(file)
    setDocs((prev) => prev.map((d) => d.id === id
      ? { ...d, status: 'uploaded', uploadedFile: result.filename, rejectionReason: undefined }
      : d
    ))
    const doc = docs.find(d => d.id === id)
    notifyAndAudit({
      to: 'admin', type: 'system', priority: 'low',
      title: `Insurance doc uploaded · ${doc?.name ?? id}`,
      body: `${result.filename} (${Math.round(result.size / 1024)} KB) uploaded for ${doc?.name ?? id}.`,
      audit: { action: 'insurance_doc_upload', resource: 'insurance_document', resourceId: id, detail: `Uploaded ${result.filename}`, userName: 'Insurance desk' },
    })
    toast.success(`Uploaded ${result.filename} · awaiting insurer verification`)
  }
  const simulateUpload = (id: string) => {
    // Fallback: simulates a successful upload without picking a file.
    setDocs((prev) => prev.map((d) => d.id === id
      ? { ...d, status: 'uploaded', uploadedFile: `${d.name.toLowerCase().replace(/\s+/g, '_')}_upload.pdf`, rejectionReason: undefined }
      : d
    ))
    toast.success('File uploaded — pending insurer verification')
  }

  const mandatory = docs.filter((d) => d.mandatory)
  const allMandatoryMet = mandatory.every((d) => d.status === 'uploaded' || d.status === 'verified')
  const verifiedCount = docs.filter((d) => d.status === 'verified').length
  const pendingCount = docs.filter((d) => d.status === 'required' || d.status === 'rejected').length

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Claim Documents</h2>
          <p className="text-slate-500 text-sm mt-1">Upload and manage required insurance claim documents</p>
        </div>
        {allMandatoryMet ? (
          <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-100 px-3 py-1.5 rounded-full border border-green-200">
            <CheckCircle className="h-3.5 w-3.5" /> Ready to Submit
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full border border-amber-200">
            <AlertCircle className="h-3.5 w-3.5" /> {pendingCount} Documents Pending
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-bold text-green-800/60 uppercase tracking-wide mb-1">Verified</p>
          <p className="text-2xl font-black text-slate-900">{verifiedCount}</p>
        </div>
        <div className="bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.20)] rounded-xl p-4">
          <p className="text-xs font-bold text-[var(--color-primary-dark)]/60 uppercase tracking-wide mb-1">Uploaded</p>
          <p className="text-2xl font-black text-slate-900">{docs.filter((d) => d.status === 'uploaded').length}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-bold text-red-800/60 uppercase tracking-wide mb-1">Action Needed</p>
          <p className="text-2xl font-black text-slate-900">{pendingCount}</p>
        </div>
      </div>

      <div className="space-y-2">
        {docs.map((doc) => {
          const cfg = STATUS_CONFIG[doc.status]
          const Icon = cfg.icon
          return (
            <div key={doc.id} className={`bg-white rounded-xl border p-4 ${doc.status === 'rejected' ? 'border-red-200' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.status === 'verified' ? 'bg-green-100' : doc.status === 'rejected' ? 'bg-red-100' : 'bg-slate-100'}`}>
                    <FileText className={`h-4 w-4 ${doc.status === 'verified' ? 'text-green-600' : doc.status === 'rejected' ? 'text-red-600' : 'text-slate-500'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm">{doc.name}</p>
                      {doc.mandatory && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">Required</span>
                      )}
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                        <Icon className="h-3 w-3" />{cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{doc.description}</p>
                    {doc.uploadedFile && (
                      <p className="text-xs text-[var(--color-accent)] mt-1 flex items-center gap-1">
                        <FileText className="h-3 w-3" />{doc.uploadedFile}
                      </p>
                    )}
                    {doc.rejectionReason && (
                      <p className="text-xs text-red-600 mt-1 font-medium">⚠ {doc.rejectionReason}</p>
                    )}
                  </div>
                </div>

                {(doc.status === 'required' || doc.status === 'rejected') && (
                  <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors flex-shrink-0 cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    {doc.status === 'rejected' ? 'Re-upload' : 'Upload'}
                    <input type="file" className="hidden" accept="application/pdf,image/*"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(doc.id, f); e.currentTarget.value = '' }} />
                  </label>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {allMandatoryMet && (
        <button
          onClick={() => toast.success('Claim package submitted to insurer — reference: CLM-2026-' + Math.floor(Math.random() * 9000 + 1000))}
          className="w-full py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          Submit Complete Claim Package
        </button>
      )}
    </div>
  )
}
