# Abidii Dashboard — UI Revamp Audit

> Presentation-layer migration of the existing Abidii admin dashboard toward a
> Studio Admin (shadcn/ui) inspired visual system. Functionality, data
> contracts, permissions, workflows and user actions must remain unchanged.

## Reference

- Design reference: `arhamkhnz/next-shadcn-admin-dashboard` ("Studio Admin")
- Inspected commit: `52bba6a4cf6b2ceb11203a156ba836a51d3bdc12` (MIT license)

## Baseline (verified)

| Item | Value |
|---|---|
| Repository | `abidii_dashboard` (own git repo, nested inside the larger `_` workspace repo) |
| Baseline branch | `feat/dashboard-ui-revamp` created from `origin/develop` |
| Starting commit | `c62c926` ("Merge PR #123") — contains content-safety page, DAU new-vs-returning, users filters |
| Stack | Next `16.0.10`, React `19.2.0`, Tailwind `4.1.17`, TypeScript `5.9.3` |
| Package manager | npm |

### Baseline checks

| Check | Command | Exit | Result |
|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | 0 | PASS |
| Lint | `npm run lint` | 0 | 0 errors, 26 warnings (hook deps + unused eslint-disable directives) |
| Tests | `npm test` | 1 | 33 suites: **29 pass / 4 fail**; 262 tests: **232 pass / 30 fail** |
| Build | `npm run build` | 0 | **PASS** — duplicate root route does NOT block the build (see below) |

### Failing tests (individual reconciliation, 30 total)

| Suite | # | Reason |
|---|---|---|
| `src/__tests__/users/page.test.tsx` | 25 | All fail with `TypeError: (0,_useApi.useUserAppVersions) is not a function`. The `jest.mock('@/hooks/useApi')` mock omits `useUserAppVersions` / `useUserProgressOptions`, which the page imports (added in the app-version filter feature). The hook exists at `useApi.ts:295`. Stale mock, not a runtime defect. |
| `src/__tests__/subscriptionsPage.test.tsx` | 1 | `Unable to find text "Subscription Management"` — heading removed/renamed in the tabbed-subscriptions redesign. Stale assertion. |
| `src/__tests__/curriculum/LessonBlueprintEditor.test.tsx` | 3 | `Unable to find label "Raw Payload JSON"`; missing media `display value`; `"Primary vocab target"` not found — editor refactored (compact reading fields, step carousel) after tests written. Stale assertions. |
| `src/__tests__/curriculum/coursesListPage.test.tsx` | 1 | `Expected: "c1"` on the delete action — stale mock/expectation vs current bulk/confirm flow. |

All 30 are **pre-existing, stale tests** (outdated mocks/labels from recent features), not UI-regression caused by any change here.

### Duplicate root route

`src/app/page.tsx` (login) and `src/app/(admin)/page.tsx` (dashboard) both resolve
to `/`. **Verified against the actual build**: the build exits 0 and the route
table lists `/` once. `(admin)/page` is not present as a route; it is only
referenced by a benign standalone-output warning
(`Failed to copy traced files for .../(admin)/page_client-reference-manifest.js`).
Conclusion: the non-grouped `src/app/page.tsx` (login) serves `/`, and
`(admin)/page.tsx` is shadowed. **This is an existing routing defect, out of UI
scope.** Not to be changed without separate approval.

## Current architecture

- **Providers** (`src/app/layout.tsx`): `QueryProvider` → `ThemeProvider` → `AuthProvider` → `ToastProvider` → `SidebarProvider`.
- **Shell** (`src/app/(admin)/layout.tsx`): `AppSidebar` (90px collapsed / 290px expanded, hover-expand, mobile drawer) + `AppHeader` + `Backdrop` + `ErrorBoundary`.
- **Navigation** (`src/config/adminNavigation.tsx`): permission-gated, 3-level `mainNavigationItems` + `personalNavigationItems`; icons via `src/icons/*.svg` (SVGR).
- **Theme** (`src/app/globals.css`): Tailwind v4 `@theme` tokens — `brand-*` (blue), `gray-*`, `success/error/warning`, `blue-light-*`, `--font-outfit`, `shadow-theme-*`, custom breakpoints; `.dark` class via `ThemeContext`; third-party overrides for ApexCharts, flatpickr, FullCalendar, Swiper, jVectorMap.
- **Data** (`src/hooks/useApi.ts`, ~2,000 lines): SWR-first (~80 hooks) + React Query only in `/enforcement` + manual `useState`+`apiClient` in CRUD pages. `apiClient` (axios) rewrites `/api/v1/admin/* → /api/admin/*`, adds `Idempotency-Key`, 401 refresh, cookie auth.
- **Auth** (`src/context/AuthContext.tsx`, `src/middleware.ts`): cookie session restore, 2FA challenge, `useRequireAuth` permission gate.

### Known, unrelated correctness defects (NOT in UI scope)

- `adminResetCourseProgress` / `adminSetLearningPointer` use raw `fetch()` and bypass the proxy rewrite + idempotency + refresh (`useApi.ts:1737`, `:1951`).
- `sonner` is imported in `audio/generate/page.tsx` but no `<Toaster/>` is mounted.
- `DropdownItem`/`Button` and several action buttons lack a `type` attribute (default `submit`).
- `WordsDataTable` has a dead "Filter" button (no handler).
- Several form primitives use hooks without a `"use client"` directive (`form/Select`, `form/MultiSelect`, `form/date-picker`, `common/ChartTab`).

## Route inventory (reconciled to 88 `page.tsx`)

`src/app` contains **88 `page.tsx`**, **5 `layout.tsx`**, **1 `route.ts`**, **1 `not-found.tsx`**. Route groups are URL-inert.

### API handlers (separate from UI routes)

- `src/app/api/admin/[[...path]]/route.ts` — Next same-origin admin proxy.
- `src/middleware.ts` — auth presence check.

### UI routes (compact)

**Auth / error / shell**
- `/` = `page.tsx` (login; canonical). `/` = `(admin)/page.tsx` (shadowed duplicate).
- `/signin`, `/signup` = `(full-width-pages)/(auth)/…`
- `/error-404` = `(full-width-pages)/(error-pages)/error-404`
- `/dashboard` = `(admin)/dashboard/page.tsx`

**Analytics (8)**
- `/analytics`, `/analytics/detailed`, `/analytics/learning`, `/analytics/learning/lessons/[sectionId]`, `/analytics/learning/users/[userId]`, `/analytics/players`, `/analytics/rooms`, `/analytics/curriculum-ops`

**Community / Billing (6)**
- `/users`, `/users/[id]`, `/users/admins`
- `/subscriptions`, `/subscriptions/events` (alias), `/subscriptions/attempts` (alias)

**Content (21)**
- `/content/library` (hub), `/content/words`, `/content/phrases`, `/content/sentences`, `/content/proverbs`, `/content/letters`, `/content/numbers`, `/content/time-phrases`, `/content/learning-items`, `/content/languages`, `/content/localizations`, `/content/patterns`, `/content/collections`, `/content/dictionary-import`, `/content/dictionary-import/[id]`, `/content/quick-practice`, `/content/audio-reconciliation`, `/content/audit-log`, `/content/audit-log/orphan-assets`, `/content/reports`, `/content/content-safety`, `/content/users/[id]/learning-state`

**Curriculum (10)**
- `/curriculum/courses`, `/curriculum/courses-hub` (hub), `/curriculum/courses/[id]`, `/curriculum/editor`, `/curriculum/lesson-blueprints`, `/curriculum/lesson-blueprints/[id]`, `/curriculum/lesson-blueprints/new`, `/curriculum/lesson-import`, `/curriculum/assets`, `/curriculum/publishing`

**Media (3)**
- `/audio/voices`, `/audio/jobs`, `/audio/generate`

**Notifications (3)**
- `/notifications`, `/notifications/history`, `/notifications/daily`

**System (11)**
- `/system/status`, `/system/metrics`, `/system/alerts`, `/system/alerts-hub` (hub), `/system/idempotency`, `/system/cron`, `/system/config`, `/system/configuration` (hub), `/system/email-templates`, `/system/security-exceptions`, `/system/testing`

**Jobs / ML (11)**
- `/admin/jobs`
- `/operations/ml-training`, `/operations/ml-training/jobs`, `/operations/ml-training/jobs/[id]`, `/operations/ml-training/manifests`, `/operations/ml-training/manifests/[id]`, `/operations/ml-training/candidate-manifests`, `/operations/ml-training/candidate-manifests/[id]`, `/operations/ml-training/models`, `/operations/ml-training/vision-jobs`, `/operations/ml-training/vision-jobs/[id]`

**Account / Settings (7)**
- `/profile`, `/settings` (hub), `/settings/app-config`, `/settings/change-password`, `/settings/force-update`, `/settings/language-settings`
- `/overview` (redirect → `/dashboard`, defined in `next.config.ts`)

**Enforcement (1)**
- `/enforcement` = `(admin)/enforcement/page.tsx`

## Chart usage (recounted: 15 source files, 18 rendered instances)

Named chart components (13):
1. `src/components/analytics/UserRetentionCard.tsx`
2. `src/components/charts/PlatformDistributionChart.tsx` (donut)
3. `src/components/charts/SubscriptionDistributionChart.tsx` (donut)
4. `src/components/charts/DailyActiveUsersChart.tsx` (area)
5. `src/components/charts/MonthlySubscriberGrowthChart.tsx` (bar)
6. `src/components/charts/RoomsTimeSeriesChart.tsx` (bar, presentational)
7. `src/components/charts/SystemPerformanceChart.tsx` (line)
8. `src/components/charts/UserActivityGaugeChart.tsx` (radialBar)
9. `src/components/ecommerce/MonthlySalesChart.tsx` (bar)
10. `src/components/charts/line/LineChartOne.tsx` (area)
11. `src/components/charts/bar/BarChartOne.tsx` (demo)
12. `src/components/ecommerce/StatisticsChart.tsx` (commented import)
13. `src/components/ecommerce/MonthlyTarget.tsx` (commented import)

Inline ApexCharts in pages (2 files → 5 instances):
14. `src/app/(admin)/(others-pages)/analytics/detailed/page.tsx` (3 option blocks: fluency pie, activity-by-hour, most-active)
15. `src/app/(admin)/(others-pages)/notifications/daily/page.tsx` (2 option blocks: open-rate breakdown)

All use `react-apexcharts` (dynamic `ssr:false`), hardcoded hex colors, no dark mode.

## Cross-cutting component findings

- **Buttons**: `ui/button/Button` lacks `type` (defaults to `submit`). `DropdownItem`, `ThemeToggleButton`, `ThemeTogglerTwo`, `StickyBulkActionBar` action buttons also lack `type`.
- **Selects**: `ui/form/StyledSelect` is **controlled** (`value: string|number`, `onValueChange(string)`); `form/Select` uncontrolled (`string`); empty = placeholder `<option value="" disabled>`.
- **Tabs**: no shared primitive; hub pages remount child pages; `/users` role tabs set filter state.
- **Dialogs (4 implementations)**: `ui/modal/Modal` (Escape + scroll-lock, no focus trap); `admin/Modal` (Escape + `closeOnOutsideClick`); `modals/ConfirmationModal` (hand-rolled, no Escape); `words/WordDetailModal` (hand-rolled). All preserve distinct behaviour; only appearance is unified.
- **Dropdowns**: `ui/dropdown/Dropdown` (controlled `isOpen`/`onClose`, outside-click) + `DropdownItem`.
- **Toast**: `ToastContext` (custom, active); `SimpleAlert` fires it as side effect; `ui/toast/Toast` is legacy/unused.

## Functional preservation checklist

Unchanged: routes/deep links/query params and `next.config.ts` redirects; cookie auth + 2FA + logout; API endpoints/methods/payloads, `Idempotency-Key`, proxy rewrite, 401 refresh; SWR config + polling + debounce; filters (server-side `page`/`limit`/`offset`), defaults, reset, URL sync; selection + bulk scope; form defaults/validation/payloads; upload/import/export; audio playback/regenerate/poll/accept-reject; curriculum validate/publish (default-deny 409)/QA/diff-restore; editor autosave + shortcuts; confirm dialogs + loading states; toasts; chart metrics/units/date boundaries/timezone/aggregation/tooltips; all displayed content + Yoruba diacritics.

## Pilot implementation results (Phase A–C)

Applied on `feat/dashboard-ui-revamp` @ `c62c926`. No business logic, API,
auth, or data-flow changes. Presentation only.

### Changed files

- `package.json` / `package-lock.json` — added `lucide-react@^0.544.0`.
- `src/app/globals.css` — Inter/Noto Sans font stack (replaces Outfit value on
  the existing `--font-outfit` token); added radius tokens, `--color-ring`,
  `--color-chart-1..5`, `--color-sidebar-*`.
- `src/app/layout.tsx` — Google Fonts `<link>` (Inter + Noto Sans).
- `src/config/adminNavigation.tsx` — nav icons swapped from `@/icons` SVGs to
  Lucide (`LayoutDashboard`, `PieChart`, `Users`, `Layers`, `GraduationCap`,
  `AudioLines`, `Bell`, `Server`, `Settings`).
- `src/components/charts/chartTheme.ts` (new) — shared ApexCharts light/dark
  theming helper (font, text/heading/grid colors, series palette).
- `src/app/(admin)/(others-pages)/analytics/detailed/page.tsx` — charts read the
  theme (dark mode) + Inter; card surfaces standardized to solid neutral.
- `src/app/(admin)/(others-pages)/content/words/page.tsx` — pagination wrapper
  surface standardized.
- Shared components (used by the pilots and other content pages): `Modal`
  (rounded-xl + border), `ContentStatsCard`, `ContentFiltersCard`,
  `ActiveFilterChips`, `WordsDataTable`, `PageBreadCrumb` — translucent dark
  surfaces (`dark:bg-white/[0.03]`) normalized to solid `dark:bg-gray-900`.

### Affected non-pilot consumers (shared-component ripple)

`ContentStatsCard`, `ContentFiltersCard`, `ActiveFilterChips`, `WordsDataTable`,
`Modal`, `PageBreadCrumb` are shared. Their restyle is visible on all content
CRUD pages (phrases/sentences/proverbs/letters/numbers/time-phrases) and any
page using the shared `Modal` or `PageBreadCrumb`. This is the intended,
uniform "neutral surfaces" effect; no per-page logic changed.

### Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **exit code 2** — one error, and it is a real **source-level defect**, not a generated-cache artifact: `subscriptions/page.tsx` exports a named `SubscriptionsPageContent` (line 66) alongside the `default` page (line 1279). Next.js pages must only have a default export, so the generated `.next/types/.../subscriptions/page.ts` fails `TS2344`. `.next/types` merely re-surfaces the invalid source export; deleting `.next` does not fix it. `next.config.ts` masks it via `typescript.ignoreBuildErrors: true`. See "Known issues (out of scope)". |
| `npm run lint` | 0 errors, 27 warnings (baseline 26 + 1 new `@next/next/no-page-custom-font` for the font `<link>` in `src/app/layout.tsx` — an App Router false positive; fonts in the root layout `<head>` load app-wide). |
| `npm test` | 29/33 suites pass, 232/262 tests — **identical to baseline** (4 pre-existing stale suites: `users/page`, `subscriptionsPage`, `LessonBlueprintEditor`, `coursesListPage`). No regression. |
| `npm run build` | exit 0. Same pre-existing standalone-copy warning for the shadowed `(admin)/page`. |
| `npm run dev` smoke | `/` and `/signin` → 200 (font `<link>` present); `/dashboard` → 307 → `/signin` (middleware auth redirect intact). No compile errors. |

### Unverified / limitations

- **No browser screenshots or visual/interaction checks** were possible in this
  environment (no browser-automation tool available). Visual + keyboard/focus +
  chart dark-mode verification is deferred to the review checkpoint with a real
  browser and a local/test backend.
- Yoruba glyph rendering (ẹ ọ ṣ ṅ ń + combining tone marks) is guaranteed by the
  explicit Noto Sans fallback but has not been visually confirmed.
- Mutation payloads (bulk delete / bulk regenerate) were not exercised against a
  live/mock backend; their code paths are untouched.

### Documents note

`docs/` is covered by a pre-existing `.gitignore` rule (`docs/*`), so these
deliverables exist on disk for review but are not tracked by git.

## Known issues (out of scope — separate fixes, not UI cleanup)

### 1. Invalid named export in a page file (the `tsc` exit-2 cause)

`src/app/(admin)/(others-pages)/subscriptions/page.tsx` exports a **named**
`SubscriptionsPageContent` (line 66) in addition to its `default`
`SubscriptionsPage` (line 1279). Next.js App Router pages may only have a
default export; the extra named export makes the page type incompatible with
the framework's generated page type (`TS2344`), which is what `npx tsc`
reports. It is a source defect, surfaced (not caused) by `.next/types`.

**Smallest fix (separate PR, not done here):** move `SubscriptionsPageContent`
(and its `SubscriptionsView` type) into a non-page module, e.g.
`src/app/(admin)/(others-pages)/subscriptions/subscriptions-content.tsx`, then
- `page.tsx` → `import { SubscriptionsPageContent } from "./subscriptions-content"` and `export default function SubscriptionsPage() { return <SubscriptionsPageContent initialView="subscriptions" />; }`
- `events/page.tsx` and `attempts/page.tsx` → import from `./subscriptions-content` instead of `../page`.

This preserves all three routes, the shared tabbed content, and all imports,
and removes the named export from the page file (so `tsc` passes without
`ignoreBuildErrors`). Also enables removing `typescript.ignoreBuildErrors` from
`next.config.ts` once no other route-type errors remain.
