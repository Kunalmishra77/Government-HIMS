// Print-ready laboratory report generator (no dependencies). Builds a
// standalone, self-styled HTML lab report — hospital branding, patient +
// UHID block, per-test result tables with biological reference intervals and
// status flags, interpretation, dual signature area and a QR stamp — then
// opens the browser print dialog. Mirrors the layout Indian NABL-accredited
// hospital LIS software produces.

import type { LabOrder, TestRun, AnalyteResult, AnalyteFlag } from '@/store/useLabOrdersStore'
import { LAB_CATALOG, type Bench } from '@/lib/labCatalog'

const esc = (s: string | number) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const BENCH_LABEL: Record<Bench, string> = {
  HEMA: 'Haematology', BIOCHEM: 'Biochemistry', IMMUNO: 'Immunology',
  URINE: 'Clinical Pathology', MICRO: 'Microbiology', HISTO: 'Histopathology',
}
const FLAG_TEXT: Record<AnalyteFlag, string> = {
  N: '', H: 'High', L: 'Low', CH: 'Critical High', CL: 'Critical Low',
}
const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// Deterministic pseudo-QR: a 21×21 module grid seeded from the report id, with
// the three finder squares drawn in. Looks like a scannable code for the demo
// without pulling in a QR dependency.
function qrSvg(seed: string, px = 84): string {
  const N = 21
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  const bit = (x: number, y: number) => {
    h ^= (x * 73856093) ^ (y * 19349663); h = Math.imul(h, 2654435761)
    return ((h >>> 13) & 1) === 1
  }
  const inFinder = (x: number, y: number) => {
    const q = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7
    return q(0, 0) || q(N - 7, 0) || q(0, N - 7)
  }
  const cell = px / N
  let rects = ''
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const on = inFinder(x, y)
      ? !((x >= 1 && x <= 5 && y >= 1 && y <= 5) && !(x >= 2 && x <= 4 && y >= 2 && y <= 4)) && ((x < 6 && y < 6) || (x > N - 7 && y < 6) || (x < 6 && y > N - 7) ? !((x % 6 === 0) || (y % 6 === 0)) : true)
      : bit(x, y)
    if (on) rects += `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`
  }
  return `<svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" xmlns="http://www.w3.org/2000/svg"><rect width="${px}" height="${px}" fill="#fff"/><g fill="#0f172a">${rects}</g></svg>`
}

function analyteRow(a: AnalyteResult): string {
  const abnormal = a.flag !== 'N'
  const critical = a.flag === 'CH' || a.flag === 'CL'
  const ref = a.refLow != null && a.refHigh != null ? `${a.refLow} – ${a.refHigh}` : '—'
  const status = FLAG_TEXT[a.flag]
  return `<tr class="${abnormal ? 'abn' : ''}">
    <td class="ana">${esc(a.analyte)}</td>
    <td class="val ${critical ? 'crit' : abnormal ? 'warn' : ''}">${esc(a.value)}${abnormal ? ` <span class="arrow">${a.flag === 'H' || a.flag === 'CH' ? '&#9650;' : '&#9660;'}</span>` : ''}</td>
    <td class="unit">${esc(a.unit)}</td>
    <td class="ref">${esc(ref)}</td>
    <td class="flag">${status ? `<span class="badge ${critical ? 'b-crit' : 'b-warn'}">${esc(status)}</span>` : '<span class="b-norm">Normal</span>'}</td>
  </tr>`
}

function testBlock(t: TestRun): string {
  const cat = LAB_CATALOG[t.code]
  const section = cat ? BENCH_LABEL[cat.bench] : ''
  const rows = t.analytes.filter(a => a.value !== '' && a.value != null).map(analyteRow).join('')
  const microNote = t.micro?.finalReport
    ? `<div class="micro"><b>Culture &amp; Sensitivity:</b> ${esc(t.micro.finalReport)}</div>`
    : ''
  return `<section class="test">
    <div class="test-hdr"><span class="test-name">${esc(t.name)}</span><span class="test-sec">${esc(section)}</span></div>
    ${rows ? `<table class="results">
      <thead><tr><th>Investigation</th><th>Result</th><th>Units</th><th>Biological Ref. Interval</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` : ''}
    ${microNote}
  </section>`
}

export function buildLabReportHtml(order: LabOrder, tests?: TestRun[]): string {
  const reported = tests ?? order.tests.filter(t => t.analytes.some(a => a.value !== '') || t.micro?.finalReport)
  const accession = order.specimens[0]?.accession ?? order.id
  const collectedAt = order.specimens.find(s => s.collectedAt)?.collectedAt
  const reportedAt = reported.map(t => t.releasedAt).filter(Boolean).sort().pop()
  const reportId = `${order.id}-RPT`
  const criticalCount = reported.reduce((n, t) => n + t.analytes.filter(a => a.flag === 'CH' || a.flag === 'CL').length, 0)
  const verifier = reported.find(t => t.verifiedBy)?.verifiedBy?.name ?? 'Dr. Asha Rao, MD (Pathology)'
  const entered = reported.find(t => t.enteredBy)?.enteredBy?.name ?? 'Lab Technologist'

  return `<!doctype html><html><head>
<meta charset="utf-8">
<title>Lab Report — ${esc(order.patientName)} — ${esc(order.uhid)}</title>
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
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #e2e8f0}
  .meta .col{padding:14px 28px}
  .meta .col:first-child{border-right:1px solid #e2e8f0}
  .row{display:flex;font-size:12px;margin:3px 0}
  .row .k{width:118px;color:#64748b;font-weight:600}
  .row .v{color:#0f172a;font-weight:700}
  .row .v.big{font-size:14px}
  .uhid{display:inline-block;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-weight:800;padding:1px 8px;border-radius:6px;letter-spacing:.02em}
  .crit-banner{margin:0 28px;margin-top:14px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:11.5px;font-weight:700;padding:8px 12px;border-radius:8px}
  .body{padding:8px 28px 18px}
  .test{margin-top:16px}
  .test-hdr{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #0D2032;padding-bottom:4px;margin-bottom:2px}
  .test-name{font-size:13px;font-weight:800;color:#0D2032;text-transform:uppercase;letter-spacing:.03em}
  .test-sec{font-size:10px;font-weight:700;color:#B84A16;text-transform:uppercase;letter-spacing:.06em}
  table.results{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
  table.results th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;padding:6px 8px;border-bottom:1px solid #e2e8f0}
  table.results th:nth-child(2),table.results th:nth-child(3){text-align:left}
  table.results td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  td.ana{font-weight:600;color:#334155}
  td.val{font-weight:800;color:#0f172a}
  td.val.warn{color:#b45309}
  td.val.crit{color:#b91c1c}
  td.val .arrow{font-size:9px}
  td.unit,td.ref{color:#64748b}
  tr.abn td{background:#fffbeb}
  tr.abn td.val.crit{background:#fef2f2}
  .badge{font-size:9.5px;font-weight:800;padding:1px 7px;border-radius:20px}
  .b-warn{background:#fef3c7;color:#92400e}
  .b-crit{background:#fee2e2;color:#b91c1c}
  .b-norm{font-size:10px;color:#94a3b8;font-weight:600}
  .micro{margin-top:8px;font-size:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;line-height:1.55}
  .interp{margin:16px 28px 0;font-size:11.5px;color:#475569;line-height:1.6;background:#f8fafc;border-left:3px solid #EE6B26;padding:10px 14px;border-radius:0 8px 8px 0}
  .interp b{color:#0f172a}
  .sign{display:flex;justify-content:space-between;align-items:flex-end;margin:34px 28px 0;padding-top:14px}
  .sig{ text-align:center;width:200px}
  .sig .ln{font-family:'Segoe Script','Brush Script MT',cursive;font-size:20px;color:#0D2032;height:26px}
  .sig .nm{border-top:1px solid #94a3b8;padding-top:4px;font-size:11px;font-weight:700;color:#334155;margin-top:2px}
  .sig .rl{font-size:9.5px;color:#94a3b8}
  .qr{text-align:center}
  .qr svg{border:1px solid #e2e8f0;border-radius:6px}
  .qr .cap{font-size:8.5px;color:#94a3b8;margin-top:3px}
  .foot{margin-top:22px;border-top:1px solid #e2e8f0;padding:12px 28px 22px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#94a3b8}
  .eor{text-align:center;font-size:10px;font-weight:700;letter-spacing:.2em;color:#cbd5e1;margin-top:18px}
  .foot-badge{font-weight:800;color:#B84A16;background:#FFF3EC;border:1px solid #FBD5BC;padding:2px 9px;border-radius:20px}
  @media print{body{background:#fff}.page{margin:0;max-width:none;box-shadow:none}}
</style></head>
<body><div class="page">
  <div class="hdr">
    <div class="brand">
      <div class="logo">A</div>
      <div>
        <div class="h-name">Agentix Multispeciality Hospital</div>
        <div class="h-sub">Department of Laboratory Medicine · Lucknow, Uttar Pradesh</div>
        <div class="h-accr">NABL ACCREDITED · ISO 15189:2022</div>
      </div>
    </div>
    <div class="h-right">
      <div><b>Report No:</b> ${esc(reportId)}</div>
      <div><b>Accession:</b> ${esc(accession)}</div>
      <div>Ph: 0522-2200000</div>
    </div>
  </div>
  <div class="title-bar">LABORATORY TEST REPORT</div>

  <div class="meta">
    <div class="col">
      <div class="row"><span class="k">Patient Name</span><span class="v big">${esc(order.patientName)}</span></div>
      <div class="row"><span class="k">UHID</span><span class="v"><span class="uhid">${esc(order.uhid)}</span></span></div>
      <div class="row"><span class="k">Patient ID</span><span class="v">${esc(order.patientId)}</span></div>
      <div class="row"><span class="k">Source / Ward</span><span class="v">${esc(order.source)}${order.wardBed ? ' · ' + esc(order.wardBed) : ''}</span></div>
    </div>
    <div class="col">
      <div class="row"><span class="k">Ref. Consultant</span><span class="v">${esc(order.doctorName)}</span></div>
      <div class="row"><span class="k">Department</span><span class="v">${esc(order.department)}</span></div>
      <div class="row"><span class="k">Collected On</span><span class="v">${esc(fmtDate(collectedAt))}</span></div>
      <div class="row"><span class="k">Reported On</span><span class="v">${esc(fmtDate(reportedAt || undefined))}</span></div>
    </div>
  </div>

  ${criticalCount > 0 ? `<div class="crit-banner">&#9888; ${criticalCount} critical value(s) flagged — treating physician notified. Correlate clinically and act promptly.</div>` : ''}

  <div class="body">
    ${reported.map(testBlock).join('')}
  </div>

  <div class="interp">
    <b>Interpretation:</b> Results marked <b>High</b>/<b>Low</b> fall outside the biological reference interval for the patient's age/sex. Reference intervals are method- and instrument-specific. Values should be interpreted by the treating physician in the clinical context. Kindly correlate clinically.
  </div>

  <div class="sign">
    <div class="sig">
      <div class="ln">${esc(entered.split(',')[0])}</div>
      <div class="nm">${esc(entered)}</div>
      <div class="rl">Performed / Entered by</div>
    </div>
    <div class="qr">
      ${qrSvg(reportId)}
      <div class="cap">Scan to verify · ${esc(reportId)}</div>
    </div>
    <div class="sig">
      <div class="ln">${esc(verifier.split(',')[0])}</div>
      <div class="nm">${esc(verifier)}</div>
      <div class="rl">Verified &amp; authorised by</div>
    </div>
  </div>

  <div class="eor">— END OF REPORT —</div>

  <div class="foot">
    <span>Digitally generated report · ${esc(fmtDate(new Date().toISOString()))}<br>This report is electronically authenticated and does not require a physical signature.</span>
    <span class="foot-badge">&#10003; Agentix HIMS</span>
  </div>
</div></body></html>`
}

export function openLabReport(order: LabOrder, tests?: TestRun[]): boolean {
  const html = buildLabReportHtml(order, tests)
  const w = window.open('', '_blank', 'width=880,height=1040')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { try { w.print() } catch { /* ignore */ } }, 350)
  return true
}
