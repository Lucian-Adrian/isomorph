# Isomorph — Accounts, Collaboration & Backend Design

> **Status**: Design Phase — No code yet  
> **Last updated**: 2026-06-12  
> **Author(s)**: Team

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Authentication & Account System](#2-authentication--account-system)
3. [Database Schema (DBML)](#3-database-schema-dbml)
4. [Collaboration & Real-Time](#4-collaboration--real-time)
5. [Cursor Presence System](#5-cursor-presence-system)
6. [Access Control & Sharing](#6-access-control--sharing)
7. [Feedback System](#7-feedback-system)
8. [Telemetry](#8-telemetry)
9. [Storage & Media](#9-storage--media)
10. [User Tiers & Monetization](#10-user-tiers--monetization)
11. [Settings Page — Collaboration Tab](#11-settings-page--collaboration-tab)
12. [Security Considerations](#12-security-considerations)
13. [Technology Decision Record](#13-technology-decision-record)
14. [Deployment & Secrets](#14-deployment--secrets)
15. [Open Questions](#15-open-questions)


---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
│  Isomorph Web App (Vite + React)                                │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │CodeMirror│  │ Canvas/SVG   │  │ Settings / Auth Modals     │ │
│  │  + CRDT  │  │ + Cursors    │  │                            │ │
│  └────┬─────┘  └──────┬───────┘  └──────────┬─────────────────┘ │
│       │               │                      │                   │
│       └───────────┬───┘──────────────────────┘                   │
│                   │                                              │
│            Yjs Document                                          │
│            (shared state)                                        │
└──────────────┬───────────────────────────────────────────────────┘
               │  WebSocket (y-websocket / y-partykit / HocusPocus)
               │
┌──────────────▼───────────────────────────────────────────────────┐
│               COLLABORATION SERVER                               │
│  ┌─────────────────┐  ┌──────────────────────┐                   │
│  │ CRDT Sync Layer │  │ Presence / Awareness │                   │
│  │ (Yjs provider)  │  │ (cursor, selection,  │                   │
│  │                 │  │  colour, name)       │                   │
│  └────────┬────────┘  └──────────┬───────────┘                   │
│           │                      │                               │
│           └──────────┬───────────┘                               │
│                      │                                           │
│              ┌───────▼────────┐                                  │
│              │  Persistence   │  (snapshot Y.Doc to DB on save)  │
│              └───────┬────────┘                                  │
└──────────────────────┼───────────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────────┐
│                      SUPABASE                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  PostgreSQL  │  │   Auth       │  │   Storage (Buckets)    │ │
│  │  (RLS)       │  │   (GoTrue)   │  │   - profile-pictures   │ │
│  │  - users     │  │   - Email    │  │                        │ │
│  │  - projects  │  │   - OAuth    │  └────────────────────────┘ │
│  │  - access    │  │   - Magic    │                              │
│  │  - feedback  │  │     Link     │  ┌────────────────────────┐ │
│  │  - telemetry │  │              │  │   Realtime             │ │
│  │              │  │              │  │   (Broadcast/Presence) │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Why Supabase + External CRDT Server?

Supabase provides excellent auth, PostgreSQL with RLS, storage buckets, and basic Realtime channels. However, its Realtime Broadcast is **not** a CRDT sync engine — it only relays messages. For true multi-user conflict-free editing of both CodeMirror text and canvas state, we need a dedicated **Yjs** provider server (e.g. `y-websocket`, PartyKit, or HocusPocus) that:

- Maintains the authoritative Yjs document state
- Merges concurrent edits via CRDT semantics
- Broadcasts awareness (cursor positions, selections, user identity)
- Periodically snapshots the Yjs binary state to Supabase PostgreSQL

Supabase Realtime channels **can** be used as a lightweight transport for cursor broadcast if we want to avoid running a separate presence server, but the CRDT document sync must go through a Yjs-aware server.

---

## 2. Authentication & Account System

### 2.1 Registration Flow

```
User enters email + password
        │
        ▼
Supabase Auth  →  Always responds "Check your email"
        │            (NEVER reveals if email exists — OSINT protection)
        │
        ├── Email NOT registered → sends confirmation email with verify link
        │
        └── Email ALREADY registered → sends password reset link instead
                                        (privacy + UX achieved)
```

> **Critical Privacy Rule (from features.md #6)**:  
> Do NOT give warnings like "this email already exists". This allows OSINT attacks.  
> Instead, **always** send an email. If the account exists, send a password reset link.  
> On error, show the generic: *"Something went wrong. Try again later."*

### 2.2 Email Verification

- Email sent via Supabase GoTrue on registration
- User clicks verification link → account activated
- Until verified: account exists but is in `unverified` state
- Unverified users cannot save to cloud, share, or leave feedback
- Re-send verification email button available on login page

### 2.3 Authentication Methods

| Method | Priority | Notes |
|--------|----------|-------|
| Email + Password | P0 — MVP | Standard flow with email verification |
| Magic Link (email) | P1 | Passwordless login via emailed link |
| Google OAuth | P2 | Social login for convenience |
| GitHub OAuth | P2 | Developer-friendly alternative |

### 2.4 Session Management

- Supabase manages JWT tokens
- Short-lived access token (1 hour) + long-lived refresh token (30 days)
- On app load: check `supabase.auth.getSession()` → hydrate UI
- On token expiry: auto-refresh via Supabase client
- Log out: clear session, fall back to local-only mode

### 2.5 Profile Data

| Field | Source | Editable | Notes |
|-------|--------|----------|-------|
| `id` (UUID) | Supabase Auth | No | Primary key |
| `email` | Supabase Auth | Via re-auth flow | Must re-verify on change |
| `display_name` | `profiles` table | Yes | Shown in collaboration |
| `username` | `profiles` table | Yes (unique) | URL slug, @mentions |
| `avatar_url` | Supabase Storage | Yes | Profile picture in `avatars` bucket |
| `cursor_colour` | `profiles` table | Yes | 1 of 8 predefined colours |
| `tier` | `profiles` table | No (admin) | basic / power / enterprise |
| `email_verified` | Supabase Auth | No | Auto-set on verify |
| `telemetry_enabled` | `profiles` table | Yes | Default: true |

---

## 3. Database Schema (DBML)

### 3.1 Core Schema

```dbml
// ============================================================
// ISOMORPH DATABASE SCHEMA
// Backend: Supabase (PostgreSQL + GoTrue Auth + Storage)
// ============================================================

// ──────────────────── ENUMS ─────────────────────────────────

Enum access_role {
  owner
  editor
  commenter
  viewer
}

Enum share_link_role {
  viewer
  commenter
}

Enum project_visibility {
  private
  public
  unlisted
}

Enum user_tier {
  basic
  power
  enterprise
}

Enum feedback_category {
  bug
  feature_request
  general
  ui_ux
}

Enum cursor_colour {
  red
  green
  blue
  yellow
  white
  black
  pink
  orange
}

Enum telemetry_event_type {
  diagram_created
  diagram_exported
  diagram_shared
  session_started
  session_ended
  feature_used
  error_encountered
}

// ──────────────────── PROFILES ──────────────────────────────

Table profiles {
  id            uuid [pk, ref: - auth.users.id, note: 'Mirrors Supabase auth.users.id']
  display_name  varchar(100)
  username      varchar(40) [unique, not null, note: 'URL-safe, lowercase, unique slug']
  avatar_url    text [note: 'Supabase Storage signed URL']
  cursor_colour cursor_colour [default: 'blue']
  tier          user_tier [default: 'basic']
  telemetry_enabled boolean [default: true]
  created_at    timestamptz [default: `now()`]
  updated_at    timestamptz [default: `now()`]

  Note: '''
    Extended profile data.
    Created via trigger on auth.users insert.
    RLS: users can read any profile, update only their own.
  '''
}

// ──────────────────── PROJECTS (folder-like containers) ─────

Table projects {
  id            uuid [pk, default: `gen_random_uuid()`]
  owner_id      uuid [not null, ref: > profiles.id]
  name          varchar(255) [not null]
  description   text
  visibility    project_visibility [default: 'private']
  thumbnail_svg text [note: 'Auto-generated SVG preview from first diagram']
  created_at    timestamptz [default: `now()`]
  updated_at    timestamptz [default: `now()`]
  last_accessed_at timestamptz [default: `now()`]

  Note: '''
    A project is a folder-like container that holds multiple diagrams.
    Think of it like a workspace/folder — users organize related
    diagrams into a single project.
    
    Diagram limits per tier:
    - basic:      4 diagrams per project,   5 projects total
    - power:     20 diagrams per project,  25 projects total
    - enterprise: 100 diagrams per project, 100 projects total
    
    RLS:
    - Owner: full CRUD
    - Editor: read + update
    - Commenter: read
    - Viewer: read
    - Public/unlisted projects: anyone can read
  '''
}

// ──────────────────── DIAGRAMS (inside projects) ────────────

Table diagrams {
  id            uuid [pk, default: `gen_random_uuid()`]
  project_id    uuid [not null, ref: > projects.id]
  name          varchar(255) [not null]
  kind          varchar(50) [not null, note: 'class, sequence, usecase, component, state, activity, deployment, collaboration, flow']
  source_code   text [not null, note: 'The .isx source text for this diagram']
  yjs_state     bytea [note: 'Binary Yjs document snapshot for CRDT resume']
  sort_order    integer [default: 0, note: 'Order within the project']
  created_at    timestamptz [default: `now()`]
  updated_at    timestamptz [default: `now()`]

  indexes {
    (project_id, name) [unique, note: 'Unique diagram name within a project']
  }

  Note: '''
    Each diagram is one .isx source file within a project.
    The source_code is the canonical text.
    yjs_state is the binary Yjs Y.Doc snapshot for resuming
    CRDT sessions per-diagram.
    
    RLS: inherits from parent project via project_id.
  '''
}

// ──────────────────── ACCESS CONTROL ────────────────────────

Table project_access {
  id            uuid [pk, default: `gen_random_uuid()`]
  project_id    uuid [not null, ref: > projects.id]
  user_id       uuid [not null, ref: > profiles.id]
  role          access_role [not null, default: 'viewer']
  granted_by    uuid [ref: > profiles.id, note: 'Who gave this access']
  granted_at    timestamptz [default: `now()`]

  indexes {
    (project_id, user_id) [unique, note: 'One role per user per project']
  }

  Note: '''
    Explicit per-user access grants.
    The owner is NOT stored here — ownership is on projects.owner_id.
    RLS:
    - Owner can CRUD all access rows for their projects
    - Granted users can read their own row
  '''
}

Table share_links {
  id            uuid [pk, default: `gen_random_uuid()`]
  project_id    uuid [not null, ref: > projects.id]
  token         varchar(64) [unique, not null, note: 'Cryptographically random URL token']
  role          share_link_role [not null, default: 'viewer']
  expires_at    timestamptz [note: 'NULL = never expires']
  max_uses      integer [note: 'NULL = unlimited']
  use_count     integer [default: 0]
  is_active     boolean [default: true]
  created_by    uuid [not null, ref: > profiles.id]
  created_at    timestamptz [default: `now()`]

  Note: '''
    Shareable link tokens.
    Anyone with the link can access the project at the specified role.
    Unauthenticated users accessing via share link become anonymous
    viewers or commenters (displayed as "Viewer 1", "Commenter 2", etc.)
    
    RLS:
    - Owner/editors can create and manage share links
    - Token lookup is done via a server function (not direct RLS)
  '''
}

// ──────────────────── ANONYMOUS SESSIONS ────────────────────

Table anonymous_sessions {
  id            uuid [pk, default: `gen_random_uuid()`]
  project_id    uuid [not null, ref: > projects.id]
  share_link_id uuid [not null, ref: > share_links.id]
  session_token varchar(128) [unique, not null, note: 'Stored in localStorage']
  display_name  varchar(50) [not null, note: 'e.g. "Viewer 1", "Commenter 3"']
  role          share_link_role [not null]
  cursor_colour cursor_colour [note: 'Auto-assigned from available colours']
  created_at    timestamptz [default: `now()`]
  last_seen_at  timestamptz [default: `now()`]
  expires_at    timestamptz [not null, note: 'Auto-expire after 24h of inactivity']

  Note: '''
    Tracks anonymous users who access via share links.
    They get auto-assigned names like "Viewer 1", "Commenter 2".
    Session persisted in browser localStorage so refreshing
    doesn't create a new identity.
    Cleaned up by a scheduled job after expiry.
  '''
}

// ──────────────────── COMMENTS ──────────────────────────────

Table comments {
  id            uuid [pk, default: `gen_random_uuid()`]
  project_id    uuid [not null, ref: > projects.id]
  user_id       uuid [ref: > profiles.id, note: 'NULL for anonymous commenters']
  anon_session_id uuid [ref: > anonymous_sessions.id, note: 'Set for anonymous commenters']
  diagram_name  varchar(255) [note: 'Which diagram in the project']
  entity_name   varchar(255) [note: 'Which entity the comment is anchored to (optional)']
  x_position    float [note: 'Canvas X coordinate for positioned comments']
  y_position    float [note: 'Canvas Y coordinate for positioned comments']
  body          text [not null]
  resolved      boolean [default: false]
  parent_id     uuid [ref: > comments.id, note: 'For threaded replies']
  created_at    timestamptz [default: `now()`]
  updated_at    timestamptz [default: `now()`]

  Note: '''
    Comments can be:
    - Anchored to a specific entity (entity_name set)
    - Positioned on canvas (x_position, y_position set)
    - General project-level (neither set)
    
    Threaded via parent_id.
    Anonymous commenters reference anon_session_id.
    
    RLS:
    - Commenter+ can create
    - Author can edit/delete own
    - Owner can delete any, resolve any
  '''
}

// ──────────────────── FEEDBACK ──────────────────────────────

Table feedback {
  id            uuid [pk, default: `gen_random_uuid()`]
  user_id       uuid [not null, ref: > profiles.id, note: 'Only logged-in users can submit']
  category      feedback_category [not null, default: 'general']
  subject       varchar(255)
  body          text [not null]
  page_url      text [note: 'Where the user was when submitting']
  user_agent    text [note: 'Browser info for bug reports']
  app_version   varchar(20) [note: 'Isomorph version string']
  created_at    timestamptz [default: `now()`]

  Note: '''
    Feedback/bug reports — authenticated users only.
    The existing placeholder feedback buttons in the UI
    will be wired to submit into this table.
    
    RLS:
    - Authenticated users can insert
    - Users can read their own feedback
    - Admin can read all
  '''
}

// ──────────────────── TELEMETRY ─────────────────────────────

Table telemetry_events {
  id            uuid [pk, default: `gen_random_uuid()`]
  user_id       uuid [ref: > profiles.id, note: 'NULL for anonymous/opted-out']
  session_id    varchar(64) [note: 'Client-generated session ID']
  event_type    telemetry_event_type [not null]
  event_data    jsonb [note: 'Flexible payload per event type']
  page_url      text
  created_at    timestamptz [default: `now()`]

  Note: '''
    Opt-in telemetry. Only collected when profiles.telemetry_enabled = true.
    Settings page has a toggle: "Deactivate telemetry".
    
    No PII is stored in event_data — only aggregate metrics like
    diagram type, export format, feature name.
    
    RLS:
    - Insert only (no user reads)
    - Admin dashboard reads
  '''
}

// ──────────────────── DIAGRAM VERSION HISTORY (Ctrl+S saves) ─

Table diagram_versions {
  id            uuid [pk, default: `gen_random_uuid()`]
  diagram_id    uuid [not null, ref: > diagrams.id]
  version       integer [not null]
  source_code   text [not null]
  saved_by      uuid [ref: > profiles.id]
  message       varchar(500) [note: 'Optional commit-like message']
  created_at    timestamptz [default: `now()`]

  indexes {
    (diagram_id, version) [unique]
  }

  Note: '''
    Explicit save checkpoints (Ctrl+S) — NOT undo/redo.
    Undo/redo (Ctrl+Z / Ctrl+Y) is unlimited and purely client-side.
    These are persistent "commit" snapshots for version history.
    
    Limits by tier:
    - basic:      10 saves (versions) per diagram
    - power:      50 saves per diagram
    - enterprise: unlimited saves
    
    When limit is reached, oldest version is pruned on next save.
  '''
}

// ──────────────────── NOTIFICATIONS ─────────────────────────

Table notifications {
  id            uuid [pk, default: `gen_random_uuid()`]
  user_id       uuid [not null, ref: > profiles.id]
  type          varchar(50) [not null, note: 'comment_added, access_granted, project_shared, etc.']
  title         varchar(255) [not null]
  body          text
  link          text [note: 'Deep link to relevant page/project']
  read          boolean [default: false]
  created_at    timestamptz [default: `now()`]

  Note: '''
    In-app notifications.
    Delivered via Supabase Realtime subscriptions.
    
    Types:
    - comment_added: someone commented on your project
    - access_granted: you were given access to a project
    - project_shared: your project was shared
    - mention: you were @mentioned in a comment
  '''
}
```

### 3.2 Schema Diagram (ER)

```
profiles ─────────────< project_access >──────────── projects
    │                                                   │
    │                                                   │
    ├───────────< feedback                              ├──< diagrams
    │                                                   │       │
    ├───────────< telemetry_events                      │       ├──< diagram_versions
    │                                                   │       │
    ├───────────< notifications                         │       └── (source_code, yjs_state)
    │                                                   │
    ├───────────< share_links >─────────────────────────┘
    │                   │                                
    │                   └────────< anonymous_sessions     
    │                                     │               
    │                                     │               
    └───────────< comments <──────────────┘───────────────
                    │
                    └── comments (self-ref: parent_id for threads)
```

---

## 4. Collaboration & Real-Time

### 4.1 CRDT Strategy — Yjs

**Why Yjs?**

| Criteria | Yjs | Automerge | ShareDB |
|----------|-----|-----------|---------|
| CodeMirror binding | ✅ `y-codemirror.next` | ❌ no native | ❌ OT only |
| Bundle size | ~15KB | ~300KB | ~50KB |
| Conflict resolution | CRDT (no conflicts) | CRDT | OT (needs server) |
| Awareness protocol | ✅ built-in | ❌ custom | ❌ custom |
| Offline support | ✅ | ✅ | ❌ |
| Max concurrency | Tested to 100+ | Similar | Similar |

**Yjs fits perfectly** because:
1. **`y-codemirror.next`** gives us native CodeMirror 6 ↔ Yjs binding out of the box
2. Yjs Awareness protocol handles cursor presence (position, selection, colour, name) natively
3. 8-person concurrency is well within Yjs's capabilities (tested to 100+)
4. Offline editing → changes merge cleanly when reconnected

### 4.2 Document Model

```
Y.Doc (one per project session)
├── Y.Text "source"          ← CodeMirror text (bound via y-codemirror.next)
├── Y.Map  "canvas_state"    ← Entity positions, zoom, pan offset
│   ├── "entities"  → Y.Map  { [entity_name]: { x, y, w, h } }
│   └── "viewport"  → Y.Map  { zoom, panX, panY }  (per-user, not synced)
└── Awareness
    ├── user.name
    ├── user.colour
    ├── user.cursor   { source_pos, source_anchor }   ← CodeMirror cursor
    └── user.canvas   { x, y, tool, selection }        ← Canvas cursor
```

### 4.3 Sync Server Options

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **y-websocket** (self-hosted) | Simple, official Yjs server | Need to host | ✅ MVP |
| **PartyKit** | Serverless, edge-deployed | Vendor lock-in, cost | Consider later |
| **HocusPocus** | Auth hooks, persistence hooks, webhooks | Heavier setup | ✅ Production |
| **Supabase Realtime** as transport | No extra server | Not CRDT-aware, no merge | ❌ Not suitable for doc sync |

**Recommendation**: Start with `y-websocket` for MVP. Migrate to HocusPocus for production (it has built-in auth, persistence hooks to write Yjs state to Supabase, and webhook support for notifications).

### 4.4 Concurrency Limit

- **Hard cap: 8 concurrent users per project**
- Enforced on the WebSocket server: reject connection #9 with a clear error
- UI shows "Room full (8/8)" when limit reached
- The 8-person limit is a product decision, not a technical limitation

### 4.5 Session Flow

```
1. User opens project URL (or creates new)
2. Client checks auth → determines role (owner/editor/commenter/viewer/anon)
3. Client connects to CRDT WebSocket server with:
   - project_id
   - auth token (or share_link token for anon)
   - role
4. Server authenticates, checks concurrency limit
5. Server loads or creates Y.Doc for this project
   - If Y.Doc exists in memory (other users active): join existing
   - If not: load yjs_state from Supabase PostgreSQL → initialize Y.Doc
6. Client syncs via Yjs protocol
7. Client binds Y.Text to CodeMirror (editors only)
8. Client subscribes to Awareness for cursor presence
9. On disconnect / idle timeout: server snapshots Y.Doc → saves to Supabase
```

---

## 5. Cursor Presence System

### 5.1 Cursor Design

Each collaborator's cursor on the canvas is rendered as:

```
          ╲
           ╲        ← Arrow pointer (angled)
            ╲
             ●      ← Filled circle with the user's colour
            ╱       
           ╱
          ╱
    ·  · ·          ← Small particle trail (3-5 fading dots)
    
    ┌─────────┐
    │ Alice   │     ← Name label (rounded, semi-transparent bg)
    └─────────┘
```

- **Arrow**: A sleek triangular pointer (like a mouse cursor) rotated ~30°
- **Circle**: 12px filled circle in the user's chosen colour (center of the arrow tip)
- **Particle trail**: 3-5 small circles that follow the cursor with decreasing opacity and size, creating a comet-like trail effect. Particles are emitted on movement, decay after ~300ms
- **Name label**: Small rounded-rect badge below the cursor showing display_name, with the cursor colour as background (at ~70% opacity) and white text

### 5.2 Cursor Colours

8 predefined cursor colours (chosen in Settings → Collaboration):

| Colour | Hex | CSS Variable |
|--------|-----|-------------|
| 🔴 Red | `#EF4444` | `--iso-cursor-red` |
| 🟢 Green | `#22C55E` | `--iso-cursor-green` |
| 🔵 Blue | `#3B82F6` | `--iso-cursor-blue` |
| 🟡 Yellow | `#EAB308` | `--iso-cursor-yellow` |
| ⚪ White | `#F8FAFC` | `--iso-cursor-white` |
| ⚫ Black | `#1E293B` | `--iso-cursor-black` |
| 🩷 Pink | `#EC4899` | `--iso-cursor-pink` |
| 🟠 Orange | `#F97316` | `--iso-cursor-orange` |

- Each user picks one colour permanently in their profile (Settings → Collaboration)
- If two users in the same session have the same colour, append a subtle glow or pattern difference
- Anonymous users get auto-assigned from the pool of unused colours
- Default colour for new accounts: Blue

### 5.3 Cursor Data (via Yjs Awareness)

```typescript
interface AwarenessState {
  user: {
    id: string;            // UUID or anon session ID
    name: string;          // Display name or "Viewer 1"
    colour: CursorColour;  // One of the 8 colours
    role: AccessRole;      // owner | editor | commenter | viewer
  };
  // CodeMirror cursor (synced via y-codemirror.next automatically)
  cursor?: {
    anchor: number;        // Absolute position in text
    head: number;          // Selection head
  };
  // Canvas cursor (custom, we sync this ourselves)
  canvas?: {
    x: number;             // Canvas-space X
    y: number;             // Canvas-space Y
    visible: boolean;      // Is cursor over the canvas?
    tool: 'select' | 'pan' | 'draw';  // Current tool
    selection?: string[];  // Entity names currently selected
  };
}
```

### 5.4 Canvas Cursor Sync

- **Broadcast rate**: Throttle to ~30fps (every ~33ms) while mouse is moving
- **Interpolation**: Client-side lerp for smooth remote cursor movement (reduces jitter)
- **Visibility**: Hide cursor when user's mouse leaves the canvas, or when idle > 5 seconds (show a small "idle" indicator instead)
- **Viewer/Commenter cursors**: Visible to all, but they cannot modify the canvas

---

## 6. Access Control & Sharing

### 6.1 Role Matrix

| Capability | Owner | Editor | Commenter | Viewer | Anonymous Viewer | Anonymous Commenter |
|-----------|-------|--------|-----------|--------|-----------------|-------------------|
| View project | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit source code | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Move canvas entities | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Add comments | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Resolve comments | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Export diagrams | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage access | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create share links | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete project | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| See other cursors | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Version history | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Leave feedback (app) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

### 6.2 Sharing Flow

```
Owner clicks "Share" button
        │
        ├── "Invite by email/username"
        │       │
        │       ▼
        │   Search users → select role (editor/commenter/viewer) → send invite
        │   Creates project_access row + notification
        │
        └── "Create share link"
                │
                ▼
            Select role (viewer or commenter only)
            Set expiry (optional)
            Set max uses (optional)
            Generate link → copy to clipboard
            
            Link format: https://isomorph.app/s/{token}
            
            When someone opens the link:
            ├── Logged in → project_access row created with link's role
            └── Not logged in → anonymous_sessions row created
                  Auto-assigned name: "Viewer 1", "Commenter 2" etc
                  (sequential per project, based on count)
```

### 6.3 Anonymous User Naming

- Pattern: `{Role} {N}` where N is auto-incremented per project
- Examples: "Viewer 1", "Viewer 2", "Commenter 1", "Commenter 3"
- The number is based on the `anonymous_sessions` count for that project + role
- Stored in `anonymous_sessions.display_name`
- Persisted via `session_token` in localStorage so refreshes keep the same name
- Sessions expire after 24h of inactivity (cleaned up by cron job)

---

## 7. Feedback System

### 7.1 Requirements

- **Only logged-in (verified) users can submit feedback**
- The existing placeholder feedback buttons in the UI will connect to this
- Simple form: category + subject + body
- Auto-capture: page URL, user agent, app version

### 7.2 UI Flow

```
User clicks Feedback button (existing in toolbar)
        │
        ├── Not logged in → show tooltip "Log in to leave feedback"
        │
        └── Logged in → open Feedback modal:
                ┌─────────────────────────────────┐
                │  📝 Send Feedback                │
                │                                  │
                │  Category: [Bug ▼]               │
                │  Subject:  [________________]    │
                │  Details:  [                ]    │
                │            [                ]    │
                │            [________________]    │
                │                                  │
                │         [Cancel]  [Submit]        │
                └─────────────────────────────────┘
        
        On submit → insert into feedback table
        Show toast: "Thank you for your feedback!"
```

### 7.3 Categories

- 🐛 **Bug** — Something broken or unexpected
- 💡 **Feature Request** — New feature suggestion
- 🎨 **UI/UX** — Visual or interaction improvement
- 💬 **General** — Anything else

---

## 8. Telemetry

### 8.1 Requirements

- **Opt-in by default** (telemetry enabled on new accounts)
- Settings page has a toggle: **"Deactivate telemetry"** (under App Settings)
- When deactivated: no telemetry events are sent, `profiles.telemetry_enabled = false`
- **No PII collected** — only aggregate, anonymous usage metrics
- Anonymous / not-logged-in users: no telemetry at all

### 8.2 Events Collected

| Event | Payload | Purpose |
|-------|---------|---------|
| `session_started` | `{ duration_bucket }` | DAU/MAU metrics |
| `session_ended` | `{ duration_seconds }` | Session length |
| `diagram_created` | `{ kind }` | Popular diagram types |
| `diagram_exported` | `{ format, kind }` | Export usage |
| `diagram_shared` | `{ role, method }` | Sharing patterns |
| `feature_used` | `{ feature_name }` | Feature adoption |
| `error_encountered` | `{ error_code, context }` | Error frequency |

### 8.3 Settings UI

In Settings → App Settings, add a new toggle:

```
☑ Enable Telemetry
  Help us improve Isomorph by sending anonymous usage data.
  No personal information is collected.
  
  [Learn more →]
```

When unchecked:
- Sets `profiles.telemetry_enabled = false`
- Client stops sending telemetry events immediately
- Existing data is NOT retroactively deleted (but this could be a future feature)

---

## 9. Storage & Media

### 9.1 What We Store

| Data | Storage | Notes |
|------|---------|-------|
| Diagram source code | PostgreSQL `projects.source_code` | Text column, no size limit concern for diagrams |
| Yjs CRDT state | PostgreSQL `projects.yjs_state` | Binary (bytea), ~10-100KB per project |
| Profile pictures | Supabase Storage `avatars` bucket | Max 2MB, jpeg/png/webp, auto-resized |
| SVG thumbnails | PostgreSQL `projects.thumbnail_svg` | Generated server-side, ~5-20KB |

### 9.2 What We Do NOT Store

- ❌ No diagram images (PNG/SVG exports) — generated client-side, downloaded directly
- ❌ No video files — animations are rendered client-side
- ❌ No uploaded images within diagrams — diagrams are text/SVG only
- ❌ No chat messages — integrated chat was explicitly removed from roadmap

### 9.3 Profile Picture Bucket

```
Bucket: avatars
Path: {user_id}/avatar.{ext}
Max size: 2MB
Allowed MIME: image/jpeg, image/png, image/webp
RLS: Users can upload/update/delete their own. Anyone can read (public bucket).
Transform: Supabase Image Transformations → 128x128 for display, 256x256 stored
```

---

## 10. User Tiers & Monetization

> Note: From ROADMAP.md — three tiers: basic, power, enterprise. Pricing TBD.

### 10.1 Tier Feature Matrix

| Feature | Basic (Free) | Power (Paid) | Enterprise |
|---------|-------------|--------------|------------|
| Local diagrams (no account) | Unlimited | Unlimited | Unlimited |
| Cloud projects | **5** | **25** | **100** |
| Diagrams per project | **4** | **20** | **100** |
| Concurrent **editors** per project | **2** | **4** | **8** |
| Concurrent **viewers** | **Unlimited** | **Unlimited** | **Unlimited** |
| Save checkpoints per diagram (Ctrl+S) | **10** | **50** | **Unlimited** |
| Undo/Redo (Ctrl+Z / Ctrl+Y) | Unlimited (client-side) | Unlimited | Unlimited |
| Export formats | PNG, SVG | PNG, SVG, GIF, WebM | All + PDF |
| Share links | Viewer only | Viewer + Commenter | All roles |
| Custom cursor colour | ✅ | ✅ | ✅ |
| Telemetry toggle | ✅ | ✅ | ✅ |
| Animation features | Basic | Full | Full |
| Watermark | Always on | Toggleable | Off by default |
| Priority support | ❌ | Email | Dedicated |
| Google Drive / OneDrive | ❌ | ❌ | ✅ (future) |
| SSO / SAML | ❌ | ❌ | ✅ (future) |

> **Important distinction**: Collaborator limits apply to **editors** only (people who can modify the code/canvas). **Viewers are always free and uncounted** — you can share a view-only link with as many people as you want regardless of tier.

> **Undo/Redo vs. Saves**: Ctrl+Z/Ctrl+Y is unlimited for everyone because it's purely client-side (CodeMirror history). "Saves" (Ctrl+S) are persistent server-side checkpoints (like git commits) — these are tiered.

### 10.2 Open Source Strategy

From ROADMAP.md Monetization Features:

- **Free Open Source Local Compiler**: The core Isomorph DSL parser, renderer, and editor remain open source and fully functional offline. No account needed for local use. The community can self-host, fork, and contribute.
- **Paid Web Version**: Cloud features (save, share, collaborate) require an account and are subject to tier limits.
- **Enterprise**: Custom deployment, SLA, SSO, advanced sharing.

---

## 11. Settings Page — Collaboration Tab

Currently the Collaboration tab in Settings shows "Collaboration settings will be available in a future update." Here's the planned design:

### 11.1 Collaboration Settings Panel

```
┌──────────────────────────────────────────────────────┐
│  Collaboration Settings                               │
│                                                       │
│  ── Your Cursor ──────────────────────────────────── │
│                                                       │
│  Display Name:  [Alice _______________]               │
│                                                       │
│  Cursor Colour:                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │  ● Red    ● Green   ● Blue    ● Yellow      │    │
│  │  ● White  ● Black   ● Pink    ● Orange      │    │
│  │                                     [✓ Blue]  │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  Preview:                                             │
│  ┌──────────────────────────────────────────────┐    │
│  │                                               │    │
│  │      ╲                                        │    │
│  │       ● · · ·                                 │    │
│  │      ╱                                        │    │
│  │   ┌───────┐                                   │    │
│  │   │ Alice │                                   │    │
│  │   └───────┘                                   │    │
│  │                                               │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  ── Active Sessions ─────────────────────────────── │
│                                                       │
│  Show other cursors on canvas:  [✓]                   │
│  Show cursor name labels:       [✓]                   │
│  Show particle trail:           [✓]                   │
│                                                       │
│  ── Notifications ───────────────────────────────── │
│                                                       │
│  Notify on new comments:        [✓]                   │
│  Notify on access changes:      [✓]                   │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### 11.2 Colour Picker Behaviour

- The 8 colours are shown as filled circles
- Hovering a circle shows a subtle glow/scale animation
- Clicking selects the colour → immediately updates the cursor preview
- The preview animates the cursor with the particle trail effect in real-time
- Selected colour is saved to `profiles.cursor_colour` on change (auto-save)

---

## 12. Security Considerations

### 12.1 Row Level Security (RLS) Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | Any authenticated | Trigger only | Own row | Never (soft delete) |
| `projects` | Owner + access + public | Authenticated | Owner + editors | Owner only |
| `project_access` | Own row + owner of project | Owner | Owner | Owner |
| `share_links` | Owner + editors | Owner + editors | Owner + editors | Owner + editors |
| `anonymous_sessions` | Server function | Server function | Server function | Cron cleanup |
| `comments` | Access to project | Commenter+ | Own comments | Own + owner can delete |
| `feedback` | Own rows | Authenticated | Never | Never |
| `telemetry_events` | Never (admin only) | Authenticated (if enabled) | Never | Never |
| `project_versions` | Owner + editors | Server function | Never | Owner (prune old) |
| `notifications` | Own rows | Server function | Own (mark read) | Own |

### 12.2 OSINT Protection (Reiterated)

- Registration: never reveal if email exists
- Login: generic "Invalid credentials" error  
- Password reset: always says "If an account exists, we sent a reset email"
- Username lookup: public profiles are opt-in

### 12.3 WebSocket Auth

- CRDT WebSocket connections must include a valid JWT or share_link token
- Server validates token before allowing Yjs sync
- Role-based write filtering on the CRDT server:
  - Viewers: receive sync, cannot push changes
  - Commenters: can push to comments Y.Map only
  - Editors: full Y.Doc write access
  - Owner: full access + admin commands

---

## 13. Technology Decision Record

### 13.1 Why Supabase?

| ✅ Pros | ❌ Cons |
|---------|--------|
| Auth out of the box (email, OAuth, magic link) | Realtime is not CRDT-aware |
| PostgreSQL with RLS | Vendor lock-in concern |
| Storage buckets with transforms | WebSocket support limited to broadcast |
| Auto-generated REST + GraphQL APIs | Cost at scale (but generous free tier) |
| Generous free tier (500MB DB, 1GB storage) | |
| Self-hostable (Docker) | |

**Verdict**: Supabase is excellent for auth, storage, and the relational data layer. For real-time CRDT collaboration, we supplement with a dedicated Yjs WebSocket server.

### 13.2 Why Yjs over Supabase Realtime?

Supabase Realtime (Broadcast/Presence) is a pub-sub relay — it forwards messages between clients. It does NOT:
- Store document state
- Merge concurrent edits
- Guarantee consistency
- Handle offline → online reconciliation

Yjs provides all of the above via CRDTs, plus has a mature CodeMirror 6 binding. Using Supabase Realtime alone would require us to build our own conflict resolution — essentially reinventing CRDTs poorly.

### 13.3 Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Firebase | No SQL, harder to migrate, Google-only auth integration |
| Appwrite | Less mature, smaller ecosystem |
| Custom backend | Too much work for MVP, Supabase gives us 80% for free |
| Liveblocks | Excellent CRDT but expensive, no self-host option |
| Convex | Interesting but too new, no CodeMirror binding |
| Plain WebSocket + OT | OT requires a central server to order operations, harder to implement correctly than CRDTs |

---

## 14. Deployment & Secrets

### 14.1 Architecture — GitHub Pages + Remote Services

```
┌─────────────────────────────────────────────────────────────┐
│                  GitHub Pages (static hosting)               │
│                                                              │
│  Vite build output (HTML/CSS/JS)                            │
│  Built by GitHub Actions with env vars:                     │
│    VITE_SUPABASE_URL=https://xxxxx.supabase.co              │
│    VITE_SUPABASE_ANON_KEY=eyJhbGciOi...                     │
│    VITE_WS_URL=wss://collab.isomorph.app                    │
│                                                              │
└──────────────┬──────────────────────┬───────────────────────┘
               │ HTTPS                │ WSS
               ▼                      ▼
┌──────────────────────┐  ┌──────────────────────────────────┐
│   Supabase Cloud     │  │   PC-Server / VPS                │
│   (free tier)        │  │                                  │
│                      │  │   ┌────────────────────────────┐ │
│   - Auth (GoTrue)    │  │   │  y-websocket               │ │
│   - PostgreSQL + RLS │  │   │  (Node.js, port 1234)      │ │
│   - Storage buckets  │  │   │  + TLS via Caddy/nginx     │ │
│                      │  │   └────────────┬───────────────┘ │
│                      │  │                │ persists to     │
│                      │◄─┤────────────────┘ Supabase DB     │
└──────────────────────┘  └──────────────────────────────────┘
```

### 14.2 Secret Safety

| Variable | Where | Exposure | Risk |
|----------|-------|----------|------|
| `VITE_SUPABASE_URL` | Client bundle | ✅ Public by design | None — RLS protects data |
| `VITE_SUPABASE_ANON_KEY` | Client bundle | ✅ Public by design | None — this is the **public** key, RLS is the security layer |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (y-websocket) | ❌ NEVER in client | Bypasses all RLS — server-side only |
| `VITE_WS_URL` | Client bundle | ✅ Public | Just a WebSocket endpoint |

> The Supabase `anon` key is explicitly designed to be in client-side code. It can only do what your RLS policies allow. The `service_role` key bypasses RLS and must **never** leave your server.

### 14.3 GitHub Actions Build

```yaml
# .github/workflows/deploy.yml (relevant env section)
env:
  VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
  VITE_WS_URL: ${{ secrets.WS_URL }}
```

These are set as GitHub repository secrets and injected at **build time** via Vite's `import.meta.env.VITE_*`. The values end up in the JS bundle (which is fine — they're public keys).

### 14.4 Self-Hosted PC Server Setup

For MVP, a single PC/VPS running:

1. **y-websocket** (Node.js process) — handles CRDT sync + awareness
2. **Caddy** (reverse proxy) — provides TLS/HTTPS for the WebSocket (`wss://`)
3. Optionally: **Supabase Docker** stack (if you want to self-host the DB too)

Minimum requirements:
- y-websocket alone: 512MB RAM, any CPU
- y-websocket + Supabase Docker: 4GB RAM, 2 cores

**Recommendation**: Use Supabase Cloud (free tier, zero ops) + y-websocket on your PC/VPS for MVP.

---

## 15. Open Questions

> Items marked ✅ RESOLVED were decided during design review (2026-06-12).

### Resolved

1. ✅ **Self-hosted vs. Supabase Cloud?**  
   → **Supabase Cloud free tier for MVP**. Self-host later if needed. PC-server with both Supabase Docker + y-websocket is viable for production.

2. ✅ **CRDT Server hosting**  
   → **y-websocket on a PC-server/VPS for MVP**. Migrate to HocusPocus later for production-grade features (auth hooks, persistence hooks, webhooks).

3. ✅ **Collaborator counting**  
   → **Only editors count against the tier limit**. Viewers are always free and unlimited.

4. ✅ **Undo/Redo vs. Saves**  
   → **Undo/Redo is unlimited for everyone** (client-side CodeMirror history). "Saves" (Ctrl+S) are tiered server-side checkpoints.

5. ✅ **Project structure**  
   → **Projects are folder-like containers** holding multiple diagrams. Each diagram has its own source_code and Yjs state.

### Still Open

6. **Canvas state in Yjs — how deep?**  
   Should entity positions (x, y, w, h) be part of the shared Yjs document, or only the source code text? If only text, each client re-renders independently (simpler but positions may diverge). If shared, we need a Y.Map per diagram.

7. **Comment anchoring strategy**  
   When code changes, comments anchored to entities may become orphaned on rename/delete. Options:
   - Anchor by entity name (simple, breaks on rename)
   - Anchor by Yjs relative position (survives edits)
   - Mark orphaned comments for review

8. **Auto-save frequency**  
   How often should the CRDT server snapshot to Supabase? Options: on disconnect, every 30 seconds, every N edits, on explicit save only.

9. **Rate limiting for anonymous users**  
   Anonymous commenters could spam. Suggested: 10 comments per 5 minutes per anonymous session.

10. **Google Drive / OneDrive integration**  
    From ROADMAP.md Phase 3 — the project model should be extensible to support external storage backends eventually.

---

## Appendix A: NPM Packages Required

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Supabase client (auth, DB, storage) |
| `yjs` | CRDT document model |
| `y-websocket` | Yjs WebSocket provider |
| `y-codemirror.next` | CodeMirror 6 ↔ Yjs binding |
| `y-protocols` | Yjs sync + awareness protocols |
| `lib0` | Yjs utility dependency |

## Appendix B: Supabase Setup Checklist

- [ ] Create Supabase project
- [ ] Enable Email auth provider
- [ ] Configure email templates (verification, password reset)
- [ ] Create `avatars` storage bucket (public read, authenticated write)
- [ ] Run SQL migrations for all tables
- [ ] Configure RLS policies for each table
- [ ] Create database triggers:
  - `on auth.users insert` → create `profiles` row
  - `on projects update` → update `updated_at`
  - `on project_access insert` → create notification
  - `on comments insert` → create notification for project owner
- [ ] Set up Edge Functions (if needed):
  - Share link token validation
  - Anonymous session management
  - Version pruning cron job
  - Anonymous session cleanup cron job

## Appendix C: Existing UI Integration Points

| Current UI Element | Backend Connection |
|-------------------|--------------------|
| Settings → Profile tab (placeholder fields) | → `profiles` table CRUD |
| Settings → Collaboration tab ("coming soon") | → cursor_colour picker, presence toggles |
| Settings → Storage tab ("coming soon") | → cloud project list, storage usage |
| Settings → App → Watermark toggle | → stays local (localStorage) for now |
| Settings → App → ~~(new)~~ Telemetry toggle | → `profiles.telemetry_enabled` |
| Toolbar → Feedback button ("coming soon") | → Feedback modal → `feedback` table |
| Toolbar → Login button ("coming soon") | → Auth modal (login/register/verify) |
| Library modal → My Works (placeholder cards) | → `projects` query (owner_id = me) |
| Library modal → My Works → **Search** | → Full-text search on project name + diagram names |
| Library modal → Shared Works ("coming soon") | → `project_access` join query |
| Library modal → Shared Works → **Search** | → Same search, filtered by shared projects |
| Status bar | → connection status indicator, collaborator count |

## Appendix D: Library Search

The Library modal needs a **search bar** at the top of both "My Works" and "Shared Works" tabs.

### Search Implementation

- **Client-side filter for MVP**: Since project limits are low (max 100), fetching all projects and filtering client-side with `Array.filter()` is sufficient.
- **Server-side search for scale**: If needed later, use PostgreSQL `tsvector` full-text search or `ILIKE` on `projects.name` + `diagrams.name`.
- **Search scope**: project name, project description, diagram names within project.
- **UI**: Search input with debounce (300ms), clear button, "No results" empty state.
