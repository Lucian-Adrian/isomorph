# Isomorph Repository Audit Report

> **Audit Date:** 2026-06-17  
> **Scope:** Full verification against [implementation_plan_A.md](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/docs/stuff/implementation_plan_A.md), [implementation_plan_B.md](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/docs/stuff/implementation_plan_B.md), [accounts.md](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/docs/stuff/accounts.md), [clean.md](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/docs/stuff/clean.md), [AGENTS.md](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/docs/stuff/AGENTS.md) rules, and general best practices.

---

## Executive Summary

The project has successfully implemented the core systems from both Phase A and Phase B. Authentication, cloud saves, collaboration with Yjs CRDT, share links, access control, feedback, telemetry, and version history are all functional. However, there are notable code-quality concerns (5,400+ line God File, `any` types), some schema deviations from the original design doc, and a few missing features.

| Area | Status | Grade |
|------|--------|-------|
| **Phase A: Auth & Cloud** | ✅ Complete | A |
| **Phase B: Collaboration** | ✅ Complete | A- |
| **Security** | ⚠️ Mostly Good (leaked key rotated) | B+ |
| **Code Quality** | ⚠️ Functional but needs cleanup | C+ |
| **Git Hygiene** | ⚠️ Mixed | B- |
| **Design Doc Compliance** | ⚠️ Minor deviations | B |

---

## 1. Implementation Plan A — Auth, Cloud Saves, Feedback, Telemetry, Settings

### A1. Supabase Client Setup

| Item | Status | Evidence |
|------|--------|----------|
| [supabase.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/supabase.ts) created | ✅ Done | Uses `import.meta.env` vars correctly |
| Dev proxy to bypass Incognito ETP | ✅ Done | Proxies through `/supabase-api` in dev |
| [.env.example](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/.env.example) created | ✅ Done | Documents `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WS_URL` |
| [env.d.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/env.d.ts) type declarations | ✅ Done | Typed `ImportMetaEnv` with all 3 vars |
| [vite.config.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/vite.config.ts) proxy config | ✅ Done | Proxy to actual Supabase URL |

### A2. Auth State & Context

| Item | Status | Evidence |
|------|--------|----------|
| [auth-context.tsx](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/auth-context.tsx) — `AuthProvider` | ✅ Done | Context with `session`, `user`, `loading`, `isAuthenticated`, `signOut` |
| `onAuthStateChange` listener | ✅ Done | Reactively updates on auth events |
| [main.tsx](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/main.tsx) wraps `<AuthProvider>` | ✅ Done | Wraps `<App />` correctly |

### A3. Auth UI (Login / Register / Reset Password)

| Item | Status | Evidence |
|------|--------|----------|
| [AuthModal.tsx](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/AuthModal.tsx) — tabbed modal | ✅ Done | Login / Register / Reset modes |
| OSINT protection on register | ✅ Done | Server-side `/api/check-email` endpoint prevents duplicate confirmation emails |
| Generic "check email" message | ✅ Done | Always shows `auth.success_register` regardless of email existence |
| Reset password flow | ✅ Done | Uses `supabase.auth.resetPasswordForEmail()` |
| i18n strings | ✅ Done | Uses `tText(lang, key)` throughout |
| Escape to close / click-outside | ✅ Done | `onMouseDown={onClose}` on overlay |
| Wired to toolbar | ✅ Done | Login button opens AuthModal in App.tsx |

### A4. Profile Management

| Item | Status | Evidence |
|------|--------|----------|
| [profile.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/profile.ts) — CRUD | ✅ Done | `getProfile()`, `updateProfile()`, `uploadAvatar()` |
| Avatar upload to Supabase Storage | ✅ Done | Uploads to `avatars` bucket with `upsert: true` |
| Settings modal wired to profile | ✅ Done | Profile tab in settings per git history |

### A5. Project & Diagram CRUD (Cloud Saves)

| Item | Status | Evidence |
|------|--------|----------|
| [projects.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/projects.ts) — full CRUD | ✅ Done | Create, get, update, delete for projects and diagrams |
| Tier limit enforcement | ✅ Done | `checkProjectLimit()` and `checkDiagramLimit()` with `TIER_LIMITS` |
| Version history (Ctrl+S saves) | ✅ Done | `saveDiagramHistory()` with rolling buffer quota |
| Library modal — My Works / Shared Works | ✅ Done | Library tabs at L907 and L3793–3927 in App.tsx |

### A6. Feedback System

| Item | Status | Evidence |
|------|--------|----------|
| [FeedbackModal.tsx](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/FeedbackModal.tsx) | ✅ Done | Category selector (general/bug/feature), content textarea |
| Uses `useAuth()` for user context | ✅ Done | Links `user_id` if logged in |
| Success toast | ✅ Done | Shows success message after submit |
| i18n strings | ✅ Done | All labels use `t()` function |

> [!NOTE]
> The feedback schema differs slightly from `accounts.md`: the original DBML specifies `feedback_category` enum with 4 values (`bug`, `feature_request`, `general`, `ui_ux`), but the actual table uses 3 (`general`, `bug`, `feature`). Missing `ui_ux` and `feature_request` is `feature` instead. This is minor.

### A7. Telemetry

| Item | Status | Evidence |
|------|--------|----------|
| [telemetry.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/telemetry.ts) | ✅ Done | `logEvent()`, `setTelemetryEnabled()`, `isTelemetryEnabled()` |
| localStorage toggle | ✅ Done | Persists opt-out via `isomorph-telemetry` key |
| Silent fail on telemetry errors | ✅ Done | Catches and warns, never throws |
| Settings toggle | ✅ Done | Connected per git commit history |

> [!WARNING]
> **Design deviation:** The original plan specifies batching events every 30s. The current implementation sends events **immediately** on each `logEvent()` call. This generates more API calls but is acceptable for current scale.

### A8. Settings Page Enhancement

| Item | Status | Evidence |
|------|--------|----------|
| Profile tab wired | ✅ Done | Per git commits (`165f6080`, `c3812a8f`) |
| Cursor colour picker | ✅ Done | 8 colours in settings (L3294 in App.tsx) |
| Account deletion | ✅ Done | Migration `004_add_delete_user_function.sql` + UI |
| Password reset from settings | ✅ Done | Per commit `165f6080` |

### A9. SQL Migrations

| Item | Status | Evidence |
|------|--------|----------|
| [001_initial_schema.sql](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/supabase/migrations/001_initial_schema.sql) | ✅ Done | Profiles, projects, diagrams, feedback, storage |
| [002_add_settings_and_telemetry.sql](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/supabase/migrations/002_add_settings_and_telemetry.sql) | ✅ Done | Settings JSONB + telemetry_events |
| Trigger: auto-create profile | ✅ Done | `handle_new_user()` trigger in 001 |
| RLS on every table | ✅ Done | All tables have `ENABLE ROW LEVEL SECURITY` |

---

## 2. Implementation Plan B — Yjs Sync Fix, Share Links, Access Control

### B1. Yjs Text Sync Bug Fix

| Item | Status | Evidence |
|------|--------|----------|
| Server queries `content` column (not `source`) | ✅ Fixed | [server/index.js](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/server/index.js) L21–36 reads `data.content.source` |
| Empty doc check before init | ✅ Done | `if (text.toString() === '')` guard at L33 |
| `y-codemirror.next` integration | ✅ Done | Editor imports `yCollab` from `y-codemirror.next` |
| Awareness protocol for cursors | ✅ Done | Sets `user.name`, `user.color`, `user.avatarUrl`, `user.role` |

### B2. Share Links & Access Control

| Item | Status | Evidence |
|------|--------|----------|
| URL structure `?share=<TOKEN>` | ✅ Done | App.tsx reads `params.get('share')` at L1030-1035 |
| [share-links.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/share-links.ts) — CRUD | ✅ Done | Create, get, delete, resolve |
| [access-control.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/access-control.ts) — CRUD | ✅ Done | Grant, revoke, get access |
| [ShareModal.tsx](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/ShareModal.tsx) | ✅ Done | Two tabs: Share Links + Direct Access |
| File-level sharing (per-diagram) | ✅ Done | `diagram_id` column added in migration 008 |
| Anonymous sessions | ✅ Done | [AnonymousLoginModal.tsx](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/AnonymousLoginModal.tsx) prompts for name |

### B3. RLS Policy Updates

| Item | Status | Evidence |
|------|--------|----------|
| [007_update_rls.sql](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/supabase/migrations/007_update_rls.sql) — `has_project_access()` | ✅ Done | Checks owner OR project_access |
| `redeem_share_link()` RPC | ✅ Done | Validates token, inserts access, increments use count |
| `get_shared_project_data()` RPC | ✅ Done | Returns project + diagrams for anonymous users |
| [009_file_sharing_fixes.sql](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/supabase/migrations/009_file_sharing_fixes.sql) — diagram-level access | ✅ Done | `has_diagram_access()` function |
| [010_fix_projects_rls.sql](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/supabase/migrations/010_fix_projects_rls.sql) — insert-returning fix | ✅ Done | Inlines policy instead of using function to fix subquery visibility |

### B4. Collaboration System

| Item | Status | Evidence |
|------|--------|----------|
| [collaboration.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/collaboration.ts) — `YjsManager` class | ✅ Done | Singleton pattern, connect/disconnect, awareness |
| `useCollaboration()` hook | ✅ Done | Returns `awareness`, `isConnected`, `isSynced`, `collaborators` |
| Collaborator list with avatars + roles | ✅ Done | Per commit `e5ff6b35`, renders profile photos and role badges |
| [server/index.js](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/server/index.js) — y-websocket server | ✅ Done | Persistence hooks to Supabase, CORS headers |
| Server `.env.example` | ✅ Done | Documents `SUPABASE_SERVICE_ROLE_KEY` separation |

---

## 3. Security Review

### 3.1 Secret Management

| Check | Status | Notes |
|-------|--------|-------|
| `.env.local` gitignored | ✅ | Pattern `*.local` in [.gitignore](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/.gitignore) |
| `server/.env` gitignored | ✅ | Explicitly in `.gitignore`, untracked in `dbd57d6f` |
| Service role key not in frontend | ✅ | Only in `server/.env`, frontend uses anon key |
| **Historical key leak** | ⚠️ Rotated | Commit `3b603677` contained full `SUPABASE_SERVICE_ROLE_KEY` in `server/.env`. **User confirmed keys are rotated.** Old key remains in git history — consider `git filter-branch` or BFG Repo-Cleaner if repo is public. |

### 3.2 RLS Compliance

| Table | RLS Enabled | Policies Correct |
|-------|-------------|-----------------|
| `profiles` | ✅ | ✅ Select: public, Insert/Update: own only |
| `projects` | ✅ | ✅ Owner + project_access members |
| `diagrams` | ✅ | ✅ Owner + diagram-level access |
| `feedback` | ✅ | ✅ Insert: anyone, Select: own only |
| `telemetry_events` | ✅ | ✅ Insert: anyone, Select: false (admin only) |
| `project_access` | ✅ | ✅ Owner can CRUD |
| `share_links` | ✅ | ✅ Owner can CRUD |
| `anonymous_sessions` | ✅ | ⚠️ Overly permissive — `USING (true)` for SELECT/INSERT/UPDATE means any authenticated user can view/modify any anonymous session |
| `comments` | ✅ | ✅ Appropriate policies |
| `diagram_history` | ✅ | ✅ Owner-based via join |
| `avatars` storage bucket | ✅ | ⚠️ Upload policy `WITH CHECK (bucket_id = 'avatars')` lets **any** user upload/overwrite **any** avatar. Should check `auth.uid()` matches file path. |

### 3.3 OSINT Protection

| Check | Status |
|-------|--------|
| Registration never reveals email existence to browser | ✅ Server-side check via `/api/check-email` |
| Generic error messages | ✅ Uses `t('auth.error_generic')` |
| Password reset always says "check email" | ✅ Shows `t('auth.success_reset')` unconditionally |

> [!IMPORTANT]
> **OSINT concern with `/api/check-email`:** This endpoint uses `supabase.auth.admin.listUsers()` which fetches **all users** into memory to check if an email exists. This is:
> 1. **Not scalable** — loading all users grows linearly.
> 2. **Callable from browser** — while it's used to prevent duplicate signup emails, the endpoint itself returns `{ exists: true/false }` which could be directly called by an attacker to enumerate emails. The frontend never exposes this to the user, but the API endpoint is open.
>
> **Recommendation:** Either rate-limit this endpoint heavily, or use Supabase's admin `getUserByEmail()` API instead of listing all users.

### 3.4 Server Security

| Check | Status | Notes |
|-------|--------|-------|
| CORS | ⚠️ | `Access-Control-Allow-Origin: *` — acceptable for development but should be restricted in production |
| WebSocket auth | ⚠️ Missing | No token validation on WS connect (L132–139 in server/index.js). Anyone can connect to any room. |
| Concurrency limit (8 users) | ❌ Not implemented | The `accounts.md` spec says "Hard cap: 8 concurrent users per project". No enforcement exists. |

---

## 4. Code Quality Assessment (vs [clean.md](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/docs/stuff/clean.md))

### 4.1 The "God File" Problem

> [!CAUTION]
> **[App.tsx](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/App.tsx) is 5,466 lines (311 KB).** This is the #1 concern from `clean.md`. The file contains:
> - All workspace state management
> - All modal rendering (settings, library, export, etc.)
> - All diagram manipulation functions (~40+ utility functions)
> - All keyboard shortcuts
> - All toolbar/header rendering
> - Share link redemption logic
> - History pane logic
>
> This should be broken into at least 10-15 smaller files per `clean.md` Phase 2-4 instructions.

### 4.2 TypeScript Strictness

| Check | Status | Notes |
|-------|--------|-------|
| `strict: true` in tsconfig | ✅ | Enabled |
| `noUnusedLocals` | ✅ | Enabled |
| `noUnusedParameters` | ✅ | Enabled |
| `any` usage in `src/lib/` | ⚠️ | Found in [profile.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/profile.ts) (`settings?: any`), [projects.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/projects.ts) (`content: any`), [telemetry.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/telemetry.ts) (`metadata: any`), [collaboration.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/collaboration.ts) (`provider: any`) |
| `as any` casts in access-control | ⚠️ | `return data as any as ProjectAccess[]` in [access-control.ts:31](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/access-control.ts#L31) |

### 4.3 Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Centralized error handling | ❌ Missing | Each lib file has its own `console.error()` + return null/false pattern. No unified error handler per `clean.md`. |
| Silent failures in CRUD | ⚠️ | Many functions return `false` or `null` on error without surfacing to the user |

### 4.4 Type Centralization

| Check | Status | Notes |
|-------|--------|-------|
| Centralized `types/` directory | ❌ Missing | Types are scattered: `Profile` in profile.ts, `Project`/`Diagram` in projects.ts, `ShareLink` in share-links.ts, `ProjectAccess` in access-control.ts. `clean.md` recommends a `types/` folder. |

### 4.5 Share Link Token Generation

> [!WARNING]
> Token generation in [share-links.ts:23](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/share-links.ts#L23) uses `Math.random()`:
> ```ts
> const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
> ```
> The `accounts.md` spec says "Cryptographically random URL token". `Math.random()` is **not** cryptographically secure. Use `crypto.randomUUID()` or `crypto.getRandomValues()`.

---

## 5. Design Doc Compliance (accounts.md)

### 5.1 Schema Deviations

| accounts.md Spec | Actual Implementation | Impact |
|------------------|-----------------------|--------|
| `profiles.display_name` | `profiles.full_name` | Minor naming difference |
| `profiles.username` varchar(40) NOT NULL | `profiles.username` text, nullable | Less strict |
| `profiles.cursor_colour` enum | Stored in `profiles.settings` JSONB | Different storage, same functionality |
| `profiles.telemetry_enabled` boolean | Stored in localStorage | Not synced across devices |
| `feedback.category` enum (4 values) | `feedback.type` text CHECK (3 values) | Missing `ui_ux`, renamed field |
| `feedback.subject`, `page_url`, `user_agent`, `app_version` | Not present | Missing metadata capture |
| `diagrams.source_code` text | `diagrams.content` jsonb | JSONB stores `{ source: string }` — more flexible but different |
| `diagram_versions` table | `diagram_history` table | Different naming, similar function |
| `notifications` table | Not implemented | Feature deferred |
| `share_links.created_by` | Not in actual schema (column exists in 006) | Present |

### 5.2 Missing Features from accounts.md

| Feature | Status |
|---------|--------|
| Notifications system | ❌ Not implemented |
| Comments system (UI) | ❌ Tables exist, no UI |
| Anonymous session table writes | ❌ Modal exists but no DB persistence of anonymous sessions |
| Cursor presence on canvas (DiagramView cursors) | ⚠️ Partial — awareness data flows but canvas cursor rendering for remote users is basic |
| Concurrency limit (8 users) | ❌ Not enforced |
| Session expiry cleanup (cron) | ❌ No cleanup job |
| Magic Link auth | ❌ Not implemented (labeled P1) |
| OAuth (Google/GitHub) | ❌ Not implemented (labeled P2) |

---

## 6. Git Hygiene

### 6.1 Commit Messages

The commit messages are **descriptive and follow conventional format** (`feat:`, `fix:`, `docs:`). This is good practice. Examples:

- `feat: Fully implemented multi user access to projects and files`
- `fix: Untrack and ignore server/.env`
- `feat: Added user type badge and profile photo in live share`

### 6.2 Concerns

| Issue | Severity | Notes |
|-------|----------|-------|
| Service role key in git history | 🔴 Critical | Commit `3b603677` — keys rotated ✅ but history still contains old key |
| `.temp.txt` (275KB) tracked | ⚠️ Minor | Listed in `.gitignore` but still in working tree (275KB file) |
| `server/node_modules/` not in root `.gitignore` | ✅ OK | Has its own `.gitignore` or is in server's own |
| No `.prettierrc` or `.eslintrc` | ⚠️ | `clean.md` recommends Prettier + ESLint — not configured |

---

## 7. AGENTS.md Compliance

| Rule | Status |
|------|--------|
| All buttons have hover effects | ✅ Appears consistent from CSS |
| Modals close on Escape + click-outside | ✅ All modals implement this |
| Dark/light theme compatibility | ✅ Uses CSS variables throughout |
| i18n for EN/RO/RU | ✅ All new strings use `t()` |
| No hardcoded visible strings | ⚠️ A few hardcoded strings remain: "No shared works" at L3927, "Remove Access" title at L273 in ShareModal, cursor colour description at L3294 |

---

## 8. Prioritized Recommendations

### 🔴 Critical (Security)

1. **Scrub service role key from git history** — Use BFG Repo-Cleaner or `git filter-repo` to remove the old key from commit `3b603677`, especially if the repo is public or will become public.
2. **Fix avatar storage policy** — Restrict uploads so users can only upload to their own `userId/` path.
3. **Rate-limit or redesign `/api/check-email`** — Current implementation is an email enumeration vector.
4. **Add WebSocket auth** — Validate JWT tokens on WS connection to prevent unauthorized room access.

### 🟠 High (Code Quality)

5. **Break up App.tsx** — Follow `clean.md` Phase 2-4 to extract the 5,400-line God File into ~15 modules. Start with extracting types, constants, utility functions, then bottom-up UI components.
6. **Replace `any` types** — Define proper interfaces for `content`, `settings`, `metadata`, and the Yjs `provider`.
7. **Use `crypto.randomUUID()` for share tokens** — Replace `Math.random()` in share-links.ts.
8. **Centralize error handling** — Create a unified error utility per `clean.md` instead of scattered `console.error` + return patterns.

### 🟡 Medium (Completeness)

9. **Add hardcoded string to i18n** — A few English-only strings remain in ShareModal and App.tsx.
10. **Implement concurrency limit** — The 8-user cap from accounts.md is not enforced.
11. **Fix anonymous session persistence** — AnonymousLoginModal prompts for a name but doesn't write to the `anonymous_sessions` table.
12. **Add Prettier + ESLint config** — Per `clean.md` Part 2 recommendation.

### 🟢 Low (Nice to Have)

13. **Telemetry batching** — Batch events every 30s per original plan instead of immediate sends.
14. **Feedback metadata capture** — Add `page_url`, `user_agent`, `app_version` to feedback submissions per accounts.md.
15. **Sync `telemetry_enabled` to profile** — Currently localStorage-only; won't sync across devices.
16. **Anonymous session cleanup** — Add a Supabase scheduled function to expire stale sessions.

---

## 9. Summary: What's Done vs. Not Done

````carousel
### ✅ Fully Implemented
- Supabase client + auth context + AuthProvider
- Email/password login, register, reset
- OSINT-safe registration flow
- Profile CRUD + avatar upload
- Project + diagram CRUD with tier limits
- Cloud save (Ctrl+S) with version history + rolling quota
- Library modal (My Works / Shared Works / Examples)
- Feedback modal with categories
- Telemetry with opt-out toggle
- Settings: profile, collaboration (cursor colour), account deletion
- Yjs CRDT text sync via y-websocket server
- y-codemirror.next integration in editor
- Awareness protocol (cursor presence with name, colour, avatar, role)
- Share links (create, copy, revoke) — project-level and file-level
- Direct access grants (by username) with role selection
- Anonymous access via share links with name prompt
- 10 SQL migrations with RLS policies
- Server persistence (load/save Y.Doc from/to Supabase)
- Collaborator list with profile photos and role badges
- i18n for all auth, share, feedback, join strings
<!-- slide -->
### ❌ Not Implemented
- Notifications system (table in DBML, no code)
- Comments UI (table exists, no frontend)
- Canvas cursor rendering for remote users (awareness data flows but no visual cursors)
- Concurrency limit enforcement (8-user cap)
- WebSocket authentication
- Magic Link auth (P1)
- OAuth Google/GitHub (P2)
- Anonymous session DB persistence
- Session cleanup cron
- Prettier / ESLint configuration
- App.tsx decomposition
- Centralized types directory
- Centralized error handling
````
