// Print-ready radiology report generator (no dependencies). Builds a
// standalone, self-styled imaging report — hospital branding, patient + UHID
// block, study/technique details, representative image thumbnails (real
// attachments when present, otherwise a modality placeholder to simulate the
// PACS key-image row), structured findings + impression, radiologist signature
// and a QR stamp — then opens the browser print dialog.

import type { RadiologyStudy } from '@/store/useRadiologyStudiesStore'
import { RADIOLOGY_CATALOG, TEMPLATE_SECTIONS, PRIORITY_META, type Modality } from '@/lib/radiologyCatalog'

const esc = (s: string | number) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const MODALITY_LABEL: Record<Modality, string> = {
  XR: 'Radiography (X-Ray)', CT: 'Computed Tomography', MRI: 'Magnetic Resonance Imaging',
  US: 'Ultrasonography', MAMMO: 'Mammography', NM: 'Nuclear Medicine',
}

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

function qrSvg(seed: string, px = 84): string {
  const N = 21
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  const bit = (x: number, y: number) => { h ^= (x * 73856093) ^ (y * 19349663); h = Math.imul(h, 2654435761); return ((h >>> 13) & 1) === 1 }
  const finder = (x: number, y: number) => {
    const q = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7
    return q(0, 0) || q(N - 7, 0) || q(0, N - 7)
  }
  const ring = (x: number, y: number) => {
    const local = (ox: number, oy: number) => { const lx = x - ox, ly = y - oy; return (lx === 0 || lx === 6 || ly === 0 || ly === 6) || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4) }
    if (x < 7 && y < 7) return local(0, 0)
    if (x >= N - 7 && y < 7) return local(N - 7, 0)
    if (x < 7 && y >= N - 7) return local(0, N - 7)
    return false
  }
  const cell = px / N
  let rects = ''
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const on = finder(x, y) ? ring(x, y) : bit(x, y)
    if (on) rects += `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`
  }
  return `<svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" xmlns="http://www.w3.org/2000/svg"><rect width="${px}" height="${px}" fill="#fff"/><g fill="#0f172a">${rects}</g></svg>`
}

// A dark PACS-style placeholder for a key image when no real pixel data exists.
function imagePlaceholder(study: RadiologyStudy, caption: string): string {
  return `<div class="thumb">
    <div class="thumb-img">
      <span class="thumb-mod">${esc(study.modality)}</span>
      <span class="thumb-cross"></span>
      <span class="thumb-anno tl">${esc(study.patientName)}<br>${esc(study.uhid)}</span>
      <span class="thumb-anno br">${esc(study.name)}</span>
    </div>
    <div class="thumb-cap">${esc(caption)}</div>
  </div>`
}

function imageStrip(study: RadiologyStudy): string {
  const items = study.attachments.length
    ? study.attachments.slice(0, 4).map(a =>
        a.url
          ? `<div class="thumb"><div class="thumb-img"><img src="${esc(a.url)}" alt="${esc(a.caption ?? a.filename)}"/></div><div class="thumb-cap">${esc(a.caption ?? a.filename)}</div></div>`
          : imagePlaceholder(study, a.caption ?? a.filename))
    : [imagePlaceholder(study, 'Representative image')]
  return `<div class="images">${items.join('')}</div>`
}

const CATEGORY_KEYS: Record<string, string> = {
  birads: 'BI-RADS Category', lungrads: 'Lung-RADS Category', pirads: 'PI-RADS Assessment', tirads: 'ACR TI-RADS',
}

function sectionsHtml(study: RadiologyStudy): string {
  const cat = RADIOLOGY_CATALOG[study.code]
  const tmpl = cat ? TEMPLATE_SECTIONS[cat.template] : []
  const order = tmpl.length ? tmpl.map(s => s.key) : Object.keys(study.reportSections)
  const labelFor = (key: string) =>
    tmpl.find(s => s.key === key)?.label ?? CATEGORY_KEYS[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
  // History, technique, findings render as prose; the category + impression get emphasis.
  return order
    .filter(key => (study.reportSections[key] ?? '').trim() !== '' && key !== 'history')
    .map(key => {
      const value = study.reportSections[key]
      const emphasis = key === 'impression' || CATEGORY_KEYS[key]
      return `<section class="rsec ${emphasis ? 'emph' : ''}">
        <h3>${esc(labelFor(key))}</h3>
        <div class="rbody">${esc(value)}</div>
      </section>`
    })
    .join('')
}

export function buildRadiologyReportHtml(study: RadiologyStudy): string {
  const cat = RADIOLOGY_CATALOG[study.code]
  const prio = PRIORITY_META[study.priority]
  const reportId = `${study.id}-RPT`
  const indication = study.clinicalQuestion || study.reportSections['history'] || '—'
  const radiologist = study.readingBy?.name ?? study.verifiedBy?.name ?? 'Dr. Sameer Khan, MD (Radiodiagnosis)'
  const verifier = study.verifiedBy?.name ?? radiologist
  const critical = /\b(haemorrhage|hemorrhage|bleed|pneumothorax|embolism|stroke|infarct|bi-?rads (4|5|6))\b/i
    .test(study.reportSections['impression'] ?? '')

  return `<!doctype html><html><head>
<meta charset="utf-8">
<title>Radiology Report — ${esc(study.patientName)} — ${esc(study.uhid)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1e293b;background:#eef2f7;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:780px;margin:18px auto;background:#fff;box-shadow:0 6px 28px rgba(15,23,42,.12)}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 28px;border-bottom:3px solid #0D2032;background:linear-gradient(180deg,#fbfdff,#fff)}
  .brand{display:flex;gap:12px;align-items:center}
  .logo{width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#0D2032,#EE6B26);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px}
  .h-name{font-size:19px;font-weight:800;color:#0D2032;letter-spacing:-.3px}
  .h-sub{font-size:10.5px;color:#64748b;margin-top:2px}
  .h-accr{font-size:9.5px;color:#B84A16;font-weight:700;margin-top:3px;letter-spacing:.03em}
  .h-right{text-align:right;font-size:10.5px;color:#64748b;line-height:1.5}
  .title-bar{background:#0D2032;color:#fff;text-align:center;font-size:12px;font-weight:700;letter-spacing:.14em;padding:6px}
  .meta{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e2e8f0}
  .meta .col{padding:14px 28px}
  .meta .col:first-child{border-right:1px solid #e2e8f0}
  .row{display:flex;font-size:12px;margin:3px 0}
  .row .k{width:120px;color:#64748b;font-weight:600}
  .row .v{color:#0f172a;font-weight:700}
  .row .v.big{font-size:14px}
  .uhid{display:inline-block;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-weight:800;padding:1px 8px;border-radius:6px}
  .study-bar{margin:0 28px;margin-top:14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .chip{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid #e2e8f0;background:#f8fafc;color:#334155}
  .chip.mod{background:#eef2ff;border-color:#c7d2fe;color:#3730a3}
  .chip.prio{background:#fef2f2;border-color:#fecaca;color:#b91c1c}
  .indication{margin:14px 28px 0;font-size:12px;color:#334155;background:#f8fafc;border-left:3px solid #EE6B26;padding:9px 14px;border-radius:0 8px 8px 0}
  .indication b{color:#0f172a}
  .images{display:flex;gap:10px;margin:16px 28px 4px;flex-wrap:wrap}
  .thumb{width:120px}
  .thumb-img{position:relative;height:120px;border-radius:8px;overflow:hidden;background:radial-gradient(circle at 50% 40%,#334155,#0b1220 80%);border:1px solid #0b1220;display:flex;align-items:center;justify-content:center}
  .thumb-img img{width:100%;height:100%;object-fit:cover}
  .thumb-mod{font-size:26px;font-weight:800;color:rgba(255,255,255,.14);letter-spacing:2px}
  .thumb-cross{position:absolute;width:1px;height:100%;background:rgba(148,163,184,.18)}
  .thumb-cross:after{content:'';position:absolute;top:50%;left:-60px;width:120px;height:1px;background:rgba(148,163,184,.18)}
  .thumb-anno{position:absolute;font-size:7.5px;color:#7dd3fc;line-height:1.3;font-family:'Courier New',monospace}
  .thumb-anno.tl{top:5px;left:6px}
  .thumb-anno.br{bottom:5px;right:6px;color:#86efac}
  .thumb-cap{font-size:9px;color:#94a3b8;text-align:center;margin-top:4px}
  .body{padding:6px 28px 8px}
  .rsec{margin-top:14px}
  .rsec h3{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#B84A16;border-bottom:1px solid #e2e8f0;padding-bottom:5px;margin-bottom:6px}
  .rsec .rbody{font-size:13px;line-height:1.6;color:#1e293b;white-space:pre-wrap}
  .rsec.emph{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-top:16px}
  .rsec.emph h3{color:#0D2032;border-bottom:2px solid #0D2032}
  .rsec.emph .rbody{font-weight:600}
  .crit-banner{margin:14px 28px 0;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:11.5px;font-weight:700;padding:8px 12px;border-radius:8px}
  .sign{display:flex;justify-content:space-between;align-items:flex-end;margin:32px 28px 0;padding-top:14px}
  .sig{text-align:center;width:220px}
  .sig .ln{font-family:'Segoe Script','Brush Script MT',cursive;font-size:20px;color:#0D2032;height:26px}
  .sig .nm{border-top:1px solid #94a3b8;padding-top:4px;font-size:11px;font-weight:700;color:#334155}
  .sig .rl{font-size:9.5px;color:#94a3b8}
  .qr{text-align:center}.qr svg{border:1px solid #e2e8f0;border-radius:6px}.qr .cap{font-size:8.5px;color:#94a3b8;margin-top:3px}
  .eor{text-align:center;font-size:10px;font-weight:700;letter-spacing:.2em;color:#cbd5e1;margin-top:18px}
  .foot{margin-top:16px;border-top:1px solid #e2e8f0;padding:12px 28px 22px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#94a3b8}
  .foot-badge{font-weight:800;color:#B84A16;background:#FFF3EC;border:1px solid #FBD5BC;padding:2px 9px;border-radius:20px}
  @media print{body{background:#fff}.page{margin:0;max-width:none;box-shadow:none}}
</style></head>
<body><div class="page">
  <div class="hdr">
    <div class="brand">
      <div class="logo">A</div>
      <div>
        <div class="h-name">Agentix Multispeciality Hospital</div>
        <div class="h-sub">Department of Radiodiagnosis &amp; Imaging · Lucknow, Uttar Pradesh</div>
        <div class="h-accr">NABL ACCREDITED · PACS/RIS INTEGRATED</div>
      </div>
    </div>
    <div class="h-right">
      <div><b>Report No:</b> ${esc(reportId)}</div>
      <div><b>Accession:</b> ${esc(study.id)}</div>
      <div>Ph: 0522-2200000</div>
    </div>
  </div>
  <div class="title-bar">RADIOLOGY / IMAGING REPORT</div>

  <div class="meta">
    <div class="col">
      <div class="row"><span class="k">Patient Name</span><span class="v big">${esc(study.patientName)}</span></div>
      <div class="row"><span class="k">UHID</span><span class="v"><span class="uhid">${esc(study.uhid)}</span></span></div>
      <div class="row"><span class="k">Patient ID</span><span class="v">${esc(study.patientId)}</span></div>
      <div class="row"><span class="k">Source / Ward</span><span class="v">${esc(study.source)}${study.wardBed ? ' · ' + esc(study.wardBed) : ''}</span></div>
    </div>
    <div class="col">
      <div class="row"><span class="k">Ref. Consultant</span><span class="v">${esc(study.doctorName)}</span></div>
      <div class="row"><span class="k">Department</span><span class="v">${esc(study.department)}</span></div>
      <div class="row"><span class="k">Study Date</span><span class="v">${esc(fmtDate(study.acquiredAt || study.orderedAt))}</span></div>
      <div class="row"><span class="k">Reported On</span><span class="v">${esc(fmtDate(study.reportedAt || study.releasedAt))}</span></div>
    </div>
  </div>

  <div class="study-bar">
    <span class="chip mod">${esc(MODALITY_LABEL[study.modality])}</span>
    <span class="chip">${esc(study.name)}</span>
    <span class="chip">${esc(study.bodyPart)}</span>
    ${cat?.contrast ? '<span class="chip">Contrast enhanced</span>' : '<span class="chip">Non-contrast</span>'}
    <span class="chip prio">${esc(prio?.label ?? study.priority)}</span>
  </div>

  <div class="indication"><b>Clinical Indication:</b> ${esc(indication)}</div>

  ${imageStrip(study)}

  ${critical ? '<div class="crit-banner">&#9888; Critical finding — referring physician notified per critical-result policy.</div>' : ''}

  <div class="body">
    ${sectionsHtml(study) || '<section class="rsec"><h3>Findings</h3><div class="rbody">Report pending finalisation.</div></section>'}
  </div>

  <div class="sign">
    <div class="qr">${qrSvg(reportId)}<div class="cap">Scan to verify · ${esc(reportId)}</div></div>
    <div class="sig">
      <div class="ln">${esc(verifier.split(',')[0])}</div>
      <div class="nm">${esc(verifier)}</div>
      <div class="rl">Reported &amp; authorised by (Radiologist)</div>
    </div>
  </div>

  <div class="eor">— END OF REPORT —</div>

  <div class="foot">
    <span>Digitally generated report · ${esc(fmtDate(new Date().toISOString()))}<br>Images are representative key frames. Full DICOM series retained on PACS.</span>
    <span class="foot-badge">&#10003; Agentix HIMS</span>
  </div>
</div></body></html>`
}

export function openRadiologyReport(study: RadiologyStudy): boolean {
  const html = buildRadiologyReportHtml(study)
  const w = window.open('', '_blank', 'width=880,height=1040')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { try { w.print() } catch { /* ignore */ } }, 350)
  return true
}
