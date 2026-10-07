# Dashboard UI revamp: release notes (staging)

Covers the Studio Admin-aligned redesign (`feat/dashboard-ui-revamp`) and the
backend additions it depends on (`abidii_backend`
`feat/dashboard-range-and-admin-languages`). Staging only; production is
unchanged.

## Backend API additions (backward compatible)

All endpoints are under `/api/v1`, gated by `get_manager_or_admin`.

### Range contract

`range=7d|30d|6m|1y|all` (anything else returns 422). Days are UTC and
inclusive, ending today.

| range | start | granularity | previous period |
|---|---|---|---|
| `7d` | today − 6 days | day | the 7 days before |
| `30d` | today − 29 days | day | the 30 days before |
| `6m` | same day 6 months ago (+1 day) | ISO week | the equal-length span before |
| `1y` | same day last year (+1 day, leap-safe) | month | the equal-length span before |
| `all` | none (lower bound resolved from data) | month | none (`previous: null`) |

Buckets carry `partial: true` when they are cut by the range edges.

### New endpoints

- `GET /admin/analytics/range/summary?range=` returns `new_users`,
  `active_users` and `new_subscribers`, each `{value, previous}`.
- `GET /admin/analytics/range/user-growth?range=`
- `GET /admin/analytics/range/subscriber-growth?range=`
- `GET /admin/analytics/range/active-users?range=`: `total` is distinct
  learners in the range, not the sum of buckets. Each bucket also splits new
  and returning learners.
- `GET /admin/languages?page_size=` lists all languages, including non-public
  ones (for example English). The public `/languages` is unchanged and still
  returns only `is_public` languages. No language was made public and no
  UUID is hardcoded.

### Extended endpoints (optional `range`, old calls unchanged)

- `/admin/analytics/recent-activity`
- `/admin/analytics/geo/active`
- `/admin/analytics/retention`: `range` sets the week count, and `all` starts
  from the first event.

## Dashboard: per-widget range behaviour

| Widget | Follows range? |
|---|---|
| New users, active learners, new subscribers (KPI and delta) | yes |
| Total users | no, labelled "All time" |
| Active today, lesson blueprints, dictionary words | no (snapshot) |
| User / subscriber growth charts | yes |
| Active learners chart | yes |
| Retention | yes |
| Recent activity | yes |
| Platform distribution, country map | no, labelled "current, all time" |
| Billing | no |

The selected range lives in the URL (`?range=`), so refreshing the page or
using back/forward keeps it.

## Other notable changes

- **Visual system:** Geist font, neutral light/dark tokens, Lucide icons,
  shadcn/Radix controls, Recharts charts, Studio Admin card, table and badge
  styles.
- **Hubs:** tabbed hubs with the tab in the URL, plus 307/308 compatibility
  redirects that keep query parameters.
- **Accessibility:** every overlay is a labelled modal dialog with a focus
  trap, Escape to close and focus restored afterwards. Escape inside an open
  dropdown closes only the dropdown. Custom dropdowns support the keyboard
  and announce required-field errors.
- **User drawer:** sectioned layout (Profile, Learning, Subscription, Device,
  game performance, activity) using fields the API already returns. The sheet
  floats via z-index and shadow, with no edge border.
- **Email templates:** themed editor. The preview follows the dashboard
  theme and has a Light/Dark switch; the saved and sent HTML is untouched.
- **Type checking:** `ignoreBuildErrors` was removed from `next.config.ts`,
  so the build type-checks.

## Verification evidence

Local, at the commit deployed to staging:

- `tsc --noEmit` exits 0.
- `next build --webpack` exits 0 and includes "Running TypeScript".
- ESLint: 0 errors, 27 warnings (all pre-existing).
- Jest: 36 suites, 279 tests passing.
- Backend unit tests: 43 passed (the analytics range and admin languages
  tests), run in the backend image.
- Browser, against a production build with fixture-mocked API calls (Chrome
  via Playwright): 25/25 interaction checks covering redirects, hub
  history/refresh/invalid tab, polling pause and resume, keyboard dropdown in
  a dialog, menu stacking, Escape handling and the user drawer. Screenshots
  in light and dark, desktop and 390 px.

Staging smoke results are recorded in the handover.

## Deployment (staging)

1. Backend `feat/dashboard-range-and-admin-languages` → `develop` → `staging`
   (`[skip ci]` merges, so no Actions ran), then on the staging host run
   `deploy-staging.sh --rolling --skip-dashboard`.
2. Dashboard `feat/dashboard-ui-revamp` → `develop` → `staging`, then
   `deploy-staging.sh --rolling`, which builds the dashboard from the
   dashboard repo's `staging` branch.

## Rollback (staging)

The deploy script's cleanup prunes old images, so roll back by redeploying
previous commits rather than re-tagging an image.

- **Dashboard only:** on `staging`, `git revert -m 1 <dashboard staging merge>`
  then push with `[skip ci]`, or reset to `f3dfed7` (the pre-release
  `staging` tip). Then run `deploy-staging.sh --rolling` on the host.
- **Backend:** `git revert -m 1 <backend staging merge>`, pushed with
  `[skip ci]`, then `deploy-staging.sh --rolling --skip-dashboard`. The
  pre-release backend `staging` tip was `2bd9bf86` (same tree as the
  previously deployed `df86672`).
- The backend changes are additive, so the old dashboard keeps working
  against the new backend. Roll back the dashboard first if both are needed.
- There are no database migrations, so there is nothing to roll back in the
  database.
