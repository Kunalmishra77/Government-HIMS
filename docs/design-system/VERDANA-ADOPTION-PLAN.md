# Design System Adoption Plan

**Product:** Agentix HIMS (project name unchanged)
**Design language target:** **Stripe-inspired** (`/DESIGN.md` at repo root) — supersedes the earlier Verdana target
**Author role:** Principal UI Architect
**Status:** Phase 0 spike applied to `reception/*` — see §0

> **History:** this plan was first written against the *Verdana Health* spec (navy + sage). The target has since changed to a **Stripe-inspired** language (electric-indigo CTA, deep-navy ink, Inter/ss01 type, pill buttons, tabular numerics). **The mechanism and phasing below are unchanged** — only the target token *values* differ. §0 records the new target and what the Phase-0 spike already did.

---

## 0. Target tokens — Stripe (current) & Phase-0 spike status

Source of truth: `/DESIGN.md` (Stripe-inspired). All values live in `src/app/globals.css` `@theme`; pages consume tokens.

| Token | Old (blue) | **Stripe target (applied)** |
| --- | --- | --- |
| `--color-primary` | `#1976E6` | **`#533afd`** indigo — CTAs/links only |
| `--color-primary-light` | `#338AF0` | `#665efd` |
| `--color-primary-dark` | `#0048B5` | `#4434d4` (hover/press) |
| `--color-accent` | `#005FD1` | `#533afd` (Stripe uses one indigo for CTA + links) |
| `--color-foreground` (ink) | `#0F172A` | **`#0d253d`** deep navy (never pure black) |
| `--color-foreground-muted` | `#475569` | `#273951` |
| `--color-foreground-lighter` | `#64748B` | `#64748d` |
| `--color-background` | `#F8FAFC` | `#F6F9FC` (Stripe canvas-soft) |
| `--color-border` | `#E2E8F0` | `#E3E8EE` |
| `--color-border-hover` | `#CBD5E1` | `#A8C3DE` (cool input hairline) |
| `--font-body` / `--font-heading` | Manrope | **Inter** (open-source Sohne stand-in) + `ss01` global |
| Numeric cells | — | `.t-numeric` tabular-nums (Stripe `tnum`) |
| Button radius | `rounded-lg` (12px) | **`rounded-full`** (pill) |
| Input radius | 12px | 6px (planned) |

**Deliberate deviations from Stripe (principal-architect judgment, dense clinical app):**
- **No gradient-mesh heroes** on clinical screens — they hurt readability/density. Mesh is allowed only on marketing/login surfaces.
- **No weight-300 thin display everywhere** — Stripe's thin editorial display is a marketing trait; functional weights (600/700) are kept for headings so dense data stays legible. Thin is reserved for large hero text.
- **Indigo is CTA/link only**, never body text (per Stripe Don'ts) — deep-navy ink carries body copy.

### Phase-0 spike → full rollout (DONE)
- `globals.css`: flipped colour, ink, border, background, gradient, glow tokens to Stripe; enabled `ss01` on `body`.
- `layout.tsx`: load **Inter** (300–700) via Google Fonts; dropped Manrope; stack leads with Inter.
- `ui/button.tsx`: base radius → **pill**; removed per-size radius overrides.
- **Colour codemod rolled out app-wide** (~1,975 occurrences across 238 files):
  - **Non-print files (UI):** hardcoded brand-blue → **token utilities** (`text-[var(--color-primary)]`, `bg-primary`, …) and blue `rgba()` → indigo, alpha preserved.
  - **8 print-builder files** (`window.open` standalone docs): → **indigo literals** (`#533afd`) since print documents can't read app CSS variables.
  - `globals.css` utility classes (`.ai-*`, `.queue-token-now`, glow) recoloured to indigo.
- **Result:** **0 legacy blue** remaining in `src` (`.tsx` + `.css`); `tsc --noEmit` clean; no broken Tailwind arbitrary values.
- **Guardrail added** (`eslint.config.mjs`): `no-restricted-syntax` **errors** on any reappearance of the legacy blue palette (hex + `rgba(25,118,230)`, in string & template literals). Verified: 0 false positives on migrated code; catches a reintroduced `#1976E6`.

### Follow-ups (not done)
- Verified via served-CSS inspection, **not** a literal screenshot (Chrome extension was not connected).
- The 8 print-builder files use raw indigo literals (not tokens) in their UI portions — tokenise later.
- Broader debt still open: neutral/semantic hardcoded hex (`#0F172A`, slate, success/danger) and ~3,960 arbitrary `text-[Npx]` — codemod to tokens / `.t-*` scale, then extend the guardrail to `warn` on generic hex + arbitrary px.
- Input radius → 6px (Stripe); restyle `NeonBadge`/glass/glow to the calmer treatments.

---

## 1. Executive summary

Agentix HIMS **already ships a mature, token-driven design system** in `src/app/globals.css`: Tailwind v4 `@theme` CSS variables for colour/type/spacing/radius/elevation, a semantic type scale (`.t-display … .t-caption`), ink/surface helpers, and a card + chip component layer. The architecture we would normally spend a quarter building **is already here**.

Therefore adopting Verdana Health is **not a re-architecture. It is a re-tokenization (re-skin) plus governance.** Three pieces of work:

1. **Re-point the token values** to Verdana (navy primary, sage accent, gentler shadows, 8px radius, Plus Jakarta / DM Sans / Fira Code). This is essentially one file.
2. **Close the bypass.** ~350 files set colour and type *directly* (`#1976e6`, `text-[12.5px]`) instead of through tokens. These will not move when tokens change. This is ~90% of the effort.
3. **Reconcile conflicts** between the current visual language (neon badges, glow, glass, multi-stop gradients) and Verdana's explicit "calm, clinical, no neon, no heavy shadow" rules.

Get those three done and Agentix permanently looks like Verdana — and **stays** that way because lint refuses regressions.

### The one-paragraph thesis

> Do **not** find-and-replace `#1976e6 → #0F172A`. That hard-codes a second palette and re-creates the problem. Instead, route every hardcoded value through the **semantic token** it should have used (`#1976e6 → text-primary` / `bg-primary` / `var(--color-primary)`), verify the app looks identical, and only **then** flip the token *values* to Verdana in `globals.css`. The palette change becomes a single reviewed diff; the visual flip is instant and reversible.

---

## 2. Current-state audit (measured)

| Signal | Count | Meaning |
| --- | --- | --- |
| `.tsx` files in `src` | 435 | Scope of the surface |
| Files with hardcoded 6-digit hex | 285 | Bypass the colour tokens |
| Total hardcoded hex occurrences | 3,139 | Migration units (colour) |
| — of which `#1976e6` (current primary) | 1,593 | 51% — one value |
| — of which `#0048b5` (primary-dark) | 405 | 13% |
| — of which `#EE6B26` (intake teal) | 114 | The `.intake-theme` sub-brand |
| Files with arbitrary type `text-[Npx]` | 352 | Bypass the type scale |
| Arbitrary `text-[Npx]` occurrences | 3,960 | Migration units (type) |
| `NeonBadge` call sites | 206 | Conflicts with Verdana "no neon" |

**Leverage:** 64% of all hardcoded colour is just two values (`#1976e6` + `#0048b5` = the brand blue ramp). A single codemod that maps the blue ramp to the `primary`/`accent` tokens neutralises most of the colour debt. The type debt (3,960 arbitrary sizes) is more diffuse and is the larger long-tail.

**Good news already in place:** `@theme` tokens, `.t-*` scale, `.chip-*`, `.hms-card*`, focus-visible ring, reduced-motion, tap-target helper, scoped `.intake-theme`. Verdana maps cleanly onto all of these.

---

## 3. Gap analysis — current Agentix tokens vs Verdana spec

| Dimension | Current Agentix | Verdana Health target | Action |
| --- | --- | --- | --- |
| **Primary** | `#1976E6` blue (buttons + links + accents, all one colour) | **Navy `#0F172A`** for primary fills/headers; **Sage `#059669`** for links/CTAs/interactive | Split one role into two: `--color-primary` → navy, `--color-accent` → sage |
| **Secondary text** | `#475569` / `#64748B` | Slate `#64748B` | Already aligned |
| **Background** | `#F8FAFC` | `#F8FAFC` | Identical ✅ |
| **Surface** | `#FFFFFF` | `#FFFFFF` | Identical ✅ |
| **Success** | `#16A34A` | `#22C55E` (range), `#16A34A` text | Keep `success` + `success-light`; align |
| **Warning** | `#F59E0B` | `#EAB308` | Re-point token value |
| **Error/Danger** | `#DC2626` / `#EF4444` | `#EF4444` (with `#DC2626` text) | Already aligned |
| **Info** | `#2563EB` | `#0EA5E9` (sky) | Re-point token value |
| **Heading font** | Manrope | **Plus Jakarta Sans** | Swap font + stack |
| **Body font** | Manrope | **DM Sans** | Swap font + stack |
| **Mono font** | — (none) | **Fira Code** (vitals/lab tabular) | Add font; wire `.t-numeric` |
| **Radius (interactive)** | 12px (`--radius-md`) | **8px** default | Tighten radius tokens |
| **Radius (card)** | 20px (`--radius-xl`) | 8px card / 16px large container | Tighten card radius |
| **Elevation** | up to `0 24px 56px / 14%` | Gentle: `1/3px@3%` … `8/32px@10%` | Soften the whole shadow scale |
| **Chips** | mixed-case `.chip-*` | **UPPERCASE + 0.5px tracking** | Add uppercase to status chips |
| **Spacing** | implicit Tailwind 4px scale | 8px base (xs4 / sm8 / md16 / lg24 / xl32 / 2xl48 / 3xl64) | Document + align tokens |
| **Anti-patterns** | NeonBadge, `ai-glow`, glass, hero gradients | "No neon, no heavy shadow, no decorative" | Restyle/retire (see §5) |

**Net:** colours, surfaces, spacing and the type-scale *shape* are already close. The visible deltas are **palette role-split (navy+sage), fonts, tighter radius, softer shadows, uppercase chips, and retiring the neon/glow/glass layer.**

---

## 4. Target token architecture

All values live in **one place** — `src/app/globals.css` `@theme inline`. Pages consume tokens, never raw values.

### 4.1 Colour (re-pointed values)

```css
@theme inline {
  /* Verdana Health — primary navy, sage interactive */
  --color-primary:       #0F172A;   /* navy — primary buttons, strong headers */
  --color-primary-light: #1E293B;   /* hover */
  --color-primary-dark:  #020617;   /* active */
  --color-primary-soft:  rgba(15, 23, 42, 0.05);

  --color-accent:        #059669;   /* sage — links, CTAs, interactive */
  --color-accent-light:  #10B981;
  --color-accent-dark:   #047857;
  --color-accent-soft:   rgba(5, 150, 105, 0.10);

  --color-background: #F8FAFC;
  --color-surface:    #FFFFFF;

  --color-foreground:        #0F172A;
  --color-foreground-muted:  #475569;
  --color-foreground-lighter:#64748B;

  --color-success: #22C55E;  --color-success-strong: #16A34A;
  --color-warning: #EAB308;  --color-warning-strong: #CA8A04;
  --color-danger:  #EF4444;  --color-danger-strong:  #DC2626;
  --color-info:    #0EA5E9;
}
```

> **Accessibility note (binding):** Sage `#059669` on white ≈ 3.8:1 — acceptable for UI/large text, **not** for small body text. Warning `#EAB308` on white fails AA for text. Rule: **sage and warning are fill/icon/large-text colours; for text use the `-strong` variants** (`#047857`, `#CA8A04`). Encode this in the chip helpers and lint.

### 4.2 Radius (tightened to Verdana 8px system)

```css
--radius-sm:  0.25rem;  /* 4px  — badges, tags */
--radius-md:  0.5rem;   /* 8px  — buttons, inputs, cards (Verdana DEFAULT) */
--radius-lg:  0.75rem;  /* 12px — modals, dropdowns */
--radius-xl:  1rem;     /* 16px — large containers, hero */
--radius-full: 9999px;
```

Because `.hms-card*`, `.chip`, and the `ui/*` primitives already reference `--radius-*`, retuning these values re-rounds the entire app at once.

### 4.3 Elevation (softened, diffused)

```css
--shadow-sm:  0 1px 3px  rgba(15,23,42,0.03);
--shadow:     0 2px 6px  rgba(15,23,42,0.05);
--shadow-md:  0 4px 16px rgba(15,23,42,0.07);
--shadow-lg:  0 8px 32px rgba(15,23,42,0.10);
```
Map existing `--shadow-card → --shadow-sm`, `--shadow-md` (hover) → `--shadow`, modals → `--shadow-lg`. Delete `--shadow-glow*`.

### 4.4 Typography (fonts + scale)

- **Fonts:** add `@fontsource/plus-jakarta-sans`, `@fontsource/dm-sans`, `@fontsource/fira-code` (swap the Manrope imports in `src/app/layout.tsx`).
- **Stacks:**
  ```css
  --font-heading: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;
  --font-body:    "DM Sans", "Inter", system-ui, sans-serif;
  --font-mono:    "Fira Code", ui-monospace, "SF Mono", monospace;
  ```
- **Scale:** the existing `.t-*` classes already encode Verdana's ramp (Display 36/40, H1 30/32, H2 24, H3 20, Body 16, Body SM 14, Caption 12). Minor re-tune to match exactly; **keep the class names** so call sites are stable.
- **Numerics:** `.t-numeric` gains `font-family: var(--font-mono)` so vitals, lab values and tokens render in Fira Code with tabular alignment (Verdana Do #10).

---

## 5. Component conformance & conflict reconciliation

Verdana defines Buttons, Cards, Inputs, Chips, Lists, Checkboxes, Radios, Tooltips. We already have `src/components/ui/*` primitives. Strategy: **bring the primitives to spec; keep their public APIs** so the ~hundreds of call sites don't change.

| Verdana component | Current | Action |
| --- | --- | --- |
| Button (Primary/Secondary/Ghost/Destructive; sm/md/lg; 0.4 disabled) | `ui/button` | Re-tune variants to spec; navy primary, sage optional CTA variant |
| Card (Default border / Elevated md-shadow, 8px) | `.hms-card*` | Re-tune radius+shadow tokens (auto); drop glass/dark-glass or mark legacy |
| Input (hover/focus/error rings per spec) | `ui/input` | Align border/focus-ring to navy `#0F172A18` |
| Chip (uppercase, 4px radius, tracking) | `.chip-*` | Add `text-transform:uppercase; letter-spacing:.5px` to status chips |
| Checkbox / Radio (18px, navy checked) | — verify | Build/confirm primitives to spec |
| Tooltip (navy bg, 8px, 240px, 150/0ms) | — verify | Build/confirm primitive |
| List (48px row, hover `#F8FAFC`) | ad hoc | Provide a `List`/`Row` primitive |

### Conflicts to retire (Verdana Don'ts #4, #9)

- **`NeonBadge` (206 uses):** Verdana bans neon. **Do not touch 206 call sites.** Restyle the component *internally* to render a calm Verdana status chip (tinted bg + `-strong` ink), keep the `variant` API. One file, 206 sites conform instantly. Rename to `StatusBadge` later via codemod (optional).
- **`ai-glow`, `shadow-glow*`, `queue-token-now` glow, `ai-badge` gradient:** soften to diffused elevation; remove glow rings.
- **`hms-card-glass` / `hms-card-dark-glass`:** off-language for "clean clinical." Mark deprecated; allow only on marketing/hero, not clinical screens.
- **Multi-stop hero gradients (`gradient-hero` `#002A66→…`):** replace with navy flat or a single-hue subtle gradient.
- **`.intake-theme` teal sub-brand (`#EE6B26`):** Verdana has no teal. **Decision needed (§10):** remap the patient check-in theme to a sanctioned Verdana variant (sage-forward) or retire it. Recommendation: keep the *scoping mechanism*, re-point its values to sage.

---

## 6. The migration engine (closing the bypass)

This is the bulk of the work. Two codemods + two guardrails.

### 6.1 Colour codemod — hex → semantic token

A scripted, reviewable transform (jscodeshift / regex with an allowlist map). It maps **values to roles**, not values to values:

| Hardcoded | → Token utility | → Inline style |
| --- | --- | --- |
| `#1976e6`, `#005fd1` | `text-primary` / `bg-primary` / `border-primary` | `var(--color-primary)` |
| `#0048b5` | `bg-primary-dark` / hover | `var(--color-primary-dark)` |
| `#0f172a` (as ink) | `text-foreground` | `var(--color-foreground)` |
| `#64748b`,`#94a3b8` | `text-foreground-lighter/placeholder` | token |
| `#16a34a`,`#dc2626`,`#f59e0b` | `text-success/danger/warning` | token |
| `rgba(25,118,230,.07)` | `bg-primary-soft` | `var(--color-primary-soft)` |

**Critical caveat — the navy/sage split cannot be fully automated.** `#1976e6` today means *both* "primary button" and "link/CTA." The codemod maps **all** of it to `--color-primary` (safe: app looks unchanged because the token still equals blue at this stage). A **second, human-reviewed pass** reassigns link/interactive instances to `--color-accent`. Only then do we flip `--color-primary → navy`, `--color-accent → sage` in §4.1. Sequence:

1. Codemod hex → `primary`/semantic tokens. **App looks identical.** Merge.
2. Human pass: reclassify links/CTAs/positive-interactive → `accent`. **Still identical.** Merge.
3. Flip token *values* to Verdana in `globals.css`. **Instant visual adoption.** One diff, trivially revertible.

### 6.2 Type codemod — `text-[Npx]` → scale

Map arbitrary px to the nearest `.t-*` class / Tailwind step (round to the scale; never invent sizes below the 12px floor):

| `text-[Npx]` | → |
| --- | --- |
| `text-[10.5px]`, `text-[11px]` | `t-caption` (12px floor) or `text-2xs` per a11y review |
| `text-[12px]`, `text-[12.5px]` | `t-caption` |
| `text-[13px]` | `t-label` |
| `text-[14px]` | `t-body` |
| `text-[16px]` | `t-body-lg` |
| `text-[18–20px]` | `t-h3` |
| `text-[24px]` | `t-h2` |

Run per-directory, screenshot-diff each batch (see §8). Sizes below 12px are flagged for manual a11y decision, not auto-bumped silently.

### 6.3 Guardrail — ESLint (prevents regression forever)

Add `eslint-plugin-tailwindcss` + a custom rule (or `no-restricted-syntax`) that **errors** on:

- 6-digit hex literals in `className` / `style` (`/#[0-9a-f]{6}/i`) outside `globals.css`.
- Arbitrary type `text-[…px]` and arbitrary colour `[#…]` / `bg-[#…]`.
- Direct import/use of deprecated utilities (`hms-card-glass`, `shadow-glow`) on clinical routes.

Make it `warn` during migration, `error` after each directory is cleared (ratchet). This is what makes the system *stick*.

### 6.4 Guardrail — visual regression

Playwright screenshot snapshots of ~30 representative routes (one per role) so every migration batch is diffed pixel-wise before/after. Token-flip day (step 3 above) is expected to change every snapshot — reviewed as one intentional baseline update.

---

## 7. Governance — keeping it Verdana

1. **Single source of truth:** `globals.css` `@theme`. No colour/size literals anywhere else. Enforced by §6.3.
2. **Vendored spec:** commit `verdana-health-design-system-DESIGN.md` into `docs/design-system/` so the spec is versioned with the code.
3. **Primitive-first rule:** new UI composes `ui/*` primitives + `.t-*` + tokens. PRs adding raw hex/px are blocked.
4. **Do's/Don'ts encoded:** Verdana's 10 rules become lint rules + a short `CONTRIBUTING-UI.md` (e.g. "sage = interactive/positive only," "uppercase chip labels," "Fira Code for numerics," "no neon/heavy shadow").
5. **Component gallery:** a `/design-preview` route (the dir already exists) rendering every primitive in every state — the living style guide and the visual-regression target.
6. **CLAUDE.md / AGENTS.md update:** add the design-token rules so AI-assisted edits also conform.

---

## 8. Phased rollout

| Phase | Scope | Exit criteria | Risk |
| --- | --- | --- | --- |
| **0 — Spike (1–2 d)** | Build codemods on `src/app/reception/*` only; flip tokens locally; screenshot-diff | Codemods proven on 1 module; navy/sage split validated on real screens | Low |
| **1 — Foundation** | Fonts swapped, token values authored behind a flag, `.t-numeric`→Fira Code, soften shadows, tighten radius, restyle `NeonBadge`, build missing primitives (checkbox/radio/tooltip/list) | Primitives match spec in `/design-preview`; a11y contrast signed off | Med (radius/shadow change is global) |
| **2 — Colour migration** | Run hex→token codemod across all roles, directory by directory; human navy/sage pass | 0 hardcoded hex outside `globals.css`; lint ratcheted to error | Med |
| **3 — Type migration** | `text-[px]`→scale codemod, batched + screenshot-diffed | 0 arbitrary `text-[px]`; lint error | Med (volume: 3,960 sites) |
| **4 — Palette flip** | Set `--color-primary→navy`, `--color-accent→sage`, retire glow/glass on clinical routes | App renders Verdana; visual-regression baseline updated & reviewed | High-visibility, low-tech-risk (one file, revertible) |
| **5 — Lock-in** | Guardrails to `error`, gallery published, CONTRIBUTING-UI.md, spec vendored | CI blocks regressions | Low |

Sequencing rationale: foundation + token-routing happen **while the app still looks blue** (zero visual risk), so the only visually disruptive step (Phase 4) is a single, reviewed, instantly-revertible diff.

---

## 9. Effort & risk

- **Rough sizing:** Phase 0–1 ≈ 1 week; Phase 2 ≈ 3–5 days (codemod + review of 285 files); Phase 3 ≈ 4–6 days (352 files, screenshot-gated); Phase 4 ≈ 1 day; Phase 5 ≈ 2 days. **~3 weeks** of focused work, most of it mechanical and reviewable.
- **Top risks & mitigations:**
  - *Codemod mis-maps a semantic colour* → tokens stay blue until Phase 4; screenshot diffs catch drift; per-directory review.
  - *Radius/shadow change looks wrong somewhere* → caught in Phase 1 on `/design-preview` before propagation.
  - *Sage contrast on small text* → binding rule §4.1, lint forbids sage-on-white text.
  - *Big-bang regression* → never big-bang; ratcheted lint + visual snapshots per batch.

---

## 10. Decisions needed (blocking)

1. **Navy + Sage split** — confirm primary buttons go **navy** and links/CTAs/positive-interactive go **sage** (per Verdana). This is the defining visual change.
2. **`.intake-theme` (patient check-in teal)** — remap to a sage-forward Verdana sub-theme (recommended) or retire it entirely?
3. **Glass / hero-gradient / AI-glow treatments** — retire everywhere, or keep on non-clinical marketing surfaces only (recommended)?
4. **Dark mode** — in scope now or explicitly deferred? (Token architecture supports it; spec doesn't define it.)
5. **`NeonBadge` rename** — restyle-in-place only, or also codemod-rename to `StatusBadge`?
6. **Project naming** — confirmed: **product stays "Agentix HIMS"; "Verdana Health" labels the design system only.** No metadata/title changes.

---

## 11. Definition of done

- `globals.css` is the only place colour/type/radius/shadow values exist.
- 0 hardcoded hex and 0 arbitrary `text-[px]` outside the token layer (lint-enforced).
- Fonts: Plus Jakarta Sans / DM Sans / Fira Code; numerics in Fira Code.
- All `ui/*` primitives match the Verdana spec and render in `/design-preview`.
- Verdana Do's/Don'ts encoded as lint + `CONTRIBUTING-UI.md`.
- Visual-regression suite green against the Verdana baseline.
- Product name unchanged: **Agentix HIMS**.
