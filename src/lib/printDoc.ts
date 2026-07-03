// Browser-print document generator (no dependencies). Builds a standalone,
// self-styled HTML document for a prescription / discharge summary / referral,
// stamped with the doctor's e-signature, and opens the print dialog.

export type PrintDoc = {
  kind: 'Prescription' | 'Discharge Summary' | 'Referral Letter'
  patient: string
  patientMeta?: string        // e.g. "PT-20394 · 55y / Male"
  doctor: string
  signature: string
  date?: string
  bodyHtml: string            // pre-built inner HTML for the body
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function buildDocHtml(doc: PrintDoc): string {
  const date = doc.date ?? new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  return `<!doctype html><html><head>
<meta charset="utf-8">
<title>${esc(doc.kind)} — ${esc(doc.patient)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter','Segoe UI',system-ui,sans-serif;color:#1e293b;background:#f1f5f9;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:720px;margin:0 auto;background:#fff;min-height:100vh;box-shadow:0 4px 24px rgba(15,23,42,.10)}
  .doc-hdr{background:linear-gradient(135deg,#0D2032 0%,#C2481A 55%,#EE6B26 100%);padding:24px 32px 20px;display:flex;justify-content:space-between;align-items:flex-start}
  .brand-name{font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.3px}
  .brand-name em{color:rgba(255,255,255,.55);font-style:normal}
  .brand-sub{font-size:10px;color:rgba(255,255,255,.6);margin-top:3px;font-weight:500}
  .doc-kind{font-size:12px;font-weight:700;color:#fff;background:rgba(255,255,255,.15);padding:3px 10px;border-radius:20px;margin-bottom:5px;display:inline-block}
  .doc-date{font-size:11px;color:rgba(255,255,255,.7);text-align:right}
  .divider{height:4px;background:linear-gradient(90deg,#C2481A,#EE6B26,#F58C4E)}
  .doc{padding:24px 32px 36px}
  .meta{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding:14px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;font-size:13px}
  .meta b{color:#0f172a;font-size:14px;font-weight:700}
  .meta .lbl{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:3px}
  .body{font-size:14px;line-height:1.65;white-space:pre-wrap}
  .body h3{font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;color:#B84A16;margin:18px 0 7px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
  .body ol{margin:6px 0;padding-left:20px}
  .body li{margin:3px 0;color:#334155}
  .sign{margin-top:52px;text-align:right;padding-top:20px;border-top:1px solid #e2e8f0}
  .sign .line{font-family:'Segoe Script',cursive;font-size:19px;color:#0f172a}
  .sign .name{font-size:11px;color:#64748b;border-top:1px solid #cbd5e1;display:inline-block;padding-top:4px;margin-top:6px}
  .foot{margin-top:24px;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid #e2e8f0}
  .foot-badge{font-size:10px;font-weight:700;color:#B84A16;background:#FFF3EC;border:1px solid #FBD5BC;padding:2px 8px;border-radius:20px}
  @media print{body{background:white}.page{max-width:none;box-shadow:none}.doc-hdr{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head>
<body><div class="page">
  <div class="doc-hdr">
    <div>
      <div class="brand-name">Agentix HIMS <em>HIMS</em></div>
      <div class="brand-sub">AI-First Hospital Information &amp; Management System</div>
    </div>
    <div style="text-align:right"><div class="doc-kind">${esc(doc.kind)}</div><div class="doc-date">${esc(date)}</div></div>
  </div>
  <div class="divider"></div>
  <div class="doc">
    <div class="meta">
      <div><div class="lbl">Patient</div><b>${esc(doc.patient)}</b>${doc.patientMeta ? `<br><span style="font-size:12px;color:#64748b">${esc(doc.patientMeta)}</span>` : ''}</div>
      <div style="text-align:right"><div class="lbl">Consultant</div><b>${esc(doc.doctor)}</b></div>
    </div>
    <div class="body">${doc.bodyHtml}</div>
    <div class="sign"><div class="line">${esc(doc.signature)}</div><div class="name">${esc(doc.signature)}</div></div>
    <div class="foot"><span>Digitally generated · ${new Date().toLocaleString('en-IN')}<br>Verify clinically before clinical action.</span><span class="foot-badge">&#10003; Agentix HIMS</span></div>
  </div>
</div></body></html>`
}

export function openPrint(doc: PrintDoc): boolean {
  const html = buildDocHtml(doc)
  const w = window.open('', '_blank', 'width=820,height=1000')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  w.focus()
  // Let layout settle before invoking print.
  setTimeout(() => { try { w.print() } catch { /* ignore */ } }, 300)
  return true
}

// Helpers to turn structured data into body HTML.
export const olFrom = (items: string[]) => `<ol>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ol>`
export const para = (label: string, text: string) => `<h3>${esc(label)}</h3>${esc(text)}`
export const pre = (text: string) => esc(text)
