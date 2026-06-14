# Account System & Supabase Integration — Implementation Plan

Integrate Supabase authentication, cloud storage, feedback, and telemetry into the existing Isomorph Vite+React app. CRDT collaboration (Yjs) is documented but deferred to a later phase.

## User Review Required

> [!IMPORTANT]
> **This plan implements Phase A only** (auth, cloud saves, feedback, telemetry, settings). CRDT collaboration (Yjs, cursors, real-time editing) is a separate, larger effort that depends on having the account system in place first. Should I also plan Phase B (collaboration) now, or defer it until Phase A is stable?

> [!WARNING]
> **GitHub Pages + Supabase**: The anon key is safe to expose in the client bundle. However, the y-websocket server for Phase B will need a separate server (your PC/VPS). This plan does NOT require a y-websocket server — that's Phase B only.

> [!IMPORTANT]
> **Supabase project required**: Before I can write the actual Supabase client configuration, you need to create a Supabase project at [supabase.com](https://supabase.com) and share the project URL + anon key. For now, I'll scaffold everything with placeholder env vars (`import.meta.env.VITE_SUPABASE_URL`).

## Open Questions

1. **Should I create the SQL migration file for Supabase?** I can generate the full SQL (CREATE TABLE, RLS policies, triggers) as a `.sql` file you paste into the Supabase SQL editor. Yes/No?

2. **Feedback button location**: The i18n has `ui.feedback_coming_soon` and `ui.login_coming_soon` strings. Where exactly are these placeholder buttons in the UI? I found them in i18n but couldn't locate the actual buttons in App.tsx — are they in a toolbar section I should search more carefully, or do they need to be created from scratch?

---

## Proposed Changes

### Phase A: Auth, Cloud Saves, Feedback, Telemetry, Settings

This phase covers everything that does NOT require a CRDT server.

---

### A1. Supabase Client Setup

#### [NEW] `src/lib/supabase.ts`
- Initialize Supabase client with `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`
- Export typed client instance
- Export auth helper functions: `signUp()`, `signIn()`, `signOut()`, `resetPassword()`, `getSession()`
- All auth functions use the OSINT-safe pattern (never reveal if email exists)

#### [NEW] `.env.example`
- Document required environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WS_URL` (for future)

#### [MODIFY] `vite.config.ts`
- Ensure `import.meta.env` variables are typed (add `env.d.ts`)

#### [NEW] `src/env.d.ts`
- TypeScript declarations for `ImportMetaEnv` with Supabase variables

---

### A2. Auth State & Context

#### [NEW] `src/lib/auth-context.tsx`
- React Context + Provider for auth state
- `useAuth()` hook: returns `{ user, session, loading, signIn, signUp, signOut, isAuthenticated }`
- Listens to `supabase.auth.onAuthStateChange()` for reactive session updates
- Wraps the app in `<AuthProvider>` in `main.tsx`

#### [MODIFY] `src/main.tsx`
- Wrap `<App />` with `<AuthProvider>`

---

### A3. Auth UI (Login / Register / Reset Password)

#### [NEW] `src/components/AuthModal.tsx`
- Tabbed modal: Login | Register | Reset Password
- Login: email + password fields, submit button
- Register: email + password + display name, submit → "Check your email" message
- Reset Password: email field → always says "If an account exists, we sent a reset email"
- Error handling: generic "Something went wrong" on all errors (OSINT protection)
- Styled with existing `iso-modal` classes
- i18n compatible (EN/RO/RU strings added)
- Escape to close, click-outside to close

#### [MODIFY] `src/App.tsx`
- Replace the Login "coming soon" tooltip with actual AuthModal trigger
- Show user avatar/name in toolbar when logged in (replaces Login button)
- Add logout option in user dropdown or settings

#### [MODIFY] `src/i18n.ts`
- Add auth-related strings for all 3 languages: login, register, reset password, check email, generic errors, etc.

---

### A4. Profile Management

#### [NEW] `src/lib/profile.ts`
- CRUD functions for the `profiles` table
- `getProfile(userId)`, `updateProfile(userId, data)`, `uploadAvatar(userId, file)`
- Avatar upload → Supabase Storage `avatars` bucket

#### [MODIFY] `src/App.tsx` — Settings → Profile tab
- Wire the existing disabled placeholder fields to actual profile data
- Display name, username, email (read-only from auth), avatar upload
- Save changes → `updateProfile()`
- Profile picture: click to upload, preview, save to bucket

---

### A5. Project & Diagram CRUD (Cloud Saves)

#### [NEW] `src/lib/projects.ts`
- CRUD for `projects` table: `createProject()`, `getMyProjects()`, `getSharedProjects()`, `updateProject()`, `deleteProject()`
- CRUD for `diagrams` table: `createDiagram()`, `getDiagrams(projectId)`, `updateDiagram()`, `deleteDiagram()`
- Save checkpoint: `saveDiagramVersion()` → inserts into `diagram_versions`, prunes old versions based on tier
- Tier limit enforcement: check project count, diagram count before create

#### [MODIFY] `src/App.tsx` — Library modal
- Wire "My Works" to fetch from `projects` table
- Wire "Shared Works" to fetch from `project_access` join
- Add search bar (client-side filter)
- Project cards: show name, diagram count, last accessed, thumbnail
- Click project → load diagrams into tabs
- Ctrl+S → save current diagram to cloud (if logged in)

#### [MODIFY] `src/App.tsx` — Save flow
- Ctrl+S behavior: if logged in + project is cloud-saved → save to Supabase + create version checkpoint
- If not logged in → existing local download behavior
- Show save status indicator in status bar

---

### A6. Feedback System

#### [NEW] `src/components/FeedbackModal.tsx`
- Modal with: category dropdown (bug/feature/UI/general), subject field, body textarea
- Auto-captures: current URL, user agent, app version
- Only enabled for authenticated users
- Submit → insert into `feedback` table
- Success toast: "Thank you for your feedback!"

#### [MODIFY] `src/App.tsx`
- Wire the existing Feedback button to open FeedbackModal
- If not logged in → tooltip "Log in to leave feedback"

#### [MODIFY] `src/i18n.ts`
- Add feedback strings for all 3 languages

---

### A7. Telemetry

#### [NEW] `src/lib/telemetry.ts`
- `trackEvent(type, data)` function
- Checks `profile.telemetry_enabled` before sending
- Batches events and sends periodically (every 30s or on page unload)
- No PII in event data

#### [MODIFY] `src/App.tsx` — Settings → App tab
- Add telemetry toggle checkbox below existing settings
- Wired to `profiles.telemetry_enabled`

#### [MODIFY] `src/i18n.ts`
- Add telemetry toggle strings

---

### A8. Settings Page Enhancement

#### [MODIFY] `src/App.tsx` — Settings modal
- **Profile tab**: Wire to real profile data (A4)
- **Collaboration tab**: Replace "coming soon" with cursor colour picker (8 colours), display name for collaboration, cursor visibility toggles (preview-only until Phase B)
- **Storage tab**: Show cloud project count vs. tier limit, storage usage bar
- **App tab**: Add telemetry toggle (A7)

---

### A9. SQL Migrations

#### [NEW] `supabase/migrations/001_initial_schema.sql`
- All CREATE TABLE statements from accounts.md DBML
- All enum types
- RLS policies for every table
- Triggers: auto-create profile on auth.users insert, auto-update timestamps
- Indexes for performance

---

### A10. Phase B Plan (CRDT, Cursors, Real-time)

#### [NEW] `src/lib/collaboration.ts`
- Implement Yjs setup: `new Y.Doc()`
- Set up `y-websocket` provider to connect to a custom Node.js server (e.g. `ws://localhost:1234` or a deployed WebSocket server).
- Sync the `WorkspaceTab.source` text using `Y.Text`. Let Codemirror (`IsomorphEditor.tsx`) bind to this `Y.Text` using `y-codemirror.next`.
- Expose awareness protocol (cursors) via `provider.awareness`.

#### [MODIFY] `src/components/IsomorphEditor.tsx`
- Integrate `y-codemirror.next` binding.
- Display remote user cursors using awareness state (mapping user profiles to cursor colors).

#### [MODIFY] `src/components/DiagramView.tsx`
- Sync visual cursor positions of users over the SVG canvas.
- Send local cursor position on mousemove to awareness protocol.
- Render `<IconPointer />` components with names for remote users.

#### [NEW] `server/websocket.js` (Optional standalone server)
- A standalone `y-websocket` server for production, since Supabase Realtime might be too expensive/slow for high-frequency cursor/text syncing (though Supabase *does* support Yjs via Realtime, we'll evaluate if `y-websocket` is better for cost).

---

## Verification Plan

### Automated Tests
- Unit tests for auth helper functions (mock Supabase client)
- Unit tests for project/diagram CRUD functions
- Unit tests for tier limit enforcement logic

### Manual Verification
1. Register new account → check email → verify → login works
2. Login → profile tab shows real data → edit display name → saves
3. Upload profile picture → appears in settings and toolbar
4. Create project → add diagrams → Ctrl+S → version saved
5. Library → shows projects → search works → open project loads diagrams
6. Share project → other user sees it in "Shared Works"
7. Feedback modal → submit → check Supabase table
8. Telemetry toggle → disable → no events sent
9. Logout → app falls back to local-only mode gracefully
10. Build succeeds with env vars → deploy to GitHub Pages

### Build Verification
```bash
npm run typecheck
npm run build
npm run test
```
