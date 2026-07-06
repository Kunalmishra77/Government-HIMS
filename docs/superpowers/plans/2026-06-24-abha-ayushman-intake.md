# ABHA + Ayushman Card Intake Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Govt Scheme (ABHA / Ayushman)" cashless payment path to the patient intake kiosk, propagating the verified scheme identity downstream to admission, pre-auth, and discharge.

**Architecture:** A new `govtScheme` payer type is added to the intake data model alongside the existing `self` and `cashless` types. A mock eligibility service (`abha-mock.ts`) simulates the NHA check. Five downstream pages receive minimal, conditional changes to display scheme-specific UI (badge, pre-auth section, ABHA fields).

**Tech Stack:** Next.js 16 (App Router), TypeScript, Zustand, Tailwind CSS, Lucide icons, Framer Motion. No test runner — TypeScript type-checking (`npx tsc --noEmit`) is the verification gate.

---

## File Map

| Status | File | Change |
|---|---|---|
| **Create** | `src/lib/intake/abha-mock.ts` | Mock NHA eligibility check |
| **Modify** | `src/lib/intake/data.ts` | `govtScheme` payer type + 4 new form fields |
| **Modify** | `src/components/intake/ConsultSteps.tsx` | Govt scheme tile + ABHA/Ayushman panel in `PaymentStep` |
| **Modify** | `src/components/intake/IntakeFlow.tsx` | Propagate scheme fields on submit |
| **Modify** | `src/app/admission/dashboard/page.tsx` | Ayushman badge at line 273 |
| **Modify** | `src/app/insurance/preauth/page.tsx` | Ayushman pre-auth section below private list |
| **Modify** | `src/app/discharge/dashboard/page.tsx` | ABHA ID + pre-auth ref in patient row |

---

## Task 1: Mock Eligibility Service

**Files:**
- Create: `src/lib/intake/abha-mock.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/intake/abha-mock.ts

export interface AbhaEligibilityResult {
  eligible: boolean
  schemeName: 'AB-PMJAY' | 'CMHIS-UP' | ''
  coverage: string
  preAuthRef: string
}

export async function checkAbhaEligibility(
  abhaId: string,
  ayushmanCardNo: string,
): Promise<AbhaEligibilityResult> {
  await new Promise(r => setTimeout(r, 1200))

  // Simulate not-eligible for ABHA IDs starting with "00-"
  if (abhaId.startsWith('00-')) {
    return { eligible: false, schemeName: '', coverage: '', preAuthRef: '' }
  }

  // Minimum length guard (mirrors UI validation)
  if (abhaId.length < 8 || ayushmanCardNo.length < 6) {
    return { eligible: false, schemeName: '', coverage: '', preAuthRef: '' }
  }

  const schemeName = ayushmanCardNo.toUpperCase().startsWith('UP-') ? 'CMHIS-UP' : 'AB-PMJAY'
  const preAuthRef = `PMJAY-PRE-${Math.floor(1000000 + Math.random() * 9000000)}`

  return {
    eligible: true,
    schemeName,
    coverage: schemeName === 'CMHIS-UP'
      ? 'Covered up to ₹5,00,000/year (CMHIS-UP)'
      : 'Covered up to ₹5,00,000/year (AB-PMJAY)',
    preAuthRef,
  }
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
npx tsc --noEmit
```

Expected: no errors relating to `abha-mock.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/intake/abha-mock.ts
git commit -m "feat: add mock ABHA/Ayushman eligibility service"
```

---

## Task 2: Extend Intake Data Model

**Files:**
- Modify: `src/lib/intake/data.ts`

- [ ] **Step 1: Extend `Payer` type and add new form fields**

In `src/lib/intake/data.ts`, replace line 8:
```typescript
export type Payer = '' | 'self' | 'cashless'
```
with:
```typescript
export type Payer = '' | 'self' | 'cashless' | 'govtScheme'
```

Add four fields to the `IntakeForm` interface (after `insuranceVerified: boolean` on line 33):
```typescript
  abhaId: string
  ayushmanCardNo: string
  govtSchemeVerified: boolean
  schemeName: string
```

- [ ] **Step 2: Initialise the four new fields in `initialForm()`**

In `initialForm()` (line 44–46), add to the return object:
```typescript
    abhaId: '', ayushmanCardNo: '', govtSchemeVerified: false, schemeName: '',
```

The full initialForm return should now end with:
```typescript
    payer: '', payMethod: '', insurer: '', insuranceCardNo: '',
    policyId: '', policyHolder: '', insuranceVerified: false,
    abhaId: '', ayushmanCardNo: '', govtSchemeVerified: false, schemeName: '',
```

- [ ] **Step 3: Update `canContinue` for the payment step**

Replace line 216 in `data.ts`:
```typescript
    case 'payment': return form.payer === 'cashless' ? form.insuranceVerified : (form.payer === 'self' && !!form.payMethod)
```
with:
```typescript
    case 'payment':
      if (form.payer === 'govtScheme') return form.govtSchemeVerified
      if (form.payer === 'cashless') return form.insuranceVerified
      return form.payer === 'self' && !!form.payMethod
```

- [ ] **Step 4: Verify type-checking passes**

```bash
npx tsc --noEmit
```

Expected: no errors. (The new fields will appear as unused until Task 3 — that is fine.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/intake/data.ts
git commit -m "feat: add govtScheme payer type and ABHA fields to IntakeForm"
```

---

## Task 3: Govt Scheme Panel in PaymentStep

**Files:**
- Modify: `src/components/intake/ConsultSteps.tsx`

- [ ] **Step 1: Add import for `checkAbhaEligibility` and new icons**

At the top of `src/components/intake/ConsultSteps.tsx`, the existing import from lucide-react is:
```typescript
import { Building2, Video, Stethoscope, CalendarDays, Clock, Wallet, ShieldCheck, Smartphone, CreditCard, Store, CheckCircle, Loader2, User, FileText } from "lucide-react"
```

Add `Heart, HelpCircle, AlertCircle, XCircle` to that import:
```typescript
import { Building2, Video, Stethoscope, CalendarDays, Clock, Wallet, ShieldCheck, Smartphone, CreditCard, Store, CheckCircle, Loader2, User, FileText, Heart, HelpCircle, AlertCircle, XCircle } from "lucide-react"
```

Then add a new import after the existing imports:
```typescript
import { checkAbhaEligibility } from "@/lib/intake/abha-mock"
import type { AbhaEligibilityResult } from "@/lib/intake/abha-mock"
```

- [ ] **Step 2: Add govtScheme state to `PaymentStep`**

In `PaymentStep` (starts at line 98), after the existing `const [checking, setChecking] = useState(false)` line, add:
```typescript
  const [govtChecking, setGovtChecking] = useState(false)
  const [govtResult, setGovtResult] = useState<AbhaEligibilityResult | null>(null)
  const [showAadhaarFallback, setShowAadhaarFallback] = useState(false)
  const [aadhaarNo, setAadhaarNo] = useState('')
```

- [ ] **Step 3: Add ABHA ID formatter and verify handler**

After the `verify` function (line 108), add:
```typescript
  const formatAbhaId = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 14)
    if (digits.length <= 2) return digits
    if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`
  }

  const canVerifyGovt = form.abhaId.length >= 8 && form.ayushmanCardNo.trim().length >= 6
  const canVerifyAadhaar = aadhaarNo.replace(/\D/g, '').length === 12

  const verifyGovt = async (abhaId: string, cardNo: string) => {
    setGovtChecking(true)
    setGovtResult(null)
    const result = await checkAbhaEligibility(abhaId, cardNo)
    setGovtResult(result)
    if (result.eligible) {
      update({ govtSchemeVerified: true, schemeName: result.schemeName })
    } else {
      update({ govtSchemeVerified: false, schemeName: '' })
    }
    setGovtChecking(false)
  }
```

- [ ] **Step 4: Replace the payer tile grid to include the Govt Scheme tile**

In `PaymentStep`, find the payer grid section (lines 124–139):
```tsx
      {/* Payer */}
      <div>
        <p className="text-[12px] uppercase text-slate-400 font-semibold ml-1 mb-2 tracking-wide">How will you pay?</p>
        <div className="grid grid-cols-2 gap-2.5">
          {([['self', 'Self-pay', Wallet], ['cashless', 'Cashless', ShieldCheck]] as const).map(([val, label, Icon]) => {
            const sel = form.payer === val
            return (
              <button key={val} onClick={() => update({ payer: val })} aria-pressed={sel}
                className={cn("flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]",
                  sel ? "bg-[#EE6B26] border-[#EE6B26] text-white" : "bg-white border-slate-200 text-slate-700")}>
                <Icon className={cn("h-5 w-5", sel ? "text-white" : "text-[#EE6B26]")} />
                <span className="text-[14px] font-semibold">{label}</span>
              </button>
            )
          })}
        </div>
      </div>
```

Replace with:
```tsx
      {/* Payer */}
      <div>
        <p className="text-[12px] uppercase text-slate-400 font-semibold ml-1 mb-2 tracking-wide">How will you pay?</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            ['self', 'Self-pay', Wallet],
            ['cashless', 'Cashless', ShieldCheck],
            ['govtScheme', 'Govt Scheme', Heart],
          ] as const).map(([val, label, Icon]) => {
            const sel = form.payer === val
            const isGovt = val === 'govtScheme'
            return (
              <button
                key={val}
                onClick={() => update({ payer: val, govtSchemeVerified: false, schemeName: '' })}
                aria-pressed={sel}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]",
                  sel
                    ? isGovt ? "bg-green-600 border-green-600 text-white" : "bg-[#EE6B26] border-[#EE6B26] text-white"
                    : "bg-white border-slate-200 text-slate-700",
                )}
              >
                <Icon className={cn("h-5 w-5", sel ? "text-white" : isGovt ? "text-green-600" : "text-[#EE6B26]")} />
                <span className="text-[12px] font-semibold text-center leading-tight">{label}</span>
              </button>
            )
          })}
        </div>
      </div>
```

- [ ] **Step 5: Update the fee card to handle `govtScheme` display**

Find line 120 in `PaymentStep`:
```tsx
        <p className="text-[26px] font-bold text-slate-900">{form.payer === 'cashless' ? <span className="text-[15px] font-bold text-[#EE6B26]">Cashless</span> : `₹${fee}`}</p>
```

Replace with:
```tsx
        <p className="text-[26px] font-bold text-slate-900">
          {form.payer === 'cashless'
            ? <span className="text-[15px] font-bold text-[#EE6B26]">Cashless</span>
            : form.payer === 'govtScheme'
              ? <span className="text-[14px] font-bold text-green-600">Cashless · {form.schemeName || 'Ayushman'}</span>
              : `₹${fee}`}
        </p>
```

- [ ] **Step 6: Add the Govt Scheme panel below the existing cashless panel**

After the closing `)}` of the `{form.payer === 'cashless' && ...}` block (after line 199), add:

```tsx
      {/* Govt Scheme → ABHA ID + Ayushman Card */}
      {form.payer === 'govtScheme' && (
        <div className="space-y-3">
          {/* ABHA ID */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <p className="text-[12px] uppercase text-slate-400 font-semibold tracking-wide">ABHA ID</p>
              <span title="14-digit Ayushman Bharat Health Account number from your ABHA card or DigiLocker">
                <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
              </span>
            </div>
            <div className={fieldCard}>
              <Heart className="h-5 w-5 text-green-500 flex-shrink-0" aria-hidden="true" />
              <input
                className={fieldInput}
                placeholder="14-XXXX-XXXX-XXXX"
                aria-label="ABHA ID"
                value={form.abhaId}
                onChange={e => {
                  update({ abhaId: formatAbhaId(e.target.value), govtSchemeVerified: false, schemeName: '' })
                  setGovtResult(null)
                }}
              />
            </div>
          </div>

          {/* Ayushman Card No */}
          <div className={fieldCard}>
            <ShieldCheck className="h-5 w-5 text-green-500 flex-shrink-0" aria-hidden="true" />
            <input
              className={fieldInput}
              placeholder="Ayushman Card / Family ID"
              aria-label="Ayushman Card or Family ID"
              value={form.ayushmanCardNo}
              onChange={e => {
                update({ ayushmanCardNo: e.target.value, govtSchemeVerified: false, schemeName: '' })
                setGovtResult(null)
              }}
            />
          </div>

          {/* Aadhaar fallback */}
          {showAadhaarFallback && (
            <div className={fieldCard}>
              <FileText className="h-5 w-5 text-slate-400 flex-shrink-0" aria-hidden="true" />
              <input
                className={fieldInput}
                placeholder="Aadhaar number (12 digits)"
                aria-label="Aadhaar number"
                value={aadhaarNo}
                onChange={e => setAadhaarNo(e.target.value.replace(/\D/g, '').slice(0, 12))}
              />
            </div>
          )}

          {/* Verified */}
          {form.govtSchemeVerified && govtResult?.eligible && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-green-50 border border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13.5px] font-bold text-green-900">Eligible — {govtResult.schemeName}</p>
                <p className="text-[12.5px] text-green-700">{govtResult.coverage} · pre-auth ref: {govtResult.preAuthRef}</p>
                <p className="text-[11px] text-green-600 mt-0.5">Nothing to pay now.</p>
              </div>
            </div>
          )}

          {/* Not eligible */}
          {govtResult && !govtResult.eligible && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 space-y-2">
              <div className="flex items-start gap-2">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-bold text-red-800">Beneficiary not found</p>
                  <p className="text-[12px] text-red-600">Check your card number or try Aadhaar-linked search.</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setShowAadhaarFallback(true)}
                  className="text-[12px] font-semibold text-[#EE6B26] underline underline-offset-2"
                >
                  Try Aadhaar-linked search
                </button>
                <span className="text-slate-300">·</span>
                <button
                  onClick={() => update({ payer: 'self', govtSchemeVerified: false, schemeName: '' })}
                  className="text-[12px] font-semibold text-slate-500 underline underline-offset-2"
                >
                  Pay myself instead
                </button>
              </div>
            </div>
          )}

          {/* Verify button — hidden once verified */}
          {!form.govtSchemeVerified && (
            <>
              <button
                onClick={() => showAadhaarFallback
                  ? verifyGovt(`aadhaar-${aadhaarNo}`, form.ayushmanCardNo)
                  : verifyGovt(form.abhaId, form.ayushmanCardNo)
                }
                disabled={showAadhaarFallback ? !canVerifyAadhaar : (!canVerifyGovt || govtChecking)}
                className={cn(
                  "w-full h-12 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
                  (showAadhaarFallback ? !canVerifyAadhaar : (!canVerifyGovt || govtChecking))
                    ? "bg-slate-200 text-slate-400"
                    : "bg-green-600 text-white hover:bg-green-700",
                )}
              >
                {govtChecking
                  ? <><Loader2 className="h-4.5 w-4.5 animate-spin" /> Checking with NHA…</>
                  : <><ShieldCheck className="h-4.5 w-4.5" /> Verify Ayushman eligibility</>}
              </button>
              <p className="text-[12px] text-slate-400 ml-1">We confirm your Ayushman beneficiary status before you continue.</p>
            </>
          )}
        </div>
      )}
```

- [ ] **Step 7: Verify type-checking passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/intake/ConsultSteps.tsx
git commit -m "feat: add Govt Scheme tile and ABHA/Ayushman panel to PaymentStep"
```

---

## Task 4: Propagate Scheme on Intake Submit

**Files:**
- Modify: `src/components/intake/IntakeFlow.tsx`

- [ ] **Step 1: Add profile store import**

At the top of `src/components/intake/IntakeFlow.tsx`, add:
```typescript
import { usePatientProfileStore, emptyProfile } from "@/store/usePatientProfileStore"
```

- [ ] **Step 2: Update `addPatient` call and add `saveProfile` for govt scheme**

In `handleSubmit` (line 72–90), find:
```typescript
    addPatient({
      id: newId,
      name: form.name,
      age: parseInt(form.age, 10),
      gender: (form.gender || 'Male') as Gender,
      phone: form.phone,
      bloodGroup: 'A+',
      token: newToken,
      estimatedWait: estWaitMins,
      doctor: mode === 'video' ? (form.slotDoctor || 'Dr. Priya Nair') : 'Dr. Priya Nair',
      department: form.departments[0] ?? 'General Medicine',
      departments: form.departments,
      visitTypes: [mode === 'video' ? 'Video consult' : 'In-person OPD'],
      insurer: form.payer === 'cashless' ? (form.insurer || undefined) : undefined,
      symptoms: form.symptoms,
      history: [],
      triageLevel: triage.level,
      hasReports: form.hasReports,
    })
```

Replace with:
```typescript
    const isGovtScheme = form.payer === 'govtScheme'
    addPatient({
      id: newId,
      name: form.name,
      age: parseInt(form.age, 10),
      gender: (form.gender || 'Male') as Gender,
      phone: form.phone,
      bloodGroup: 'A+',
      token: newToken,
      estimatedWait: estWaitMins,
      doctor: mode === 'video' ? (form.slotDoctor || 'Dr. Priya Nair') : 'Dr. Priya Nair',
      department: form.departments[0] ?? 'General Medicine',
      departments: form.departments,
      visitTypes: [mode === 'video' ? 'Video consult' : 'In-person OPD'],
      insurer: isGovtScheme ? form.schemeName : (form.payer === 'cashless' ? (form.insurer || undefined) : undefined),
      symptoms: form.symptoms,
      history: [],
      triageLevel: triage.level,
      hasReports: form.hasReports,
    })

    if (isGovtScheme && form.abhaId) {
      usePatientProfileStore.getState().saveProfile(
        newId,
        { ...emptyProfile(), abhaId: form.abhaId, payerType: 'Govt scheme', insurer: form.schemeName },
        form.name,
      )
    }
```

- [ ] **Step 3: Update the reception notification to include scheme name**

Find the notification body string (line 104):
```typescript
      body: `${form.name} just checked in via kiosk. Triage: ${triage.level}. ${form.symptoms.length ? 'Symptoms: ' + form.symptoms.join(', ') + '.' : 'No symptoms provided.'} Token #${newToken}.`,
```

Replace with:
```typescript
      body: `${form.name} just checked in via kiosk. Triage: ${triage.level}. ${isGovtScheme ? `Govt scheme: ${form.schemeName} · ABHA verified. ` : ''}${form.symptoms.length ? 'Symptoms: ' + form.symptoms.join(', ') + '.' : 'No symptoms provided.'} Token #${newToken}.`,
```

- [ ] **Step 4: Verify type-checking passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/intake/IntakeFlow.tsx
git commit -m "feat: propagate ABHA/Ayushman scheme on intake submit"
```

---

## Task 5: Ayushman Badge on Admission Dashboard

**Files:**
- Modify: `src/app/admission/dashboard/page.tsx`

- [ ] **Step 1: Add Ayushman badge after the payer type text**

In `src/app/admission/dashboard/page.tsx`, find line 273:
```tsx
                        <span>{req.payerType}</span>
```

Replace with:
```tsx
                        <span>{req.payerType}</span>
                        {(req.payerType?.includes('AB-PMJAY') || req.payerType?.includes('PMJAY') || req.payerType?.includes('CMHIS')) && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                            Ayushman
                          </span>
                        )}
```

- [ ] **Step 2: Verify type-checking passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admission/dashboard/page.tsx
git commit -m "feat: show Ayushman badge on admission dashboard for PMJAY patients"
```

---

## Task 6: Ayushman Pre-Auth Section

**Files:**
- Modify: `src/app/insurance/preauth/page.tsx`

- [ ] **Step 1: Add mock Ayushman pre-auth data and state**

In `src/app/insurance/preauth/page.tsx`, after the existing `PENDING_ADMISSIONS` const (after line 16), add:

```typescript
const PENDING_AYUSHMAN = [
  {
    id: 'ADM-2026-0097',
    patient: 'Sunita Devi',
    abhaId: '14-8821-3341-7090',
    schemeName: 'AB-PMJAY' as const,
    preAuthRef: 'PMJAY-PRE-4729103',
    diagnosis: 'Uterine Fibroid — Laparoscopic Myomectomy',
    coverage: 'Covered up to ₹5,00,000/year',
  },
  {
    id: 'ADM-2026-0099',
    patient: 'Ramesh Yadav',
    abhaId: '14-3312-8891-0041',
    schemeName: 'CMHIS-UP' as const,
    preAuthRef: 'PMJAY-PRE-8812047',
    diagnosis: 'Cataract — Phacoemulsification',
    coverage: 'Covered up to ₹5,00,000/year (CMHIS-UP)',
  },
]
```

In `InsurancePreAuthPage`, add two new state variables alongside the existing ones:
```typescript
  const [ayushmanSubmitted, setAyushmanSubmitted] = useState<string[]>([])
  const [ayushmanLoading, setAyushmanLoading] = useState<string | null>(null)
```

- [ ] **Step 2: Add the Ayushman section below the existing private insurance list**

After the closing `</div>` of the `PENDING_ADMISSIONS.map(...)` block (after line 65), and before the `{draft && ...}` block, add:

```tsx
      {/* Ayushman / Govt Scheme Pre-Auth */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Govt Scheme Pre-Auth (Ayushman)</h3>
        <p className="text-slate-500 text-sm mb-4">AB-PMJAY and CMHIS-UP patients awaiting NHA pre-authorisation</p>
        <div className="space-y-3">
          {PENDING_AYUSHMAN.map((adm) => (
            <div key={adm.id} className="bg-white rounded-xl border border-teal-200 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900 text-sm">{adm.patient}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                      {adm.schemeName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{adm.id} · ABHA: {adm.abhaId}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{adm.diagnosis}</p>
                  <p className="text-xs text-teal-600 mt-0.5 font-medium">{adm.coverage}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {ayushmanSubmitted.includes(adm.id) ? (
                  <div className="text-right">
                    <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-1 rounded-full">Submitted</span>
                    <p className="text-[10px] text-slate-400 mt-1">Ref: {adm.preAuthRef}</p>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      setAyushmanLoading(adm.id)
                      await new Promise(r => setTimeout(r, 900))
                      setAyushmanSubmitted(prev => [...prev, adm.id])
                      setAyushmanLoading(null)
                      notifyAndAuditMany(['billing', 'patient'], {
                        type: 'system', priority: 'high',
                        title: `Ayushman pre-auth submitted · ${adm.id}`,
                        body: `Pre-auth submitted to NHA for ${adm.patient} (${adm.schemeName}). Ref: ${adm.preAuthRef}.`,
                        audit: {
                          action: 'insurance_claim_submitted',
                          resource: 'preauth',
                          resourceId: adm.id,
                          detail: `Ayushman pre-auth submitted · ref ${adm.preAuthRef}`,
                          userName: 'Insurance desk',
                        },
                      })
                      toast.success(`Pre-auth submitted · ref ${adm.preAuthRef}`)
                    }}
                    disabled={ayushmanLoading === adm.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
                  >
                    {ayushmanLoading === adm.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <ShieldCheck className="h-3.5 w-3.5" />}
                    Submit to NHA
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
```

- [ ] **Step 3: Verify type-checking passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/insurance/preauth/page.tsx
git commit -m "feat: add Ayushman/NHA pre-auth section to insurance coordinator page"
```

---

## Task 7: ABHA ID + Pre-Auth Ref in Discharge Summary

**Files:**
- Modify: `src/app/discharge/dashboard/page.tsx`

- [ ] **Step 1: Add profile store import**

At the top of `src/app/discharge/dashboard/page.tsx`, add:
```typescript
import { usePatientProfileStore } from "@/store/usePatientProfileStore"
```

- [ ] **Step 2: Read profile store in component**

Inside `DischargeDashboard` (or the default export), add near the top of the component body:
```typescript
  const getProfile = usePatientProfileStore(s => s.getProfile)
```

- [ ] **Step 3: Add ABHA fields to the patient row**

In the discharge queue list, find line 140 where `patient.payerType` is shown:
```tsx
            <span className="text-sm text-slate-500">{patient.payerType}</span>
```

Replace with:
```tsx
            <span className="text-sm text-slate-500">{patient.payerType}</span>
            {(patient.payerType?.includes('AB-PMJAY') || patient.payerType?.includes('PMJAY') || patient.payerType?.includes('CMHIS')) && (() => {
              const profile = getProfile(patient.patientId)
              return profile?.abhaId ? (
                <span className="text-xs text-teal-600 font-medium">
                  · ABHA: {profile.abhaId}
                </span>
              ) : null
            })()}
```

- [ ] **Step 4: Verify type-checking passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/discharge/dashboard/page.tsx
git commit -m "feat: show ABHA ID in discharge summary for Ayushman patients"
```

---

## Task 8: Final Build Verification

- [ ] **Step 1: Run TypeScript check across full project**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no new lint errors introduced by this work.

- [ ] **Step 3: Start dev server and manually verify the flow**

```bash
npm run dev
```

Walk through this checklist in the browser at `http://localhost:3000/checkin`:

1. Click "Start kiosk check-in" → proceed through intake to the Payment step
2. Tap "Govt Scheme" tile — verify it turns green and the fee card shows "Cashless · Ayushman"
3. Enter ABHA ID `14-2841-7762-9012` — verify dashes auto-insert
4. Enter Ayushman Card No `UP-2024-987654` — verify "Verify Ayushman eligibility" button enables
5. Click verify — verify loading state "Checking with NHA…" appears, then green verified card shows "CMHIS-UP" and coverage string
6. Verify "Continue" button enables
7. Enter ABHA ID `00-1234-5678-9012` — verify not-eligible red card shows with two fallback buttons
8. Navigate to `/admission/dashboard` — any admission with payerType containing "PMJAY" shows the teal "Ayushman" badge
9. Navigate to `/insurance/preauth` — verify "Govt Scheme Pre-Auth (Ayushman)" section shows two mock entries with "Submit to NHA" buttons; click one, verify toast + submitted state
10. Navigate to `/discharge` — if any discharge patient has AB-PMJAY payerType, verify ABHA ID shows

- [ ] **Step 4: Final commit if any lint/type fixes were needed**

```bash
git add -p
git commit -m "fix: address any lint/type issues from full build check"
```

---

## Summary

| Task | Files | Commit |
|---|---|---|
| 1 | `abha-mock.ts` (new) | `feat: add mock ABHA/Ayushman eligibility service` |
| 2 | `data.ts` | `feat: add govtScheme payer type and ABHA fields to IntakeForm` |
| 3 | `ConsultSteps.tsx` | `feat: add Govt Scheme tile and ABHA/Ayushman panel to PaymentStep` |
| 4 | `IntakeFlow.tsx` | `feat: propagate ABHA/Ayushman scheme on intake submit` |
| 5 | `admission/dashboard/page.tsx` | `feat: show Ayushman badge on admission dashboard for PMJAY patients` |
| 6 | `insurance/preauth/page.tsx` | `feat: add Ayushman/NHA pre-auth section to insurance coordinator page` |
| 7 | `discharge/dashboard/page.tsx` | `feat: show ABHA ID in discharge summary for Ayushman patients` |
| 8 | — | Full build + manual walkthrough |
