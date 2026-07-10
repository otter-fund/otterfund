<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Next.js 16 gotchas (don't get burned)

- **Middleware is now `proxy.ts`.** Next 16 renamed Middleware → Proxy. The file lives at `src/proxy.ts` with a named `proxy(request)` export and a `config.matcher`. It is auto-discovered by filename — it looks unreferenced (nothing imports it) but it runs on every request. **Do not delete it as "dead code."** It owns the auth/onboarding redirect logic; page-level `auth()` guards are a second layer, not a replacement.

## Project structure

Budgeting app: Next.js 16 (App Router, Turbopack) · Prisma 7 + Postgres (Supabase) · Supabase Auth · Anthropic SDK. `@/*` maps to `src/*`. The product is **otterfund** — that is the only brand name in the system (no other names anywhere).

```
src/
  proxy.ts                  # Next 16 middleware — auth + onboarding redirects (see above)
  app/
    layout.tsx              # root layout: Newsreader + Hanken fonts + <Providers>
    page.tsx                # landing (server component, redirects if logged in)
    icon.svg                # favicon — the otterfund otter mark (coral-filled copy of otter-mark.svg)
    globals.css             # design tokens (@theme + :root) and otterfund utility classes
    (auth)/ login/ register/ # auth route group (clean centered layout, no orbs)
    dashboard/ onboarding/ settings/   # one page.tsx each (server: fetch + guard)
    api/**/route.ts         # REST handlers (auth via lib/api-auth)
  components/
    otterfund/                  # THE design system + app shell (all "use client")
      otterfund-shell.tsx       # app shell: light icon-rail sidebar + topbar + page switch + all modals
      logo.tsx              # <LogoMark> (otter mark, coral, from otter-mark.svg) + <OtterFace> (otter AI icon)
      card.tsx              # <Card> (surface card) + <CardLabel> (uppercase eyebrow)
      theme.ts              # accent theming — see Design system below
      pages/                # overview, transactions, accounts, goals, brand-kit
    ui/                     # @base-ui primitives (button, input, dialog, badge, select). NO feature logic.
    dashboard/
      modals/               # add-/edit- transaction·goal·account + import-modal (functional, wired into otterfund-shell)
      notifications-panel.tsx
    onboarding/ settings/   # feature client components
    providers.tsx           # Providers passthrough (Supabase needs no client auth provider)
  lib/
    supabase/               # Supabase Auth clients (browser/server/admin/middleware) — auth only, never data
    api-auth.ts             # getApiUser() — Supabase session for api/ route handlers
    dashboard-context.ts    # requireUser() — page auth + onboarding guard (Supabase getUser + profile)
    constants.ts            # shared domain constants (ACCOUNT_TYPES, CURRENCIES)
    types.ts                # central view-model types — define shared types HERE
    format.ts               # currency/number formatting (client-safe)  → exports fmt()
    utils.ts                # cn() tailwind helper (client-safe)
    actions/ ai/ db/        # server-only: server actions / Anthropic calls / prisma + queries
```

## Design system — "otterfund" (READ BEFORE TOUCHING ANY UI)

One cohesive language. Build new UI from these primitives so everything stays on-brand. Source of truth: `src/components/otterfund/` + the tokens in `globals.css`.

**Color** — all defined as CSS vars; never hardcode hexes for these:
- Neutrals (defined in `@theme`; use as e.g. `text-[var(--color-of-ink)]` or `bg-[var(--color-of-surface)]`). The full set: `--color-of-canvas` (warm page bg), `--color-of-surface` (cards), `--color-of-ink` (text), `--color-of-muted` and `--color-of-faint` (secondary/tertiary), `--color-of-line` and `--color-of-line-soft` (borders/dividers), `--color-of-clay` plus `--color-of-clay-tint` (alerts).
- The shadcn `:root` tokens (`--primary`, `--accent`, `--border`, `--ring`, …) are retuned to otterfund, so `<Button>`/`<Input>`/`<Badge>`/`<Select>` are automatically on-brand. `--primary` = the evergreen accent; `--accent` = its soft tint.
- **Accent is hue-derived.** `theme.ts` exports `deriveTheme(accent)` → `{ accent, accentDeep, accentTint, accentTintBorder, clay, clayTint, ink, muted }`. The whole palette (deep tones, fills, badges, chart, progress) follows ONE accent hue. The Brand-kit page lets the user switch among `SCHEMES` (8 accents); the shell holds accent state and exposes it as `--of-accent` on its root, passing `accent` + `theme` down to every page. New tinted UI should derive from the active theme, not pick a fixed color.
- `tintFor(category)` → `[bg, ink]` for transaction/account avatar tiles.

**Type** — three faces (loaded in `layout.tsx`):
- `var(--font-num)` = **Newsreader** (serif) — money figures + display headings. Apply the `.of-num` class on any number/currency (tabular, lining).
- `var(--font-ui)` = **Hanken Grotesk** — everything else (the body default).
- `var(--font-brand)` = **Space Grotesk** — reserved for the brand name only, via `<Wordmark>` (see below).

**Brand name** — the word "otterfund" is a wordmark. NEVER write it as plain visible text; always render it with `<Wordmark />` from `@/components/otterfund/wordmark` (it sets the name in Space Grotesk via the `.of-wordmark` class, inheriting size + color). This covers standalone logotype and inline-in-a-sentence mentions alike. Leave the literal string "otterfund" only where a component can't go or shouldn't be styled: `<title>`/metadata + SEO strings, `aria-label`s, emails, URLs, code identifiers/import paths, and AI system prompts. **Spacing gotcha:** put an explicit `{" "}` on any side of `<Wordmark />` that abuts a word (`<Wordmark />{" "}does`, `Everything{" "}<Wordmark />`) — a bare JSX space next to the element is dropped by whitespace trimming when the element is at a line start or the line wraps. Keep it tight against punctuation (`<Wordmark />.`, `<Wordmark />&rsquo;s`).

**Shape & motion**: cards `rounded-[20px]`, buttons are **pills** (`rounded-full`), inputs `rounded-xl`. Calm — `.of-enter` (fade-up on page mount), spring on press, ease on reveal. `.of-scroll` for slim scrollbars. Respect `prefers-reduced-motion`.

**Logo**: import `LogoMark` (the coral otter mark) / `OtterFace` (the otter face used as the AI icon) from `@/components/otterfund/logo`. Never re-draw the mark inline. The favicon (`app/icon.svg`) mirrors it.

**Forms** — one system, use it for every form. Build fields from `@/components/otterfund/form`: `<Field label error hint optional>` wraps a control and renders the inline error (clay) / hint beneath it; `<TextInput invalid>` and `<SelectInput invalid>` are the controls. They share the `of-field` / `of-field-select` Tailwind `@utility` classes in `globals.css` — change field styling in ONE place and it updates everywhere; never re-style inputs per-modal. Validation pattern: a pure `validate(values) → {field: message}` helper (see `account-form.tsx`), set errors on submit, and clear a field's error as the user edits it. For an entity edited in two places (e.g. accounts), extract a shared `<XForm>` so Add and Edit are identical — the modals own only submit/delete + API calls. Inline field errors beat one banner; copy says what to do ("Give the account a name.").

**Money**: format with `fmt()` from `@/lib/format` (or `Intl.NumberFormat('en-CA', {style:'currency', currency})`). Always `Math.round()` a savings rate / percentage before display. **Account balance = stored `account.balance` + sum of its transactions** — `getAccounts`/net-worth must add both (a stored balance alone, with no transactions, must still show).

### Conventions

- **Files kebab-case; component exports PascalCase.** Modals end in `-modal`, noun spelled out (`add-transaction-modal`).
- **Page = fetch + guard; component = render.** Server `page.tsx` does `auth()` guards + parallel data fetch, hands data to a client component as props. `dashboard/page.tsx` → `<OtterfundShell initialData={...}>`.
- **Server/client boundary is sacred.** Client components import only from `lib/types`, `lib/format`, `lib/utils`, `lib/constants`, `lib/graphql/client` (the browser-side GraphQL client — how client components mutate/fetch), `components/otterfund/*`, `components/ui/*`. Never import `lib/db/*`, `lib/ai/*`, or `lib/auth` into a client component.
- **Layered imports flow one way:** `ui ← otterfund (design system) ← feature components`. `ui/` stays generic; brand-specific reusables live in `components/otterfund/`.
- **Use the `@/` alias** for cross-folder imports; reserve `./` for same-folder siblings.
- **No duplicated constants/types.** Shared lists/enums → `lib/constants.ts`; shared types → `lib/types.ts`.
- **CRUD pattern**: mutations live in the `dashboard/modals/*` dialogs; `OtterfundShell` owns their open/close state and calls `router.refresh()` on success (re-runs the page RSC). Pages emit intent up via `onAdd`/`onEdit` callbacks — they don't host modal state themselves.
- **Page guards vs API auth:** page session guards use `requireUser()` in `lib/dashboard-context.ts`; API route handlers use `getApiUser()` in `lib/api-auth.ts`. Both resolve the user via Supabase `auth.getUser()`.
