# Navigation Consolidation — Audit & Proposal

Scope: sidebar sections **Curriculum, Media, Notifications, System**.
Status: **audit + proposal only** — no code changed. Awaiting approval.

Reference: `src/config/adminNavigation.tsx`, route files under `src/app/(admin)/(others-pages)/…`,
existing hubs (`courses-hub`, `alerts-hub`, `configuration`, `content/library`),
`next.config.ts` redirects, and the shared `useState`-tab hub pattern.

---

## 1. Current structure (verified)

### Permissions model (applies everywhere)
- `src/app/(admin)/layout.tsx:16` enforces **authentication only** (`useRequireAuth()` without a permission arg). Unauthenticated → `/signin`.
- `AppSidebar.tsx:38-49` hides nav items via `checkPermission(permission)` (sidebar-only gate).
- In-component role checks exist on only 3 pages: `content-safety` (`isAdmin`), and the `configuration` hub's `app-config` + `force-update` tabs (`isAdmin`).
- Referenced permissions: `content:read`, `audio:read`, `users:read`, `system:read`.

### Curriculum (5 sidebar entries; 10 routes)
| Sidebar label | URL | Source | Notes |
|---|---|---|---|
| Courses | `/curriculum/courses-hub` | `courses-hub/page.tsx` | **hub** — tabs "All Courses" (`courses/page.tsx`) + "Publishing Readiness" (`publishing/page.tsx`); `activePaths` cover `/curriculum/courses`, `/curriculum/publishing` |
| Curriculum Editor | `/curriculum/editor` | `editor/page.tsx` (1439 ln) | drag-drop unit/section reorder; `?courseKey=` deep link |
| Lesson Blueprints | `/curriculum/lesson-blueprints` | `lesson-blueprints/page.tsx` | list + bulk validate/publish/unpublish |
| Lesson Import | `/curriculum/lesson-import` | `lesson-import/page.tsx` | Google Sheets bulk import (`contentType="lessons"`) |
| Blueprint Assets | `/curriculum/assets` | `assets/page.tsx` | media binding library (rename/delete/clean stale) |

Hidden detail routes: `/curriculum/courses/[id]`, `/curriculum/lesson-blueprints/[id]`, `/curriculum/lesson-blueprints/new`.

### Media (3 sidebar entries; 3 routes)
| Sidebar label | URL | Source | Notes |
|---|---|---|---|
| Voices | `/audio/voices` | `audio/voices/page.tsx` | TTS voice CRUD + sample playback |
| Audio Jobs | `/audio/jobs` | `audio/jobs/page.tsx` | job monitor; retry/cancel; 10s poll; dashboard quick-action links here |
| Audio Generate | `/audio/generate` | `audio/generate/page.tsx` | preview + save TTS for a word |

All three carry `audio:read`.

### Notifications (3 sidebar entries; 3 routes)
| Sidebar label | URL | Source | Notes |
|---|---|---|---|
| Compose | `/notifications` | `notifications/page.tsx` | compose + send push (broadcast/selected/filtered) |
| History | `/notifications/history` | `history/page.tsx` | sent list + failure-reason modal |
| Daily Content | `/notifications/daily` | `daily/page.tsx` (925 ln) | daily-word/teaser-quiz analytics + schedule + override; has its **own nested 2-tab** switch |

Section permission: `users:read`.

### System (4 groups / 16 sidebar entries; ~20 routes)
| Group | Sidebar label | URL | Source | Notes |
|---|---|---|---|---|
| Infrastructure | Status | `/system/status` | `status/page.tsx` | health; "auto-refresh 60s" text but **no polling** |
| | Metrics | `/system/metrics` | `metrics/page.tsx` | CPU/mem/disk; 30s poll |
| | Alerts | `/system/alerts-hub` | `alerts-hub/page.tsx` | **hub** — "Alert History" (`alerts/page.tsx`) + "Send Test Alert" (`testing/page.tsx`) |
| | Idempotency | `/system/idempotency` | `idempotency/page.tsx` | middleware metrics, read-only |
| | Enforcement | `/enforcement` | `(admin)/enforcement/page.tsx` | read-only observability; 30-60s poll |
| | Security Exceptions | `/system/security-exceptions` | `security-exceptions/page.tsx` | add/remove device exemptions |
| Jobs | Cron Jobs | `/system/cron` | `cron/page.tsx` | scheduled jobs + runs; 60s poll |
| | Admin Jobs | `/admin/jobs` | `admin/jobs/page.tsx` | persistent jobs + orphaned-audio cleanup; 3s poll while active |
| | ML Training | `/operations/ml-training` | `ml-training/page.tsx` → `MLTrainingViews.tsx` | overview (readiness/train/models) |
| | Candidate Review | `/operations/ml-training/candidate-manifests` | thin re-export → `MLHandwritingCandidateReviewViews.tsx` | DB-backed handwriting candidate review |
| Platform | Configuration | `/system/configuration` | `configuration/page.tsx` | **hub** — Feature Flags + App Settings + Language + Force Update |
| | Email Templates | `/system/email-templates` | `email-templates/page.tsx` | HTML template edit + preview |
| Content Ops | Audit Log | `/content/audit-log` | `audit-log/page.tsx` | admin audit trail |
| | Orphan Assets | `/content/audit-log/orphan-assets` | `orphan-assets/page.tsx` | scan/review/delete; dashboard quick-action links here |
| | Content Reports | `/content/reports` | `reports/page.tsx` | dictionary reports |
| | Content Safety | `/content/content-safety` | `content-safety/page.tsx` | flagged words; **`isAdmin` gate** |

Hidden detail routes (ML): `/operations/ml-training/jobs`, `/jobs/[id]`, `/manifests`, `/manifests/[id]`, `/candidate-manifests/[id]`, `/models`, `/vision-jobs`, `/vision-jobs/[id]` — all thin re-exports of `components/admin/ml-training/*` views, linked via in-page `<Link>`, not in the sidebar.

### Hub pattern (shared by all 4 existing hubs)
`useState(activeTab)` + conditional `{activeTab === X && <Page/>}`. **No URL sync** (tab not in query string), **no `key` remount guard** → switching tabs unmounts the inactive page and resets its filter/pagination state.

---

## 2. Consolidation opportunities (grouping rationale)

- **Media**: three pages are one audio domain (voices, generate, jobs) → single "Audio" hub.
- **Notifications**: three pages are one push domain (compose, history, daily) → single "Notifications" hub.
- **Curriculum**: `courses-hub` already consolidates Courses + Publishing. Remaining supporting tools (Lesson Import, Blueprint Assets) are blueprint-adjacent → fold into Blueprints.
- **System — Infrastructure**: Status/Metrics/Idempotency are read-only "health" monitoring → one "Health" hub. Enforcement/Security Exceptions are device-security → one "Security" hub. Alerts already a hub.
- **System — Jobs**: Cron + Admin Jobs are operational queues → one "Jobs" hub. "Candidate Review" is already reachable from the ML Training overview → remove the duplicate sidebar entry.
- **System — Platform**: Email Templates is platform config → fold into the existing Configuration hub (5th tab).
- **System — Content Ops**: these four pages are **content**-scoped (`content:read`), currently parked under System → consolidate into one "Content Ops" hub and (recommended) move it under the **Content** section, which already uses `content:read`.

Distinction (per request):
- **A. Reduce sidebar entries** — Media, Notifications, System groups, Curriculum sub-items.
- **B. Combine top-level page experiences** — new/expanded tabs in hubs.
- **C. Remove redundant implementations** — none are true duplicates; only the "Candidate Review" sidebar entry is a redundant *pointer* (same page is linked from ML overview).

---

## 3. Recommended structure (preferred)

### Sidebar tree — current vs proposed

**Media**
```
Current:                          Proposed:
Media (audio:read)                Media (audio:read)
├─ Voices                         └─ Audio  → /audio   (tabs: Voices | Generate | Jobs)
├─ Audio Jobs
└─ Audio Generate
```

**Notifications**
```
Current:                          Proposed:
Notifications (users:read)        Notifications (users:read)
├─ Compose                        └─ Notifications → /notifications  (tabs: Compose | History | Daily)
├─ History
└─ Daily Content
```

**Curriculum**
```
Current:                          Proposed:
Curriculum (content:read)         Curriculum (content:read)
├─ Courses (hub)                  ├─ Courses → /curriculum/courses-hub  (tabs: All Courses | Publishing Readiness)
├─ Curriculum Editor              ├─ Lesson Blueprints → /curriculum/lesson-blueprints  (tabs: Blueprints | Import | Assets)
├─ Lesson Blueprints              └─ Curriculum Editor → /curriculum/editor  (standalone)
├─ Lesson Import
└─ Blueprint Assets
```

**System** (+ Content Ops move)
```
Current:                          Proposed:
System                            System
├─ Infrastructure (6)             ├─ Monitoring
│  ├─ Status                      │  ├─ Health → /system/health   (tabs: Status | Metrics | Idempotency)
│  ├─ Metrics                     │  ├─ Alerts → /system/alerts-hub  (unchanged hub)
│  ├─ Alerts (hub)                │  └─ Security → /system/security  (tabs: Enforcement | Security Exceptions)
│  ├─ Idempotency                 ├─ Jobs
│  ├─ Enforcement                 │  ├─ Jobs → /system/jobs  (tabs: Cron Jobs | Admin Jobs)
│  └─ Security Exceptions         │  └─ ML Training → /operations/ml-training  (overview; drop "Candidate Review")
│                                 └─ Platform
├─ Jobs (4)                       │    └─ Configuration → /system/configuration  (5 tabs: Feature Flags | App Settings | Language | Force Update | Email Templates)
│  ├─ Cron Jobs                   └─ (Content Ops moves to Content section)
│  ├─ Admin Jobs                  
│  ├─ ML Training                 Content (content:read)
│  └─ Candidate Review            └─ Content Ops → /content/ops  (tabs: Audit Log | Orphan Assets | Content Reports | Content Safety)
├─ Platform (2)
│  ├─ Configuration (hub)
│  └─ Email Templates
└─ Content Ops (4)
   ├─ Audit Log
   ├─ Orphan Assets
   ├─ Content Reports
   └─ Content Safety
```

### Destination counts

| Section | Current sidebar entries | Proposed sidebar entries |
|---|---|---|
| Curriculum | 5 | 3 |
| Media | 3 | 1 |
| Notifications | 3 | 1 |
| System | 16 | 6 (Monitoring 3 + Jobs 2 + Platform 1) |
| Content (affected) | 8 | 9 (+1 "Content Ops" hub) |

Top-level *pages* do not change materially: hubs reuse the existing page components as tabs (no logic removal). The only removed pointer is "Candidate Review" (still reachable from ML overview).

---

## 4. Old page → new destination mapping

| Old URL | New destination | Mechanism |
|---|---|---|
| `/audio/voices` | `/audio?tab=voices` | tab; keep route + add `?tab` redirect |
| `/audio/generate` | `/audio?tab=generate` | tab; keep route + redirect |
| `/audio/jobs` | `/audio?tab=jobs` | tab; keep route + redirect (dashboard quick action updates to `/audio?tab=jobs`) |
| `/notifications/history` | `/notifications?tab=history` | tab; keep route + redirect |
| `/notifications/daily` | `/notifications?tab=daily` | tab; keep route + redirect |
| `/curriculum/lesson-import` | `/curriculum/lesson-blueprints?tab=import` | tab; keep route + redirect |
| `/curriculum/assets` | `/curriculum/lesson-blueprints?tab=assets` | tab; keep route + redirect |
| `/system/status`, `/system/metrics`, `/system/idempotency` | `/system/health?tab=…` | tabs; keep routes + redirect |
| `/enforcement`, `/system/security-exceptions` | `/system/security?tab=…` | tabs; keep routes + redirect |
| `/system/cron`, `/admin/jobs` | `/system/jobs?tab=…` | tabs; keep routes + redirect |
| `/system/email-templates` | `/system/configuration?tab=email` | tab; keep route + redirect |
| `/operations/ml-training/candidate-manifests` | `/operations/ml-training` (overview link) | remove sidebar entry only; route unchanged |
| `/content/audit-log`, `/content/audit-log/orphan-assets`, `/content/reports`, `/content/content-safety` | `/content/ops?tab=…` | tabs; keep routes + redirect |

**Routes that remain standalone** (deep-linked, distinct workflow, not worth tab-ifying):
- `/curriculum/editor` — heavy drag-drop tool, entered with `?courseKey=`; keep standalone.
- `/curriculum/courses/[id]`, `/curriculum/lesson-blueprints/[id]`, `/curriculum/lesson-blueprints/new` — detail/create routes (never sidebar).
- `/operations/ml-training` and all its `[id]`/sub-routes — self-contained ML area; keep separate routes, only drop the sidebar pointer.

---

## 5. Compatibility strategy

**URL contract (firm):** every hub uses **URL-addressable tabs** via `?tab=<key>`.
- The URL is the source of truth; tab changes push history entries; back/forward and refresh restore the tab; missing `?tab` selects the documented default; unknown values fall back via `router.replace` (no loops); restricted values render an access-denied state without mounting content or starting requests.
- Tab-specific filters use their own query params and must not collide with the hub `tab` param. Nested tabs use a distinct param (e.g. `dailyTab` for `/notifications/daily`).

**Exact tab keys** (documented defaults):

| Hub | URL | Tab keys | Default |
|---|---|---|---|
| Courses | `/curriculum/courses-hub` | `all`, `readiness` | `all` |
| Audio | `/audio` | `voices`, `generate`, `jobs` | `voices` |
| Notifications | `/notifications` | `compose`, `history`, `daily` | `compose` |
| Lesson Blueprints | `/curriculum/lesson-blueprints` | `blueprints`, `import`, `assets` | `blueprints` |
| System Health | `/system/health` | `status`, `metrics`, `idempotency` | `status` |
| System Security | `/system/security` | `enforcement`, `exceptions` | `enforcement` |
| System Jobs | `/system/jobs` | `cron`, `admin` | `cron` |
| Configuration | `/system/configuration` | `flags`, `app`, `language`, `force-update`, `email` | `flags` |
| Content Ops | `/content/ops` | `audit`, `orphans`, `reports`, `safety` | `audit` |

**Legacy URL compatibility (temporary):**
- Keep the standalone routes as compatibility entry points; add **temporary (307) redirects** in `next.config.ts` mapping each legacy route → its hub `?tab=…` (preserving other query params). Only convert to permanent (308) redirects after the new navigation is accepted.
- Preserve detail/create routes (`[id]`, `new`) and incoming links (dashboard quick actions, course/blueprint deep links) — they continue to resolve.

**Tab state (no silent data loss):**
- Keep tabs **mounted after first visit** (render-all/hidden) so in-session drafts, selections, previews and pagination survive switching. Do not silently unmount and reset.
- Preserve existing URL-backed filters/pagination unchanged.
- Do not persist sensitive draft content to `localStorage` without a specific reason.
- Pages with polling (`metrics`, `cron`, `audio/jobs`, `admin/jobs`, `enforcement`) must **stop their interval while the tab is inactive** and avoid duplicate intervals; ongoing-operation tracking (job progress, bulk runs) must survive tab switches.
- Forms/drafts exist in: notification **Compose** (title/body/target selection), **Audio Generate** (word/voice/preview), **Daily Content** (schedule + daily-word override), and the Configuration tabs (app-config / force-update) — all must retain state across tab switches (keep-mount). Modal/detail forms are unaffected.

**Permissions:**
- Each hub renders only the tabs the user may access; a direct restricted `?tab=` URL must **not** mount or fetch restricted content (render access-denied). Wait for auth resolution (the admin layout already gates on `useRequireAuth`).
- Audio (`audio:read`), Notifications (`users:read`), Blueprints/Health/Security/Jobs (`content:read`/`system:read`) are uniform per hub. **Content Ops is mixed** — Content Safety requires `isAdmin`; hide the tab and block the direct URL for non-admins. Do not relax existing gates; backend enforcement is unchanged.

---

## 6. Component reuse & likely files affected

Reuse the existing hub pattern, upgraded to URL-addressable tabs. Likely touched:
- `src/config/adminNavigation.tsx` — new/renamed entries + `activePaths`.
- New hub pages: `src/app/(admin)/(others-pages)/audio/page.tsx`, `notifications/page.tsx` (becomes hub), `curriculum/lesson-blueprints` (becomes hub), `system/health`, `system/security`, `system/jobs`, `content/ops`.
- A small shared `<Tabs>`/`<UrlTabs>` component (new) to replace the 4 hand-rolled `useState` tab blocks (`courses-hub`, `alerts-hub`, `configuration`, `content/library`) — optional but removes duplication.
- `next.config.ts` — add permanent redirects (old route → `hub?tab=…`).
- Dashboard quick actions (`dashboard/page.tsx`) — update `/audio/jobs` and `/content/audit-log/orphan-assets` links to the new tab URLs (or leave; redirects cover them).

---

## 7. Risks & verification

Risks:
- **Regression risk** is concentrated in the hub tab wiring + redirects, not in business logic (pages are reused verbatim as tab children).
- Mixed-permission Content Ops hub (see §5) — must gate the Content Safety tab.
- ML "Candidate Review" removal is a pointer removal only; verify the ML overview still links to it.
- Tab-mount vs remount changes polling cadence: pages with `setInterval` (metrics, cron, audio jobs, admin jobs, enforcement) will keep polling if kept mounted — verify no duplicate intervals after tab switches (cleanup on unmount).

Verification:
- Route smoke test: every old URL resolves (200) or redirects to the correct tab.
- Tab deep-link: `/audio?tab=jobs` opens the Jobs tab; back/forward + refresh restore it.
- Permission matrix: `audio:read`/`users:read`/`system:read`/`content:read`/`isAdmin` still hide/show the right entries and tabs.
- Workflow checks: bulk publish (courses/blueprints), TTS generate/save, notification send, cron/admin-job polling, orphan-asset cleanup, content-safety `isAdmin` gate.
- `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.

---

## 8. Phased implementation order

1. **Foundations**: add `UrlTabs` component + upgrade one existing hub (`courses-hub`) to URL tabs (proves the pattern, keeps everything else intact).
2. **Media + Notifications** hubs (lowest risk, uniform permissions).
3. **Curriculum** — Blueprints hub (Import + Assets as tabs).
4. **System** — Health / Security / Jobs hubs; fold Email Templates into Configuration; drop "Candidate Review" sidebar pointer.
5. **Content Ops** hub + move to Content section (mixed permission — do last, carefully).
6. **Redirects + dashboard quick-action updates**, then full verification.

---

## 9. Decisions requiring approval

**URL-addressable tabs (`?tab=…`) is a firm requirement — not a decision.** The remaining decisions:

1. **Keep standalone routes + temporary (307) redirects** (recommended) vs fully replacing routes with hubs.
2. **Move Content Ops under Content** (recommended) vs keep under System (either way it becomes a hub).
3. **Fold Email Templates into Configuration** as a 5th tab (recommended) vs keep separate.
4. **Curriculum**: Blueprints hub with Import + Assets tabs (recommended) vs keep Import/Assets as separate sidebar entries.
5. **Candidate Review**: remove the duplicate sidebar pointer (recommended; only after confirming the ML overview link remains visible/usable for the same authorised users).

### Checkpoint status
- **Phase 1 implemented**: shared `UrlTabs` (`src/components/ui/url-tabs.tsx`) + Courses hub migrated (`/curriculum/courses-hub`, tabs `all`/`readiness`). Content extracted to `src/components/curriculum/{CoursesListContent,PublishingReadinessContent}.tsx`; legacy routes `/curriculum/courses` and `/curriculum/publishing` remain as thin compatibility wrappers. Verified (see report): default/`?tab=`/unknown-fallback/back-forward/refresh + standalone routes.
- **Phase 2 implemented** (URL-tab hubs, content extraction, keep-mounted + `isActive` pause-polling):
  - `UrlTabs` upgraded: keep-mounted (hidden) panels, `isActive` passed to `renderTab`, `allowed:false` never mounts, retained content dropped on revocation, unknown-tab `replace`.
  - Health hub `/system/health` (`status`|`metrics`|`idempotency`); metrics 30s + services 60s polls paused on `isActive`.
  - Audio hub `/audio` (`voices`|`generate`|`jobs`); jobs 10s poll paused.
  - Notifications hub `/notifications` (`compose`|`history`|`daily`).
  - Lesson Blueprints hub `/curriculum/lesson-blueprints` (`blueprints`|`import`|`assets`).
  - Security hub `/system/security` (`enforcement`|`exceptions`); enforcement poll paused.
  - Jobs hub `/system/jobs` (`cron`|`admin`); cron 60s + admin-jobs 3s polls paused.
  - Alerts hub `/system/alerts-hub` made URL-addressable (`history`|`testing`).
  - Configuration hub `/system/configuration` made URL-addressable + Email Templates 5th tab (`platform`|`application`|`language`|`force-update`|`email`).
  - Content Ops hub `/content/ops` (`audit`|`orphans`|`reports`|`safety` — safety `allowed: isAdmin`) moved under Content.
  - ML Training: added "Candidate Review" link on overview; removed duplicate sidebar pointer; fixed broken models link → `/operations/ml-training/models`.
  - Temporary 307 redirects added for every folded legacy route (query params preserved); legacy aliases repointed to avoid double hops.
- **Phase 3 (this pass) — custom select migration**: `StyledSelect` reimplemented on Radix Select (opaque theme-aware trigger/menu, Lucide chevron, checkmarks, empty-value sentinel, `data-*`/`aria-*` passthrough); new searchable `Combobox` (Radix Popover); `form/Select` + `PhoneInput` migrated; all remaining native `<select>` in content/curriculum pages migrated. Native `<select>` removed repo-wide.
- **Phase 3 (this pass) — type export fix**: `SubscriptionsPageContent` moved to `src/components/subscriptions/SubscriptionsPageContent.tsx`; `subscriptions/{page,events,attempts}` now thin wrappers (resolves the Next 16 route-export type error).

### Verification (deferred this pass)
- tsc / lint / jest / build NOT run (per working rules). Full verification backlog at bottom of this file.
- No browser verification done this pass.

### Uncertain / flagged (resolved or still open)
- ~~`/system/status` and `/system/alerts` claim "auto-refresh 60s" in copy but have **no** polling code~~ — corrected: `status` page's **services** list (`useServicesStatus`) DID poll 60s pre-existing; only `useSystemStatus` has no poll. Polling baseline preserved (pause option added, default unchanged).
- ~~ML overview "View all" models link → `/system/ml-training/models`~~ — fixed to `/operations/ml-training/models`; overview now also links to Candidate Review.

---

# System submenu consolidation — focused proposal (audit only, no implementation)

Scope: the three System groups **Infrastructure**, **Jobs**, **Content Ops** (Platform is
covered separately in §3 above). URL-addressable tabs (`?tab=…`) are required and reuse the
new `UrlTabs` foundation where suitable.

## Verified findings (corrections to §1)

- **`UrlTabs` gaps** (`src/components/ui/url-tabs.tsx`): it does URL-as-source-of-truth,
  history entries, unknown-tab `replace`, query-param preservation and an `allowed:false`
  access-denied branch — but it **unmounts inactive tabs** (renders only `renderTab(activeKey)`).
  It has no keep-mounted mode, so today it would reset filters/pagination and **stop polling
  only by unmount** (not by a controlled pause). For hubs with polling/state this needs a
  `keepMounted` + `isActive` (pause-polling) enhancement. This is a foundation change, not a
  per-hub hack.
- **Polling (verified)** — real intervals: `metrics` 30s, `cron` 60s, `enforcement` 30–60s,
  `admin/jobs` 3s only while active jobs exist, `orphan-assets` ~4s only while a scan is running.
  **No polling despite "auto-refresh" copy**: `status` and `alerts`.
- **Permissions (verified)** — frontend is **sidebar-only** for `system:read`/`content:read`;
  the only in-component role gates are `content-safety` (`isAdmin`), and the `configuration`
  hub's `app-config` + `force-update` tabs (`isAdmin`). The backend enforces authoritatively.
  Therefore a hub must render tabs conditionally and block restricted direct `?tab=` URLs, but
  must not be the only guard.
- **ML navigation is fragmented (verified)** — the ML overview (`/operations/ml-training`,
  `MLTrainingViews.tsx:225-381`) links to `/jobs` and a **broken** `/system/ml-training/models`
  ("View all" models); it does **not** link to `candidate-manifests`, `manifests`, or
  `vision-jobs`. The **"Candidate Review" sidebar entry is currently the only path** to
  `/operations/ml-training/candidate-manifests` (which links onward to `vision-jobs`). So the
  Candidate Review pointer cannot be dropped until an equivalent in-app link is added.

## Option evaluation

### Infrastructure (6 destinations)

- **A. One "Monitoring & Security" hub (6 tabs)** — rejected: six tabs is an oversized bar and
  conflates read-only telemetry with destructive device-security actions.
- **B. Two hubs — "Monitoring" + "Security"** — workable, but "Monitoring" would be Status +
  Metrics + Idempotency **plus** the existing 2-tab Alerts hub, forcing a nested tab layer.
- **C. Three destinations — Health / Alerts / Security** — **recommended**. Matches the real
  workflow split: read-only health telemetry, alert viewing/sending, and device-security
  administration. No nesting; three tabs max.

### Jobs (4 destinations)

- **A. One "Operations" hub (4 tabs)** — rejected: ML Training is a 10-route, complex,
  self-contained area; burying it as a tab harms discoverability and clutters the bar.
- **B. "Jobs" (Cron + Admin Jobs) + "ML Training" (standalone) with Candidate Review folded into
  ML navigation** — **recommended**. Cron and Admin Jobs are both operational job queues
  (2 tabs, read-only + retry/cancel); ML Training stays a dedicated area with a secondary nav.

### Content Ops (4 destinations)

- **A. One "Content Operations" hub (4 tabs)** — **recommended**, and **move it under Content**
  (all four are `content:read`-scoped content tools currently parked under System).
- B. Alternative splitting (e.g. keep Audit Log under System, move the rest) — rejected: the
  four are one "content administration/oversight" workflow and share `content:read`.

---

## Recommended structure

```
Current (System)                      Proposed
System                                System
├─ Infrastructure (6)                 ├─ Monitoring
│  ├─ Status                          │  ├─ Health → /system/health   (tabs: status | metrics | idempotency)
│  ├─ Metrics                         │  ├─ Alerts → /system/alerts-hub  (tabs: history | test)
│  ├─ Alerts (hub)                    │  └─ Security → /system/security  (tabs: enforcement | exceptions)
│  ├─ Idempotency                     ├─ Jobs
│  ├─ Enforcement                     │  ├─ Jobs → /system/jobs  (tabs: cron | admin)
│  └─ Security Exceptions             │  └─ ML Training → /operations/ml-training  (secondary nav, no Candidate Review pointer)
├─ Jobs (4)                           └─ Platform
│  ├─ Cron Jobs                          └─ Configuration → /system/configuration  (5 tabs incl. Email Templates)
│  ├─ Admin Jobs
│  ├─ ML Training                    Content (content:read)
│  └─ Candidate Review               └─ Content Ops → /content/ops  (tabs: audit | orphans | reports | safety*)
├─ Platform (2)                        (* safety tab is isAdmin-only)
│  ├─ Configuration (hub)
│  └─ Email Templates
└─ Content Ops (4)
   ├─ Audit Log
   ├─ Orphan Assets
   ├─ Content Reports
   └─ Content Safety
```

**Counts / nesting:**

| Group | Before entries | After entries | Sidebar depth |
|---|---|---|---|
| Infrastructure | 6 | 3 | 2 (unchanged) |
| Jobs | 4 | 2 | 2 (unchanged) |
| Content Ops | 4 | 0 in System (1 added under Content) | — |
| System total | 16 | 6 | 2 |

Distinguishing: this is **A (fewer sidebar entries) + B (combined page experiences via tabs)**;
there are no redundant implementations to delete. Every page remains as a component + a
compatibility route.

## Exact hub URLs + stable tab keys

| Hub | URL | Tab keys | Default |
|---|---|---|---|
| Health | `/system/health` | `status`, `metrics`, `idempotency` | `status` |
| Alerts | `/system/alerts-hub` | `history`, `test` | `history` |
| Security | `/system/security` | `enforcement`, `exceptions` | `enforcement` |
| Jobs | `/system/jobs` | `cron`, `admin` | `cron` |
| Configuration | `/system/configuration` | `flags`, `app`, `language`, `force-update`, `email` | `flags` |
| Content Ops | `/content/ops` | `audit`, `orphans`, `reports`, `safety` | `audit` |

Nested tab note: the Alerts hub's "Send Test" is a single page, not nested tabs; the existing
`/notifications/daily` internal 2-tab switch stays as-is but would use a distinct `dailyTab`
param when `/notifications` becomes a hub (out of scope here).

## Old URL → new destination mapping

| Old URL | New destination | Mechanism |
|---|---|---|
| `/system/status` | `/system/health?tab=status` | tab; keep route + temp redirect |
| `/system/metrics` | `/system/health?tab=metrics` | tab; keep route + temp redirect |
| `/system/idempotency` | `/system/health?tab=idempotency` | tab; keep route + temp redirect |
| `/system/alerts` | `/system/alerts-hub?tab=history` | tab; keep route + temp redirect |
| `/system/testing` | `/system/alerts-hub?tab=test` | tab; keep route + temp redirect |
| `/enforcement` | `/system/security?tab=enforcement` | tab; keep route + temp redirect |
| `/system/security-exceptions` | `/system/security?tab=exceptions` | tab; keep route + temp redirect |
| `/system/cron` | `/system/jobs?tab=cron` | tab; keep route + temp redirect |
| `/admin/jobs` | `/system/jobs?tab=admin` | tab; keep route + temp redirect (dashboard quick action `/audio/jobs` unaffected) |
| `/operations/ml-training/candidate-manifests` | ML overview secondary-nav link | remove sidebar pointer; add link; route unchanged |
| `/system/email-templates` | `/system/configuration?tab=email` | tab; keep route + temp redirect |
| `/content/audit-log` | `/content/ops?tab=audit` | tab; keep route + temp redirect |
| `/content/audit-log/orphan-assets` | `/content/ops?tab=orphans` | tab; keep route + temp redirect (dashboard quick action update) |
| `/content/reports` | `/content/ops?tab=reports` | tab; keep route + temp redirect |
| `/content/content-safety` | `/content/ops?tab=safety` | tab; keep route + temp redirect |

**Remain standalone:**
- `/operations/ml-training` + all `[id]`/sub-routes (`jobs`, `models`, `manifests`,
  `candidate-manifests`, `vision-jobs`) — complex ML detail/editor workflows stay on dedicated
  routes; only the sidebar is simplified (add a secondary nav/links on the overview).
- `/system/configuration` and its four sub-pages (`config`, `app-config`, `language-settings`,
  `force-update`) — kept as compatibility routes; sidebar points only at the hub.

## Permission & state/polling tables

### Permissions

| Hub / tab | Required | Direct `?tab=` behaviour |
|---|---|---|
| Health (status/metrics/idempotency) | `system:read` | render only if permitted; else access-denied (no fetch) |
| Alerts (history/test) | `system:read` | same |
| Security (enforcement/exceptions) | `system:read` | same |
| Jobs (cron/admin) | `system:read` | same |
| ML Training (+ subroutes) | `system:read` | same (backend enforces on each API) |
| Content Ops (audit/orphans/reports) | `content:read` | render only if permitted |
| Content Ops (safety) | `isAdmin` | hide tab + block direct URL for non-admin |

### Polling / state (what must survive or pause)

| Tab | Polling | State to preserve |
|---|---|---|
| metrics | 30s | none |
| cron | 60s | none |
| enforcement | 30–60s | time-range selection |
| admin jobs | 3s (only while active) | status/type filters, page size, orphaned-audio accordion |
| status | none | none |
| alerts | none | level/category filters, page |
| idempotency | none | days filter |
| security-exceptions | none | none |

Requirements:
- Hubs that include polling tabs must use a **keep-mounted** variant (render-all/hidden) so
  filter/pagination survive, and pass an `isActive` flag so each tab **pauses its interval**
  when hidden (no duplicate intervals, no background requests from inactive tabs).
- `admin/jobs`'s conditional 3s polling and orphaned-audio progress must keep tracking even if
  the user switches away (do not unmount mid-operation).
- Content Safety's `isAdmin` gate stays; the hub hides the tab and blocks the URL.

## Component extraction & files

- Extract page bodies into feature modules (same pattern as the Courses checkpoint):
  `src/components/system/{StatusContent,MetricsContent,IdempotencyContent,AlertsContent,
  TestingContent,EnforcementContent,SecurityExceptionsContent,CronJobsContent,AdminJobsContent}.tsx`
  and `src/components/content/{AuditLogContent,OrphanAssetsContent,ReportsContent,
  ContentSafetyContent}.tsx`; the existing route pages become thin wrappers.
- New hub pages: `src/app/(admin)/(others-pages)/system/{health,security,jobs}/page.tsx`,
  `src/app/(admin)/(others-pages)/content/ops/page.tsx`; migrate `alerts-hub` + `configuration`
  to `UrlTabs`.
- `src/components/ui/url-tabs.tsx` — add `keepMounted` + `isActive` pause support (foundation).
- `src/config/adminNavigation.tsx` — System tree rewrite; add Content Ops under Content.
- `next.config.ts` — temporary (307) redirects for the mapping above.

## Risks & verification

Risks:
- Polling/state loss if keep-mounted is not implemented correctly (highest risk).
- Mixed-permission Content Ops (safety tab) — gate the tab and the URL.
- ML Candidate Review discoverability — must add the overview link in the same batch as the
  pointer removal; verify the (currently broken) models "View all" link is also fixed then.
- Redirect param collisions — hub `tab` must not collide with tab-specific params (e.g.
  enforcement `hours`, admin-jobs `page`/`type`).

Verification:
- Every old URL → correct tab (direct link, refresh, back/forward, unknown tab fallback).
- Permission matrix incl. direct restricted `?tab=` (no fetch, access-denied).
- Polling: active tab polls, inactive pauses, no duplicate intervals, ongoing admin-job/orphan
  cleanup survives tab switches.
- Workflows: cron/admin-job retry/cancel, ML promote/rollback, enforcement time-range,
  security-exception add/remove, orphan-asset scan/delete, content-safety isAdmin actions.
- `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.

## Recommended batches + checkpoints

1. **Foundation**: add `keepMounted` + `isActive` to `UrlTabs` (no page changes).
2. **Jobs hub** (`/system/jobs`: cron + admin) — lowest risk, 2 uniform `system:read` tabs, has
   the only conditional polling (proves pause-on-inactive). Checkpoint.
3. **Health + Security hubs** (status/metrics/idempotency; enforcement/exceptions). Checkpoint.
4. **ML secondary nav + Candidate Review pointer removal** (add overview links, fix broken models
   link). Checkpoint.
5. **Content Ops hub under Content** (mixed permission — last). Checkpoint.
6. **Redirects + quick-action updates**, then full verification.

## Decisions requiring approval

1. Infrastructure → **three** destinations (Health / Alerts / Security) — vs two (Monitoring/Security).
2. Jobs → **"Jobs" hub + standalone ML Training**, Candidate Review folded into ML secondary nav
   (requires adding an overview link before removing the pointer).
3. Content Ops → **one 4-tab hub, moved under Content** (Safety tab `isAdmin`-gated).
4. `UrlTabs` enhancement: add **keep-mounted + pause-polling** as the standard for stateful hubs
   (vs accepting unmount for read-only tabs only).
5. Email Templates folded into Configuration (5th tab) — carry-over decision from §9.

---

# Verification backlog (deferred — run once implementation pass is complete)

No checks below have been run yet this pass. Run them in order and report exact exit codes.

## Typecheck
- `npx tsc --noEmit` — expect clean; previously only the subscriptions route-export error (now fixed). Confirm 0 errors.

## Lint
- `npm run lint` — confirm 0 errors. Note: new `react-hooks` Compiler rules (`set-state-in-effect`, `set-state-in-render`) are active; UrlTabs was written against them.

## Tests
- `npm test` — baseline was 29/33 suites passing (4 pre-existing failing suites: `subscriptionsPage`, `coursesListPage`, `LessonBlueprintEditor`, `users/page`). New `src/__tests__/urlTabs.test.tsx` adds 3 tests. Confirm the 4 pre-existing suites still fail for the SAME pre-existing reasons (not new regressions).

## Build
- `npm run build` — confirm exit code 0 and all routes present (audio, notifications, lesson-blueprints, system/security, system/jobs, content/ops, system/health, etc.).

## Browser (deferred — no browser tooling this pass)
- Each hub: default/explicit/invalid `?tab`, refresh, back/forward, query-param preservation.
- 307 redirects resolve single-hop with query params preserved; no loops.
- Polling: unvisited tabs fire no requests; active tab polls; hidden pauses; reactivation refetches without duplicate timers; unmount cleans up.
- Content Ops `safety` tab: non-admin direct `?tab=safety` shows access-denied, never mounts/fetches.
- Keyboard/focus: inactive panels `hidden` (not focusable); tab links reachable.
- Courses hub regression.
- Custom selects render custom menus (no native `<select>` UI); empty/"All" values, clearing, disabled/error states.

## Known gaps to review before sign-off
- Alerts hub + Configuration hub still **reuse page components directly** (page headers render inside tabs) rather than extracted `showHeader` components — cosmetic; extract later if desired.
- `Combobox` (searchable) is built but not yet wired to any large-list field (voices/courses); wire where >~30 options.
- `pause` option on `useServicesStatus` gates periodic revalidation only — in-flight requests are not aborted, and focus/reconnect revalidation is already disabled independently.

---

# Latest pass — integration gaps + chart migration (implemented, verification deferred)

## Integration gaps closed
- **Alerts + Configuration hubs** now render extracted `showHeader` content components (no duplicate page headings). Alerts → `AlertsContent`/`TestingContent`; Configuration → `PlatformConfigContent`/`AppConfigContent`/`LanguageSettingsContent`/`ForceUpdateContent`/`EmailTemplatesContent` (`src/components/{system,settings}/`).
- **Combobox** (searchable) wired into 4 long-list fields: audio `GenerateContent` voices, `RegenerateAudioModal` voices, curriculum editor course select, `LessonBlueprintEditor` course select. Added `required` (asterisk) to `Combobox`.
- **Adapter review**: empty-value sentinel (`__abidii_empty__`) in `selectValue.ts`; numeric values stringified (`toSelectValue`); disabled options passed through; `required` asterisk on both adapters; `name`/hidden-input form submission is moot (all forms use controlled React state, no native FormData submit of select values); refs via `forwardRef` (no callers pass refs); `data-*`/`aria-*` forwarded by `StyledSelect` (restores `data-field-path` validation highlighting in `LessonBlueprintEditor`).
- **Redirects**: single-hop 307s for all folded routes; legacy aliases repointed to avoid double hops; Next.js auto-forwards query params; nested `DailyContent` tabs use local state (no `?tab` collision). Conflicting-`tab` edge case (user manually adds `?tab` to a legacy URL) is negligible.
- **Modal portals**: dashboard `Modal` renders inline (`fixed inset-0`, no portal), so `hidden` hides it. No Radix Dialog/`createPortal` in any hub tab content (only `ui/sheet.tsx`, not in tabs). Updated `UrlTabs` doc comment accordingly.

## Chart migration
- Migrated to Recharts: `RoomsTimeSeriesChart` (multi-series bar), `analytics/detailed` (`FluencyPieChart` donut, `ActivityByHourChart` bar, `FeatureUsageChart` horizontal bar), `DailyContent` (`BreakdownChart` horizontal bar + audience-trend area).
- Applied bright palette (`#38bdf8/#34d399/#fbbf24/#a78bfa/#fb7185`) to `chartTheme.colors`, `FLUENCY_COLORS`, and inline series colors; theme-aware grid/text via `chartTheme`.
- Deleted 11 dead Apex chart files (no importers/dynamic references); removed `react-apexcharts` + `apexcharts` deps; cleaned stale `next/dynamic` mock in `UserRetentionCard.test.tsx`. No Apex references remain in `src`.

## Remaining (not started)
- **Reference-aligned page redesign** (route-by-route): Content pages (words filters/forms/dialogs + remaining tables), Community/Users + Subscriptions, Curriculum editors, Media/Notifications/System visual polish, ML Training/Admin Jobs, Settings/Profile, Auth/error pages. Prior sessions did the dashboard pilot, users side panel, theme tokens, fonts. Not per-page completed this pass.

---

# Reference-aligned redesign — route checklist (this pass)

Status key: ✅ presentation aligned · ◐ partial (noted gaps) · ⬜ not started.

## Code-level gaps closed this pass
- `required` now drives native validation: `StyledSelect` + `Combobox` render a visually-hidden native `<select required>` mirroring the actual value (empty → blocks submit). `Radix` `required` removed from Root to avoid sentinel double-validation.
- Daily Content nested tabs now URL-addressable via `dailyTab` (`?tab=daily&dailyTab=teaser`), preserving refresh/back-forward.
- Radix Select/Popover portals close when their tab goes inactive via new `TabActivityContext` (`src/components/ui/tab-activity.tsx`) provided by `UrlTabs`; `StyledSelect`/`Combobox` consume it (render-time close, value/drafts preserved).
- Chart contrast: theme-specific palette — light uses 600-level (`#0284c7/#059669/#d97706/#7c3aed/#e11d48`), dark uses 400-level (`#38bdf8/#34d399/#fbbf24/#a78bfa/#fb7185`), wired through `--chart-1..5` (globals.css) and `chartTheme.colors`; migrated charts read `c.colors`.
- Redirect query forwarding recorded as **unverified** (conflicting `?tab` edge case noted).

## Content pages
- ✅ Domain pages (words/letters/numbers/phrases/sentences/proverbs/time-phrases/learning-items) already use shared `ContentPageHeader`/`ContentStatsGrid`/`ContentFiltersCard` + `StyledSelect` filters.
- ◐ Remaining: `react-icons` (`Fi*`) → Lucide icon migration across these pages; a few `bg-blue-*` stat-card accents left as semantic.

## Community/Subscriptions
- ✅ Users page: side panel + provider/device logos (FcGoogle/FaApple) done prior pass.
- ◐ Subscriptions: primary action buttons migrated `bg-blue-600` → shadcn `Button`/`bg-brand-600` this pass. Remaining: raw `<table>` + inline SVG provider icons + status badges could move to shadcn `Table`/`Badge`.

## Curriculum / Media / Notifications / System / ML Training / Admin Jobs / Settings / Auth
- ⬜ Not redesigned this pass (inspected only). Raw tables/buttons/inline SVGs remain in these areas.

## Verification deferred (unchanged)
Run tsc / lint / jest / build + browser pass after implementation; see backlog section above.

---

# Additional requirements — implementation status (this pass)

## 1. Platform Distribution donut — centred total ✅
- `PlatformDistributionChart` now renders a centred large total + "Total users" label (theme-aware `text-foreground`/`text-muted-foreground`), matches displayed segments (`total` or sum), keeps counts/percentages/legend/tooltips + loading/empty states. Series colours made theme-specific via `chartTheme.colors`.

## 2. Dashboard-wide date filter ✅ (backend gaps reported)
- `?range=all|7d|30d|6m|1y` URL-backed, custom `StyledSelect` dropdown, wired to `MonthlyUserGrowthChart(months)`, `MonthlySubscriberGrowthChart(months)`, `DailyActiveUsersChart(days)`, `UserRetentionCard(weeks)`, `RecentActivityFeed(days)`. Lifetime/current widgets (stat cards, System Health, Platform Distribution, CountryMap, Billing Plans) left unfiltered.
- **Backend caps (audit)** — all endpoints reject out-of-cap values (return 422 → chart error state, not faked):
  - `/analytics/daily-active-users` & `/analytics/recent-activity`: `days` le=90 → "6m"/"1y"/"all" unsupported.
  - `/analytics/retention`: `weeks` le=12 → "6m"/"1y"/"all" unsupported.
  - `/analytics/monthly-user-growth` & `monthly-subscriber-growth`: `months` le=24 → "all" unsupported.
  - `/analytics/geo/active`: `window_days` le=365 → "all" unsupported.
  - **"All time"** requires removing `le` caps or adding an "all" sentinel on every endpoint (complete history, not a large limit). Proposed: raise caps to `le=3650`/`le=1200`/`le=520` and/or accept `0`/`null` as "all".
  - "all" currently maps to the backend caps (best-effort available history); chart subtitles show the actual passed value.

## 3. Content Library — English translation language ⚠️ (backend gap, reported, not implemented)
- English (`eng`, id `94050825-516b-4c73-9fa9-019399a4255e`) has `is_public = FALSE`; `/api/v1/languages` filters `is_public = TRUE`, so `useLanguages()` omits English and the words translation-language selector lacks it — despite the model having **963 English target glosses** (English is a valid translation target, not only the source/anchor).
- No admin "list all languages" endpoint exists. Proposed backend change: expose non-public languages to admin (e.g. `GET /api/v1/admin/languages` returning all, or `?include_non_public=true` on `/api/v1/languages`), then wire the words selector to it. No DB change made; no hardcoded English option added.

## 4. Subscriptions — View opens user-details drawer ✅
- Extracted `src/components/admin/users/UserDetailsSheet.tsx` (Sheet + `UserDetailPanel` + close/Escape/focus restoration). Users page now uses it; Subscriptions "View User" action opens the drawer with the selected row's real `user_id` (delete/purge refreshes subscriptions + stats). Standalone `/users/[id]` routes untouched.

## 5. Required-field adapter — reviewed ✅ (browser deferred)
- Hidden native `<select required>` uses `clip` (not `display:none`) so it is focusable (avoids "not focusable"), `tabIndex={-1}` + `aria-hidden` (never exposes a native dropdown), `disabled` mirrored, no `name` (no duplicate form value), `onFocus` redirects to the visible trigger, `aria-invalid`/`aria-required` on the trigger. Actual browser validation bubble/focus behaviour is **unverified** until the browser pass.
