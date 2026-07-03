# Agentix HIMS — Design Language

The north star for the project-wide rework. Written from a healthtech product
lens: we optimise for **clinical safety, cognitive load, and trust** — not
decoration. Every page should be reducible to these rules.

## 1. Two modes, one system

The product has two audiences with opposite needs. Same tokens, different density.

| | **Clinical surfaces** (staff) | **Patient surfaces** |
|---|---|---|
| Goal | Glanceability, throughput, zero error | Reassurance, clarity, one next step |
| Density | High — rationed whitespace, dense worklists | Low — generous space, calm |
| Type floor | 13–14px body, tabular numbers for data | 15–16px body |
| Color | Ink + status; almost no decorative fills | Ink + one warm accent + photography |
| Motion | Minimal, functional | Gentle, welcoming |

## 2. The only two questions that matter

- **Clinician:** *"What needs my attention, and what do I do about it?"* → Critical/abnormal state is never more than one glance away; the primary action is obvious.
- **Patient:** *"What's happening to me, and what do I do next?"* → Surface current journey stage + the next action above the fold.

## 3. Color contract (white-first, single accent)

Surfaces are **white**; separation is by **hairline border first, soft shadow second**. Color is meaning, not decoration.

- **Brand/accent:** one orange — the Agentix HIMS logo orange `#EE6B26`, applied through `--color-primary` (the exact logo orange, used for fills with navy `--color-on-primary` `#0D2032` text) and `--color-accent` (its AA-safe deep-orange text shade `#B84A16`, for links/emphasis on white). Paired with dark navy `#0D2032` for hero/dark surfaces. Used for primary actions, links, active state, focus, selection. Nothing else competes; no purple/indigo/teal.
- **Status is semantic and fixed everywhere** — use `StatusPill` / status tokens, never raw hex:
  - 🔴 `critical` danger — life-threatening / immediate
  - 🟠 `urgent` — high priority, act soon
  - 🟡 `caution` warning — abnormal / needs attention
  - 🟢 `stable`/`done` success — normal / on-track / resolved
  - 🔵 `info` — informational
  - ⚪ `pending`/`neutral` — waiting / default
- **Banned:** gradient-filled text/numbers, rainbow stat tiles, decorative blue/green fills, color-only status. Demote brand-green to *success only*.

## 4. Status is triple-encoded (patient-safety rule)

**Color alone is a defect.** Every status = colour + icon + text (`StatusPill`),
so it survives greyscale, glare, and screen readers. One vocabulary across
doctor, nurse, lab, pharmacy and the patient app → learnability → fewer errors.

## 5. Spacing — 8pt rhythm (Apple-level)

Space steps: 4 · 8 · 12 · 16 · 24 · 32. Use the `Stack`/`Grid` helpers and
`PageContainer` for page width + gutters. Card padding is a token, not ad-hoc.

## 6. Typography — semantic, not pixel-poked

Use the type scale classes (`t-display`/`t-h1`/`t-h2`/`t-h3`/`t-title`/`t-body`/
`t-label`/`t-caption`/`t-overline`), never `text-[Npx]`. Readable floor: 14px
body, 12px caption. Data uses `tabular-nums`. One `<h1>` per page (the shell
owns it); in-content titles are `<h2>`+.

- **Stat values:** use `.t-kpi` (28px tabular) for KPI tile numbers; **dense data
  cells:** `.t-mono-num`. Both are tabular so columns never reflow.
- **Heading weight — clinical = 700.** Clinical surfaces render headings at weight
  **700** for ward-tablet glanceability under glare. This intentionally **overrides**
  DESIGN.md's "display weight 300" rule, which is a *marketing/brand* signature.
  The thin tier survives as `.t-display-thin` (weight 300, negative tracking) —
  **opt-in for patient-facing / landing heroes only**, never clinical worklists.

## 6b. Elevation & micro-interaction (the "premium" layer)

Depth and motion come from **tokens, not effects** — no decorative glow/gradients.

- **Elevation:** layered, ink-tinted shadows (`shadow-xs…2xl`, `shadow-card`).
  Hairline border first, shadow second. `.surface-raised` for secondary panels.
- **Micro-interaction:** `.u-lift` (card hover lift), `.u-press` (tap scale),
  `.u-row` (worklist row hover). Framer lists use `motionPresets.listItem(i)` /
  `cardIn` from [`src/lib/design-tokens.ts`](../src/lib/design-tokens.ts) for a
  uniform 28ms-stagger spring entrance.
- **Focus:** the global two-tone focus ring (`--shadow-focus`) reads on any
  surface. Don't remove focus styling on interactive elements.

## 7. Accessibility = safety (AA floor, Google-level)

- Contrast AA minimum; never rely on colour alone.
- Touch targets ≥44px on touch (`.tap`); inputs always labelled.
- Modals trap focus + restore it (`useFocusTrap`), `aria-modal`, ESC + backdrop close.
- Every image has `alt`; icon-only buttons have `aria-label`.
- Honour `prefers-reduced-motion`.

## 8. Mobile-first (ward tablets & patient phones)

Author the phone layout first (`grid-cols-1`), enhance up (`sm:`/`md:`/`lg:`).
Wide tables become stacked cards via `ResponsiveTable` — never horizontal scroll
on a phone.

## 9. Imagery

Human-centred photography (`Photo`, Unsplash via next/image, lazy + blur) on
**landing + patient-facing only**. Never in clinical worklists (focus + perf).
Always a tinted overlay behind text for AA contrast.

## Building blocks (reuse, don't reinvent)

`PageContainer` · `PageHeader` · `Stack`/`Grid` · `Card` · `StatusPill` ·
`StatCard` · `Badge` · `Button` · `Input`/`Textarea`/`Select` · `ResponsiveTable` ·
`DataTable` · `EmptyState` · `Photo` · `ConfirmDialog` · `useFocusTrap`.
Tokens live in [`src/app/globals.css`](../src/app/globals.css).
