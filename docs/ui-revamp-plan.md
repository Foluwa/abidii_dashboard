# Abidii Dashboard — UI Revamp Plan (Pilot Phase)

> Approved for a **limited pilot** only. Full rollout is deferred until after
> pilot review.

## Target design

Studio Admin-inspired neutral surfaces + component styling, preserving Abidii
blue branding and information density.

| Surface | Current | Target |
|---|---|---|
| Surfaces | `bg-white`/`dark:bg-gray-900`, `rounded-lg` mix | semantic tokens `--background/--card/--muted/--border`, `rounded-xl`, `--shadow-sm` |
| Typography | Outfit | **Inter** + explicit Noto Sans fallback (verify Yoruba combining diacritics) |
| Brand | `brand-*` blue | retained as `--primary`/`--ring` |
| Icons | `react-icons/fi` + custom SVG | **Lucide** for common UI/nav; keep custom assets (logo, audio) |
| Sidebar | 90px/290px | collapsible rail+panel (~56px/~256px), same collapse/hover/mobile/permission logic |
| Header | 2-row | compact bar; **preserve** search, notifications, shortcuts (`⌘K`), env badge, account controls |
| Cards | inline divs | `Card` primitive |
| Tables | presentational | restyled header/rows/pagination/empty states |
| Dialogs | 4 impls | **keep implementations**, unify appearance |
| Charts | ApexCharts (hex, no dark) | **keep ApexCharts**, restyle + dark mode via `--chart-*` |

## Dependency changes

| Package | Purpose | Compatibility |
|---|---|---|
| `lucide-react` | Approved icon system for common UI/nav | React 19 compatible; peer-independent |

No other UI dependencies added in the pilot. Any further package (e.g. a Radix
primitive) requires a concrete pilot requirement, exact package + purpose + a
compatibility note, and approval — **no blanket Radix install**.

## Branch

- Base: `feat/dashboard-ui-revamp` from `origin/develop` @ `c62c926`.
- Old `codex/dashboard-ui-revamp` (= stale `5385538`) is not used.

## Pilot scope

**A. Theme foundations + shared shell**
- `src/app/globals.css`: add semantic tokens + radius/`--chart-*`/`--sidebar-*`
  alongside existing `brand-*`/`gray-*` (non-breaking).
- Restyle `AppSidebar` + `AppHeader` (preserve all header actions).
- Shared primitives used by pilots: `Button` (add explicit `type` prop without
  changing default behaviour at call sites), `Card`, `Badge`, `Table` primitives,
  `Input`/`TextArea`/`Checkbox`, `StyledSelect` (controlled contract preserved),
  `Pagination`, `Modal`/`ConfirmationModal`, `Dropdown`, `DataTable`, `StatCard`,
  `StatusBadge`, `PageBreadCrumb`, `StickyBulkActionBar`, `ActiveFilterChips`.
- Global consumers of changed primitives are enumerated and representative
  non-pilot pages spot-checked for regressions.

**B. `/content/words`** — filters (URL-synced), `WordsDataTable`, `WordDetailModal`,
selection + `StickyBulkActionBar` (bulk delete + bulk regen confirmations),
`DictionaryGoogleSheetsBulkImport`. Preserve: search/filter URL state, reset,
sorting, pagination, selection scope, bulk confirm, form payloads, import flow.

**C. `/analytics/detailed`** — restyle the 3 inline ApexCharts + dark mode.

Out of pilot scope (recorded as affected only by shared styling): `/dashboard`,
other analytics pages, remaining inventory.

## Phases

1. **Baseline** — branch + typecheck/lint/test/build captured (done; see audit).
2. **Theme foundations** — non-breaking token additions.
3. **Shared shell** — sidebar + header.
4. **Pilot components** — only those required by A/B/C.
5. **Pilot pages** — `/content/words`, `/analytics/detailed`.
6. **Verify** — full baseline checks + browser/mock verification + screenshots.
7. **STOP** — review before broadening.

## Verification (part of the pilot)

- Existing actions remain reachable; request method/URL/query/payload asserted
  with mocks (no production writes).
- Words: search/filter URL state, reset, sort, pagination, selection scope,
  bulk-action confirmation, form validation + payloads, import + audio flows.
- Charts: data, date/timezone formatting, interactions, dark mode.
- Loading/empty/error/success states; light/dark; desktop/mobile; keyboard access.
- Representative consumers of changed shared components.
- `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` before presenting.

## Review decisions still open (post-pilot)

1. Base branch confirmation (done: `origin/develop` @ `c62c926`).
2. Icon system: Lucide adopted for pilot (confirmed).
3. Font: Inter + Noto Sans fallback (pending Yoruba glyph verification).
4. Charts: ApexCharts restyle (confirmed).
5. Dialog consolidation: keep 4 implementations, unify appearance (confirmed).
6. Duplicate root route: out of scope, reported only (build confirmed non-blocking).

## Pilot status (completed — awaiting review)

- **Baseline**: branch `feat/dashboard-ui-revamp` @ `c62c926`; typecheck/lint/test/build captured (see audit). Duplicate root route confirmed **non-blocking** (single `/` in route table; `(admin)/page` shadowed).
- **Theme foundations**: done (tokens + Inter/Noto Sans).
- **Shared shell**: nav icons → Lucide; sidebar/header inherit the new font and neutral tokens (collapse/hover/mobile/permission behaviour unchanged; header search/notification blocks left commented-out as-is).
- **Pilot components**: `Modal`, `ContentStatsCard`, `ContentFiltersCard`, `ActiveFilterChips`, `WordsDataTable`, `PageBreadCrumb` restyled.
- **Pilot B `/content/words`**: surfaces standardized (filters/table/bulk/pagination). No behaviour change (URL sync, selection, bulk, import preserved).
- **Pilot C `/analytics/detailed`**: charts now theme-aware (dark mode) + Inter; card surfaces standardized.
- **Dependency**: `lucide-react@^0.544.0` only.

### Pending review decisions (unchanged)

Font (Inter + Noto Sans fallback) — final approval pending visual Yoruba glyph check. Dialog consolidation — 4 implementations kept, appearance unified via shared `Modal`. Everything else as previously approved.

## Content area — completion checklist (corrected)

**Individually redesigned (pilot):**
- `/content/words` — shared layout components + `WordsDataTable` + modals restyled.

**Inherit redesigned shared components** (use `ContentPageHeader`/`ContentStatsGrid`/`ContentFiltersCard`/`ActiveFilterChips`/`StickyBulkActionBar` + a domain table; colour/theme inherited, but the page-specific filter controls, forms and domain-table typography were NOT individually redesigned):
- `letters`, `numbers`, `learning-items`, `phrases`, `time-phrases`, `sentences`, `proverbs`.

**Inherit theme only (custom UI, NOT redesigned — colours normalised via tokens/sweep only):**
- `dictionary-import` (+ `[id]`), `languages`, `localizations`, `patterns`, `collections`, `quick-practice`, `audio-reconciliation`, `audit-log` (+ `orphan-assets`), `reports`, `content-safety`, `users/[id]/learning-state`.

Known visual gaps vs the reference (still open, not yet addressed):
- Table headers use uppercase + `bg-gray-50` background + `text-gray-500`; reference is normal-case `font-medium text-foreground` with no header background (`src/components/tables/{Words,Numbers,Proverbs}DataTable.tsx`, `admin/DataTable.tsx`).
- Table cell padding `px-6 py-4` vs reference `p-2` compact.
- Domain tables + modals use `react-icons/fi` (FiEdit/FiTrash2/FiVolume2), nav uses lucide — icon system split.
- Forms/dialogs use raw `<input>`/`<textarea>` rather than shared form primitives.
- `dictionary-import/[id]` uses a raw `<pre>` JSON dump + custom 2-col grid + raw `<table>` (`src/app/(admin)/(others-pages)/content/dictionary-import/[id]/page.tsx`).
- Radius mix: `ProverbsDataTable` uses `rounded-lg`, others `rounded-xl`.
