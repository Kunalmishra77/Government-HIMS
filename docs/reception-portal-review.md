# Reception Portal — Comprehensive Product & Design Review

**Scope:** Front Desk (Dashboard, OPD Queue, Register Patient, Journey Board, OPD Display, Appointments) · Coordination (Bed Status, Billing Status, TPA/Insurance, Diagnostics, Ambulance) · Utilities (Messaging, Download Center, Reports, Kiosk Check-in, Setup) · Patient Directory · shared identity-capture components.

**Reviewer lens:** Senior Product Designer · Principal UX Architect · Hospital Operations Consultant.

**Overall verdict.** The Reception Portal is **further along than most modules** — the Dashboard, OPD Queue, Patients directory, Register flow, and Journey Board are real, store-driven, and thoughtfully built (triage-priority sorting, SLA breach detection, ABHA-first registration with AI triage suggestions). The gap is not foundation, it is **(1) finishing the Coordination/Utilities screens from read-only mirrors into action surfaces, (2) closing several honesty gaps where the UI claims things the code doesn't do, (3) fixing a class of real rendering bugs introduced by a brand-recolor find/replace, and (4) adopting the existing design system uniformly.** Detail follows.

---

## 1. UI/UX Issues

### Critical rendering bugs (real defects, not cosmetic)
A brand-recolor find/replace corrupted color utility classes in multiple files. These are **invalid Tailwind classes that silently render nothing**:

| File | Line | Broken class | Effect |
|---|---|---|---|
| `reception/queue/page.tsx` | 43 | `bg-[rgba(238,107,38,0.07)]0` | "Now serving" live dot has no fill |
| `reception/beds/page.tsx` | 12, 14 | `bg-[rgba(238,107,38,0.07)]0` | Occupied/Reserved status dots invisible |
| `reception/ambulance/page.tsx` | 12 | `bg-[rgba(238,107,38,0.07)]0` | `on_trip` status dot invisible |
| `reception/messages/page.tsx` | 160 | `bg-[rgba(238,107,38,0.07)]0` | Unread dot invisible |
| `reception/messages/page.tsx` | 92, 159 | `bg-[rgba(238,107,38,0.07)]/50` | Opacity appended to an rgba arbitrary value doesn't compose — selected/unread tint silently fails |
| `components/reception/OcrIntakeCard.tsx` | 169, 199 | `...rgba(...)]/40`, `ring-blue-200/70` | Same opacity-compose failure |

**Action:** global grep for `]0"`, `]0 `, and `)]/` arbitrary-value patterns across `src/` — this defect family likely exists beyond reception too.

### Design-system under-adoption (the dominant theme)
A mature token layer exists in `globals.css` (`.t-h1/.t-body/.t-caption/.t-overline` type scale, `.hms-card`, semantic vars `--color-primary`/`--color-foreground-muted`/`--color-success/warning/danger`) plus `StatusPill` (color **+ icon + text**) and `NeonBadge`. **Only `checkin/page.tsx` uses them properly.** Every other reception screen hand-rolls:
- A repeated inline `CARD = "rounded-2xl bg-white shadow-[0_1px_4px…]"` constant copy-pasted across 5+ files (dashboard, patients, downloads, reports, setup) plus `STAT_CARD` in `VisibilityHeader.tsx:20` — all duplicate `.hms-card`.
- Hardcoded pixel type (`text-[24px]`, `text-[13.5px]`, and `text-[9.5px]`/`text-[10.5px]` which fall **below the documented 12px floor**) instead of `.t-*`.
- Per-screen status-tint maps (`TRIAGE_TINT`, `STATUS_TINT`, `STATUS_PILL`, `PRIORITY_TINT`, `VEHICLE_STATUS`, `TRIP_TINT`, `pill()`) that encode clinical status **by color alone** — the exact patient-safety anti-pattern `StatusPill` was built to prevent.

### Color drift
Three different "brand blues" coexist: the teal `--color-primary` (#EE6B26), a hardcoded `#B84A16` repeated literally in `billing/page.tsx` (lines 12/38/64/110), and a stray `#2563eb` (royal blue) as the bar-chart fill in `reports/page.tsx:66`. Stray `focus:ring-blue-100` rings appear in appointments and patients on an otherwise-teal app. `IdentityCaptureCard.tsx` is skinned entirely in **emerald** and looks like a different product.

### Empty / loading / error states
- **Missing empty state:** OPD Display (`queue`) renders every room as "Available — calling next / 0 waiting" when no patients exist — looks broken, not idle. Reports bar chart renders a blank box with no "No registrations yet."
- **Good empty states:** Patients, Journey Board, Appointments, Diagnostics, Downloads all have them.
- **No loading/error states anywhere** — tolerable only because all data is synchronous local store today; the moment any screen hits a real API it has no skeleton or failure UI.

### Accessibility
- OPD Display encodes triage severity by **color/gradient only** — no text label or `aria` for color-blind staff or screen readers.
- Journey Board rows are clickable `<tr>` with no `role="button"`, `tabIndex`, or keyboard handler — **mouse-only navigation**.
- Appointments and Patients modals/drawers lack focus traps and consistent Esc-to-close (Patients has Esc; Appointments does not).
- Filter chips throughout lack `aria-pressed`.
- Kiosk check-in (`checkin`) is the accessibility exemplar (aria-labels, focus-visible, loading state) — use it as the template.

---

## 2. Functional Issues

- **Appointments — misleading success toast.** `appointments/page.tsx:77-80` claims the patient was "added to the OPD queue" and "Reception & nursing notified." The code only calls `bookAppointment()` — there is **no queue insertion and no notification**. This is the most important honesty bug: staff will believe a handoff happened that didn't.
- **Appointments — no conflict/double-booking detection.** Two patients can be booked to the same doctor + date + time silently; `SLOTS` is a fixed static list, not availability-aware.
- **Appointments — mock doctor roster inconsistent with OPD config.** `DOCTORS`/`SLOTS` are hardcoded and name doctors/departments (e.g. Gynaecology) that don't exist in `src/lib/opd.ts`, so an appointment can reference a doctor with no OPD room on the board.
- **OPD Display is read-only.** Despite `Volume2` "announce" iconography, reception cannot call/recall/skip a token, mark no-show, reassign a room, or announce from this screen. The actionable announce/escalate lives only on the OPD **Queue** screen.
- **Coordination screens are passive mirrors.** Beds (no reserve/assign/clean action), TPA (no submit-preauth/escalate; rejected claims are *filtered out* entirely at `tpa:44`), Diagnostics (no "notify ordering clinician"), and Billing (print slip works, but no "record payment") each show the work but can't *do* it. Ambulance is the exception — "Request dispatch" genuinely fires `notifyAndAudit`.
- **"Live · synced" indicator is fake.** `VisibilityHeader.tsx:14` always shows a green pulsing "Live" pill; nothing is polled or synced. Presenting static localStorage data as live is an operational hazard.
- **Setup toggles appear inert.** `reception-setup` is written to localStorage but `STORE_KEY` is not read anywhere else — "Auto-announce", "AI triage", "WhatsApp" toggles may not drive any behavior.
- **Download Center ships fake patient receipts.** `DOCS` mixes static templates with fabricated patient-specific receipts ("OPD receipt — Meera Pillai · ₹600") unconnected to `useBillingStore`; downloads emit a `.txt` literally labeled "Demo download · Phase-1 mock."
- **Audit trail non-attributable.** `AadhaarAbhaFlow`, `IdentityCaptureCard`, `OcrIntakeCard` all log `userId: "user"` / `"Reception"` instead of the authenticated `currentUser`.
- **`registeredDate ?? todayISO` fallback** (used in dashboard, opd, patients, reports) counts any dateless patient as "today," inflating today's metrics.

---

## 3. Workflow Improvements

1. **Close the appointment → OPD loop.** A confirmed in-person appointment should, on patient arrival, become a real OPD token with one "Check in" click — actually inserting into `usePatientStore` and notifying nursing (deliver what the toast already promises). Add an **Arrived / No-show** status.
2. **Make OPD Display actionable** (or split roles clearly). Add Call-next / Recall / Skip / Mark-served and TTS announce. If it must stay a patient-facing TV, give it a true fullscreen kiosk mode and move desk controls to the Queue screen — today "Kiosk Mode" only changes padding.
3. **Unify the three identity-capture surfaces.** `AadhaarAbhaFlow`, `IdentityCaptureCard`, and `OcrIntakeCard` all scan documents and/or do mobile OTP. One "Identity Capture" module reduces clerk confusion and code.
4. **Reduce registration clicks for the common path.** The ABHA-first flow is excellent but is 4 macro-steps + OTP. Offer a "returning patient" fast path: search by phone/UHID/ABHA → if found, skip straight to visit details.
5. **Add bed reserve/assign from the freeing-soon list**, and link "Overdue turnaround" to a real housekeeping nudge (today it's prose, not a button).
6. **Surface `not_submitted` pre-auths and rejected claims** on the TPA screen — the states that most need action are currently hidden.
7. **Sort/cap Diagnostics lists "ready-first"** with item age, and push a "result ready" notification to the ordering clinician.

---

## 4. AI Enhancement Opportunities

- **Smart returning-patient search:** type a partial name/phone and rank existing UHIDs with fuzzy + phonetic matching (Indian-name transliteration variants).
- **Duplicate-patient detection** at registration: warn when name+DOB+phone closely matches an existing record before creating a new UHID.
- **Auto department + triage suggestion** already exists (`suggestTriage`, register:498-507) — extend it to the kiosk intake and make the OPD Queue auto-bump Critical walk-ins to the front.
- **SLA-breach prediction on the Journey Board:** flag patients *about to* breach from current stage velocity, and auto-escalate to the owning department on breach (board shows red but notifies no one today).
- **Bottleneck detection:** "Lab is the constraint — 6 patients stacked" with a suggested rebalance.
- **TPA approval modeling:** replace the static `aiProbability` integer with a real model over historical approvals by procedure/payer; draft pre-auth justification text; predict approval ETA to unblock discharge planning.
- **Ambulance:** recommend optimal vehicle by proximity + fuel + acuity; predict arrival ETA.
- **Real OCR behind the existing HITL UI** (`OcrIntakeCard` is the right pattern — Textract/Document AI in Phase 2; low-confidence fields auto-route to required review).
- **Suggested-reply drafting** for WhatsApp threads; auto-triage inbound patient messages by priority; auto-escalate on red-flag keywords.
- **Natural-language reports** ("how many cardiology walk-ins last week?") and footfall forecasting for staffing.

---

## 5. Automation Opportunities

- Auto-confirm reminders (SMS/WhatsApp) for upcoming appointments; auto-convert confirmed → token on arrival.
- Voice/TTS auto-announcement of the next OPD token (the `Volume2` icon already implies it).
- Auto-nudge housekeeping on overdue bed turnaround; auto-match freeing beds to pending admissions (ward + gender + acuity).
- Auto-route ready diagnostics results to the ordering clinician; auto-flag lab panic values.
- Auto-bundle a patient's visit packet (registration + receipt + token + reports) into one regenerated download.
- Cross-reconcile Billing `insuranceCovered` against the TPA claim and flag mismatches.

---

## 6. Missing Features

- **Appointment slot availability + double-booking prevention; day/calendar view; no-show tracking; follow-up scheduling.**
- **Token call/recall/skip/no-show controls** on the OPD Display.
- **Returning-patient lookup** as a first-class registration entry point.
- **Bed aging / waiting-list match; gender-aware allocation as a constraint, not just data.**
- **Billing aging buckets (30/60/90-day)** and a "record payment" action.
- **TPA pre-auth submission, document upload, rejection appeal, per-TPA turnaround.**
- **Diagnostics TAT metric and critical-result escalation.**
- **Ambulance structured dispatch intake** (patient/location/urgency) + live ETA — today it's a blunt broadcast that still requires a phone call.
- **Reports: date-range selection and CSV/print export** (today-only, no export — ironic next to a Download Center).
- **Kiosk language selector (Hindi/regional)** — essentially required for a UP government patient-facing kiosk; plus large-text/audio mode.
- **Server-side, per-user/per-counter Setup** (today localStorage-only, lost on machine change).

---

## 7. Features to Remove / Simplify

- **Fake same-color "gradients"** in OPD Display (`linear-gradient(135deg, var(--color-primary), var(--color-primary))`, lines 102/104) → flat token fill.
- **Dead-code ternaries** in Appointments (lines 135/145 return identical classes for online vs in-person) — make distinct or delete.
- **Decorative emoji** in bed ETA string (`beds:90` `'🟢 '`) — violates the no-emoji convention and duplicates the tone color.
- **Dead imports** (`Wrench`, `ArrowRight` in beds).
- **Dead hover states** where `hover:` equals base color (queue, messages:154, billing:110).
- **Kiosk Mode** on OPD Display as currently built (padding-only) — make it real fullscreen or drop it.
- **Reports** is thin enough to fold into the Dashboard rather than stand alone.
- **Consolidate the three identity-capture components** into one.
- **Drop or wire** the inert Setup toggles.

---

## 8. Design Improvements

- Migrate all reception screens onto `.hms-card`, `.t-*` type scale, `StatusPill`/`NeonBadge`, and `--color-*` vars — using `checkin/page.tsx` as the reference. This alone removes ~6 duplicated tint maps and the repeated `CARD`/`STAT_CARD` constants.
- Reconcile color drift: kill `#B84A16`/`#2563eb`/emerald-skin/`ring-blue-*` → single teal identity.
- Make every reception page header use a shared `VisibilityHeader`/`PageHeader` (messages, downloads, reports, setup each re-implement their own `<h1>`).
- Cap and virtualize long lists (ward grids, diagnostics lists) for hospitals with 200+ beds / busy labs.
- Replace color-only status with `StatusPill` (icon + text) everywhere for patient safety.
- Micro-interactions are already strong on the actioned screens (framer-motion list transitions in OPD Queue, drawer slides in Patients) — extend that polish to the passive Coordination screens once they gain actions.

---

## 9. Performance Improvements

- Long uncapped lists (Bed wards, Diagnostics, Patients "All") should paginate or virtualize (`react-window`) before real data volumes hit.
- `bucket(t)` in Patients is recomputed for every tab to derive counts each render (`patients/page.tsx:66`) — memoize.
- Swap raw `<img>` for `next/image` where flagged (checkin logos, and the photo thumbnails) to ship optimized assets and clear the `@next/next/no-img-element` lint.
- De-duplicate the SLA threshold constants in Journey Board (`journey:38-41`) — import from the store to avoid drift.
- 1-second ticking clock in OPD Display re-renders the whole board every second; isolate the clock into its own component.

---

## 10. Accessibility Improvements

- Add text/`aria` labels to all color-coded triage and status indicators (OPD Display especially).
- Make Journey Board rows keyboard-navigable (`role="button"`, `tabIndex={0}`, Enter/Space handler).
- Add focus traps + Esc-to-close to Appointments modal; autofocus first field on open.
- Add `aria-pressed` to filter/tab chips throughout.
- Kiosk: large-text mode, audio guidance, language selection — patient-facing and government-mandated context.
- Enforce the 12px type floor (several `text-[9.5px]`/`text-[10.5px]` violations).

---

## 11. Technical Recommendations

1. **Fix the corrupted-class defect family** first (grep `)]0`, `)]/`, `]0"` across `src/`).
2. **Replace honesty gaps with real wiring or honest copy:** the Appointments queue/notify toast, the "Live · synced" indicator, the inert Setup toggles, the mock Download receipts.
3. **Single source of truth** for departments, doctors, and slots — `DEPTS`/`DOCTORS` are re-declared in register, appointments, downloads, reports, and setup; consolidate into `src/lib/opd.ts`.
4. **Attribute audit logs** to `currentUser` in the three capture components.
5. **Abstract a shared status component** and delete the per-screen tint maps.
6. **Add API-readiness scaffolding** (loading skeletons, error boundaries) before swapping mock stores for real services — every Coordination screen currently assumes synchronous data.
7. **Memoize derived collections** and isolate the ticking clock.

---

## 12. Product Owner Recommendations

- **The portal's biggest product gap is "show but can't act."** The Coordination section looks complete but is a dashboard of other people's work; its value is realized only when each desk can take the one action it exists for. Prioritize converting mirrors → action surfaces over adding new screens.
- **Trust is the currency of a front desk.** Three places where the UI claims more than it does (queue/notify toast, Live indicator, fake receipts) will erode staff trust faster than any missing feature. Fix honesty before features.
- **Registration is genuinely good** — ABHA-first, AI triage, print slip, photo capture. Protect it; just add the returning-patient fast path.
- **Journey Board is the strongest, most differentiated screen** — it's a real command-centre concept. Invest here: add actionability (escalate/ping/annotate) and predictive SLA alerts; it's the portal's signature feature.
- **Reports is too thin to justify a tab** — fold into Dashboard or expand with date ranges + export.

## 13. Hospital Operations Recommendations

- Real desks need **token lifecycle control** (call/recall/skip/no-show/room-reassign) and **walk-in priority bumping** — both missing from the Display.
- **Doctor availability/leave/session hours** must drive appointment slots; a booking should never name a doctor who isn't sitting.
- **Discharge is blocked by stuck pre-auths and bed turnaround** — wire TPA SLA aging and bed→housekeeping nudges; these are the real coordination costs.
- **Critical-result and panic-value escalation** from Diagnostics to the ordering clinician is a safety expectation, not a nice-to-have.
- **Language and low-literacy support** at the kiosk reflects the actual UP patient population.
- **Per-counter identity** (which desk, which clerk) should be server-bound for accountability, not browser-local.

---

## 14. Priority-wise Action Plan

### 🔴 Critical (do first — correctness, safety, trust)
1. Fix corrupted Tailwind classes: `queue:43`, `beds:12/14`, `ambulance:12`, `messages:92/159/160`, `OcrIntakeCard:169/199` (+ repo-wide grep).
2. Fix the misleading Appointments toast (`appointments:77-80`) — either actually insert to queue + notify, or change the copy.
3. Add appointment double-booking / conflict detection.
4. Make the "Live · synced" indicator honest (wire it or relabel).
5. Replace color-only clinical status with `StatusPill` (patient-safety) on the actioned screens.

### 🟠 High (core workflow value)
6. Close the appointment → OPD token loop with Arrived/No-show check-in.
7. Make OPD Display actionable (call/recall/skip/announce) or split TV vs control roles.
8. Add desk actions to Coordination: bed reserve/assign + housekeeping nudge, billing record-payment + aging, TPA submit-preauth + surface not_submitted/rejected, diagnostics notify-clinician + ready-first sort.
9. Returning-patient fast path + duplicate detection in registration.
10. Reports: date range + CSV/print export.

### 🟡 Medium (consistency, scale, polish)
11. Full design-system migration (`.hms-card`/`.t-*`/`StatusPill`/`--color-*`); kill duplicated `CARD`/tint maps; reconcile color drift.
12. Single source of truth for departments/doctors/slots.
13. Consolidate the three identity-capture components.
14. List virtualization/pagination; memoization; isolate ticking clock.
15. Audit attribution to `currentUser`; server-side per-counter Setup.

### 🟢 Low (enhancements)
16. Kiosk language selector + large-text/audio mode; swap `<img>` → `next/image`.
17. AI layer: SLA-breach prediction, bottleneck detection, real TPA modeling, ambulance vehicle recommendation, NL reports, suggested WhatsApp replies.
18. Fold Reports into Dashboard; remove padding-only Kiosk Mode or make it real.

---

### Quick-win patches (explicitly requested — Patient Directory)
These two are small, localized edits in `reception/patients/page.tsx`:
1. **Default to All Patients.** Change `useState<Tab>('Today')` → `useState<Tab>('All')` (line 46). Keep Today/Yesterday/Upcoming as quick filters.
2. **Show date + time in the All view.** Row currently renders only `p.registeredAt` (time) at line 175. In the All tab, render `{date} • {time}` — e.g. `28 Jun 2026 • 10:30 AM` — using `registeredDate` + `registeredAt`.
