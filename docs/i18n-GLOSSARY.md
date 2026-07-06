# Localization (EN / Hindi) — how it works & how to correct wording

The whole platform is bilingual via **next-intl**. The language toggle
(`src/components/ui/LocaleToggle.tsx`) switches instantly with no reload and
persists to a cookie; it renders on every dashboard (in `AppShell`) and on the
public routes (check-in, ABHA, family-track, discovery, journey, `/p/[uhid]`).

## Where the strings live

- `messages/en/<namespace>.json` + `messages/hi/<namespace>.json` — one namespace
  per module/segment (e.g. `nurse`, `admin`, `billing`) plus shared ones
  (`nav`, `ui`, `common`, `labs`, `orderSets`, `notify`, `landing`, `intake`, …).
  **46 namespaces, ~8,665 keys**, EN and HI in strict key parity.
- `messages/en/index.ts` + `messages/hi/index.ts` — **generated barrels** that merge
  the namespace files. Run `node scripts/i18n-barrel.mjs` after adding/removing a
  namespace file. Consumed by `src/i18n/request.ts` (server) and
  `src/components/i18n/LocaleProvider.tsx` (client).

## How components use it

- Client: `const t = useTranslations('<namespace>')` then `t('key')`.
- Server: `const t = await getTranslations('<namespace>')`.
- Interpolation uses ICU args: `t('greeting', { name })`.
- Dynamic keys are guarded: `t.has(\`k.\${v}\`) ? t(\`k.\${v}\`) : v`.

## Hindi register

Modern, conversational Hindi with common English loanwords in Devanagari
(PhonePe / Paytm style): "अपॉइंटमेंट", "डॉक्टर", "रिपोर्ट", "सेव करें", "डैशबोर्ड".
**Not** formal/literary/Sanskritised ("सहेजें", "चिकित्सक", "दूरभाष").

## Correcting Hindi wording in bulk

The first Hindi pass was auto-generated, so some wording will want polishing.
To change a term everywhere at once:

1. Edit `scripts/i18n-terms.json` — add `"current wording": "preferred wording"`.
2. Run `node scripts/i18n-reterm.mjs` — applies the replacements across every
   `messages/hi/*.json` value (keys untouched), idempotently.
3. Re-check parity is unaffected (it only edits values).

## What is intentionally NOT translated

Program-logic values (status enums, store/API keys, ids, codes like UHID/ABHA/ICD),
seeded demo data (patient names, mock numbers), and proper nouns / acronyms
(NABH, ABDM, DISHA, DPDP, HL7, FHIR, OPD, IPD, ICU, UPI) stay in English by design.

## Verifying after changes

- `npx tsc --noEmit` — must be clean.
- Parity: every `messages/en/*.json` key must exist in the matching `hi` file.
- Toggle EN⇄हिं on a page and confirm labels, buttons, forms, toasts and empty
  states all switch.
