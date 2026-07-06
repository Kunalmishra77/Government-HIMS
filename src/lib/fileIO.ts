/* M8 — File upload / download helpers.
 *
 * Phase-1 mock: uploadFile() reads the file as a base64 string and stores
 * it in the FileMetaStore so the UI can show "uploaded" + preview. No real
 * server. downloadAs() generates an in-browser blob and triggers a download
 * for receipts / discharge summaries / payslips. Phase-2 swap: uploadFile
 * → presigned POST to S3 / Blob; downloadAs unchanged.
 */

export interface UploadResult {
  id: string
  filename: string
  size: number
  mime: string
  uploadedAt: string
  /** Object URL — valid for this session only. */
  url: string
}

/** Upload a single File from an <input type=file>. Async because real-world swap will be. */
export async function uploadFile(file: File): Promise<UploadResult> {
  // Use createObjectURL so the UI can render the file (image preview, anchor href).
  const url = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : ''
  return {
    id: `FILE-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    filename: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
    url,
  }
}

/** Trigger a browser download of a Blob with the given filename. */
export function downloadAs(filename: string, blob: Blob): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 0)
}

/** Convenience: download a UTF-8 text file (CSV, TXT, etc.). */
export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  downloadAs(filename, new Blob([text], { type: mime }))
}

/** Builds a branded, print-optimised HTML document for Agentix HIMS and opens the print dialog. */
export function printableHtml(title: string, bodyHtml: string): void {
  if (typeof window === 'undefined') return
  const w = window.open('', title, 'width=780,height=980')
  if (!w) return
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const tsStr  = now.toLocaleString('en-IN')
  w.document.write(`<!doctype html><html><head>
<meta charset="utf-8">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter','Segoe UI',system-ui,sans-serif;background:#f1f5f9;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:760px;margin:0 auto;background:#fff;min-height:100vh;box-shadow:0 4px 24px rgba(15,23,42,.10)}

  /* ── Header ── */
  .doc-hdr{background:linear-gradient(135deg,#0D2032 0%,#C2481A 55%,#EE6B26 100%);padding:26px 36px 22px;display:flex;justify-content:space-between;align-items:flex-start}
  .brand{display:flex;flex-direction:column;gap:4px}
  .brand-name{font-size:21px;font-weight:800;color:#fff;letter-spacing:-0.3px}
  .brand-name em{color:rgba(255,255,255,.55);font-style:normal}
  .brand-sub{font-size:10.5px;color:rgba(255,255,255,.6);font-weight:500;letter-spacing:.4px}
  .doc-meta{text-align:right}
  .doc-kind{font-size:13px;font-weight:700;color:#fff;background:rgba(255,255,255,.15);display:inline-block;padding:3px 10px;border-radius:20px;margin-bottom:5px}
  .doc-date{font-size:11px;color:rgba(255,255,255,.7)}

  /* ── Divider ── */
  .doc-divider{height:4px;background:linear-gradient(90deg,#C2481A,#EE6B26,#F58C4E)}

  /* ── Body ── */
  .doc-body{padding:28px 36px 36px}

  /* Info chip row */
  .info-row{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px;padding:14px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0}
  .info-item{display:flex;flex-direction:column;gap:2px}
  .info-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8}
  .info-value{font-size:13px;font-weight:600;color:#0f172a}

  /* Section headings inside body */
  h3{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#B84A16;margin:20px 0 8px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}

  /* Tables */
  table{width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:13px}
  thead th{background:#f1f5f9;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;padding:9px 10px;text-align:left;border-bottom:2px solid #e2e8f0}
  thead th[style*="right"]{text-align:right}
  tbody td{padding:9px 10px;border-bottom:1px solid #f1f5f9;color:#1e293b;vertical-align:top;line-height:1.5}
  tbody tr:last-child td{border-bottom:none}
  .total td,.total-row td{font-weight:700;font-size:14.5px;color:#0f172a;background:#FFF3EC;border-top:2px solid #EE6B26!important;border-bottom:none!important}
  td[style*="right"]{text-align:right}

  /* Paragraphs */
  p{font-size:13px;line-height:1.65;color:#334155;margin:5px 0}
  p b,.bold{color:#0f172a;font-weight:600}
  .muted{font-size:11px;color:#94a3b8;margin-top:3px}

  ul,ol{padding-left:18px;margin:6px 0}
  li{font-size:13px;line-height:1.6;color:#334155;margin:2px 0}
  .warn-li{color:#dc2626}

  /* Highlighted block (addendum) */
  .highlight-block{background:#fef9c3;border-left:3px solid #eab308;padding:10px 14px;border-radius:0 8px 8px 0;font-size:13px;margin:8px 0}

  /* ── Footer ── */
  .doc-ftr{margin-top:32px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
  .doc-ftr-left{font-size:10px;color:#94a3b8;line-height:1.5}
  .doc-ftr-badge{font-size:10px;font-weight:700;color:#B84A16;background:#FFF3EC;border:1px solid #FBD5BC;padding:3px 10px;border-radius:20px}

  @media print{
    body{background:white}
    .page{max-width:none;box-shadow:none}
    .doc-hdr{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style>
</head><body>
<div class="page">
  <div class="doc-hdr">
    <div class="brand">
      <div class="brand-name">Agentix HIMS <em>HIMS</em></div>
      <div class="brand-sub">AI-First Hospital Information &amp; Management System</div>
    </div>
    <div class="doc-meta">
      <div class="doc-kind">${title}</div>
      <div class="doc-date">${dateStr}</div>
    </div>
  </div>
  <div class="doc-divider"></div>
  <div class="doc-body">
    ${bodyHtml}
    <div class="doc-ftr">
      <div class="doc-ftr-left">System-generated · ${tsStr}<br>Agentix HIMS · Confidential — for authorised use only</div>
      <div class="doc-ftr-badge">&#10003; Verified Document</div>
    </div>
  </div>
</div>
</body></html>`)
  w.document.close()
  setTimeout(() => { try { w.print() } catch { /* ignore */ } }, 350)
}
