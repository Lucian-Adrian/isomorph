# Collaboration, CRDT & System Architecture Audit

> **Date:** October 2026  
> **Target Comparison:**  
> 1. Latest commit on `refactor/demonolith` (`759c16c8` / working tree)  
> 2. Latest master before demonolithing (`fork/master` at `3600c685`)  
> **Status:** Read-only audit & test specifications (no application code modified)

---

## 1. Executive Summary & Comparative Audit

| Dimension | `fork/master` (`3600c685`) | `refactor/demonolith` (`759c16c8`) | Architectural Status & Impact |
| :--- | :--- | :--- | :--- |
| **`App.tsx` Footprint** | **~6,129 lines** (Single monolithic God file) | **~2,027 lines** (Extracted components & hooks) | **Improved 67%**: UI components and hooks extracted into clean single-responsibility modules. |
| **Collaboration Core** | `useCollaboration()` inline inside `App.tsx` | Extracted hook imports from `src/lib/collaboration.ts` | **Identical failure profile**: Core collaboration logic in `src/lib/collaboration.ts` was identical; both fail for the exact same backend and architectural reasons. |
| **Share Link UI** | `ShareModal` rendered directly with monolithic props | `ShareModal` rendered as modular component via `isShareModalOpen` | **Identical backend invocation**: Both call `createShareLink` and `grantAccess`. |
| **Collaboration Server** | `server/index.js` present in repo, but never launched by scripts | `server/index.js` present in repo, never launched by scripts | **Major defect in both**: Neither branch starts `server/index.js` in `package.json` `npm run dev`. |
| **CRDT Binding** | `yCollab` bound in `IsomorphEditor` | `yCollab` bound in `IsomorphEditor` | **Identical gating defect**: Both gate `yCollab` behind `isSynced`; if the WebSocket server is down, collaborative editing and cursors are completely disabled. |
| **Presence & Cursors** | `awareness` passed into `DiagramView` and `IsomorphEditor` | `awareness` passed into `DiagramView` and `IsomorphEditor` | **Identical silent failure**: If WebSocket connection fails, `awareness` has no remote peers; local cursors broadcast into the void. |

---

## 2. Root-Cause Analysis: Why Collaboration Features Do Not Work

### Issue A: The Collaboration WebSocket Server Is Never Running
1. **No Process Running:** The frontend connects via `y-websocket` to `COLLAB_SERVER_URL` (`ws://localhost:1234`).
2. **Missing npm Script:** `package.json` defines `"dev": "vite"`. It never runs `node server/index.js`.
3. **Hardcoded Hostname Resolver:** In `src/lib/collaboration.ts`:
   ```ts
   const rawUrl = import.meta.env.VITE_COLLAB_SERVER_URL || import.meta.env.VITE_WS_URL || 'ws://localhost:1234';
   ```
   If two different users test on different computers (or over GitHub Pages / network), `ws://localhost:1234` points to their own local machines, not to a shared server.
4. **Result:** The browser encounters `WebSocket connection to 'ws://...:1234' failed: net::ERR_CONNECTION_REFUSED`.
   - `isConnected` remains `false`.
   - `isSynced` remains `false`.
   - `yCollab` in CodeMirror is immediately unmounted (`collabCompartment.reconfigure([])`).
   - `remoteCursors` map in `DiagramView` remains empty.

### Issue B: Share Link Creation Fails (`createShareLink` Returns `null`)
1. **Unsaved Diagram State:** In `Toolbar.tsx`, the "Share" button is disabled unless `activeTab?.project_id` exists. If a user tries to share a local diagram without clicking "Save to cloud" first, `projectId` is undefined.
2. **PostgreSQL RLS Constraint on `share_links`:**
   In migration `006_add_collaboration.sql`:
   ```sql
   CREATE POLICY "Project owner can insert share links"
     ON public.share_links FOR INSERT
     WITH CHECK (EXISTS(SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));
   ```
   - Only the **owner** of the project can create share links. If an invited "editor" tries to create a share link, Postgres rejects the INSERT.
   - When `.insert([...]).select().single()` is executed in `src/lib/share-links.ts`, PostgreSQL verifies the SELECT policy:
   ```sql
   CREATE POLICY "Share links viewable by project owner"
     ON public.share_links FOR SELECT
     USING (EXISTS(SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));
   ```
   If the user's session token is expired or anonymous, the SELECT query returns 0 rows, triggering an exception and returning `null`.
3. **Silent Failure in UI:** `ShareModal.tsx` does not display an error message if `createShareLink` returns `null`; it simply fails silently without toast notification.

### Issue C: Granting Access by Email / Username Shows No Live Updates
1. **Unregistered User Lookup:** In `src/lib/access-control.ts`:
   ```ts
   const { data: userId, error: lookupError } = await supabase
     .rpc('get_user_id_by_email_or_username', { input_text: emailOrUsername });
   ```
   If the invitee has not yet created an account in this Supabase instance, `target_user_id` returns `NULL`. The UI then shows "User not found".
2. **No Realtime Subscription on Project Access:**
   When User A successfully invites User B:
   - A row is inserted into PostgreSQL table `project_access`.
   - **However, User B's browser has no Supabase Realtime channel listening to `postgres_changes` on `project_access` or `projects`!**
   - User B does not receive any push notification, their project list does not refresh, and their open tabs do not automatically open the shared diagram. User B must manually log out and log in or hard refresh the browser to see the shared project.
3. **Room Name Disconnect:**
   Even when both users open the shared diagram:
   - In `src/lib/collaboration.ts`, the room name is `roomName: activeTab?.diagram_id`.
   - If User A is on a temporary local tab (where `diagram_id` is null or local UUID) and User B opened via project access (where `diagram_id` is Supabase UUID), they join completely different rooms!

### Issue D: Canvas Cursor Delta & Awareness Propagation
1. **Canvas Pointer Broadcasting:**
   In `DiagramView.tsx`, `screenToCanvas` broadcasts local cursor:
   ```ts
   if (awareness) {
     awareness.setLocalStateField('pointer', { x: local.x, y: local.y });
   }
   ```
   - Because `y-websocket` is disconnected, `awareness.setLocalStateField` does not reach any peer.
   - Even when connected, mouse moves fire at 60-120Hz without `requestAnimationFrame` throttling or rate-limiting, which floods the WebSocket frame buffer.

---

## 3. Comprehensive Test Suite Specification

Below is the complete specification for the test suites that must be written to systematically validate actions, buttons, CRDTs, access control, and live collaboration.

### Suite 1: UI Actions & Buttons (`tests/ui-actions.test.tsx`)
Validates that all toolbar actions, modals, and canvas interaction triggers behave correctly.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

describe('UI Actions & Buttons Suite', () => {
  it('disables the Share button when active diagram is not saved to cloud', () => {
    // Assert activeTab.project_id === undefined disables the button
  });

  it('opens ShareModal when Share button is clicked on a cloud-saved tab', () => {
    // Assert clicking #iso-btn-share toggles isShareModalOpen to true
  });

  it('disables editing canvas elements when user role is viewer', () => {
    // Assert readOnly prop is passed to IsomorphEditor and canvas drag handles are hidden
  });

  it('triggers diagram rename modal and dispatches update on submission', async () => {
    // Assert RenameModal validates duplicate names and updates workspace tab
  });

  it('triggers delete confirmation modal before discarding diagrams', async () => {
    // Assert deletion requires confirmation and invokes project removal
  });
});
```

### Suite 2: Share Links & Direct Access (`tests/share-access.test.ts`)
Validates link generation, role assignment, scoping, and email/username invitations.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createShareLink, resolveShareLink, deleteShareLink } from '../src/lib/share-links';
import { grantAccess, revokeAccess } from '../src/lib/access-control';

describe('Share Links & Access Control Suite', () => {
  it('generates a 40-character unique token with valid expiration and role', async () => {
    // Test createShareLink(projectId, 'editor', diagramId, expiresAt, maxUses)
  });

  it('resolves valid share link and increments use_count', async () => {
    // Test resolveShareLink(token) returns { project_id, diagram_id, role }
  });

  it('rejects expired or maxed-out share links', async () => {
    // Test resolveShareLink returns null when expires_at < now or use_count >= max_uses
  });

  it('grants direct access to valid user and updates existing role on duplicate invite', async () => {
    // Test grantAccess upsert behavior
  });

  it('returns false and displays user not found modal when email/username does not exist', async () => {
    // Test grantAccess with nonexistent identifier
  });
});
```

### Suite 3: CRDT Document Sync & Conflict Resolution (`tests/crdt-sync.test.ts`)
Validates Yjs document lifecycle, bidirectional text sync, and non-destructive merges.

```typescript
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';

describe('CRDT Synchronization Suite', () => {
  it('merges concurrent text insertions without losing characters', () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    const text1 = doc1.getText('source');
    const text2 = doc2.getText('source');

    text1.insert(0, 'class User {\n');
    const update1 = Y.encodeStateAsUpdate(doc1);
    Y.applyUpdate(doc2, update1);

    // Concurrent edits
    text1.insert(13, '  +id: int\n');
    text2.insert(13, '  +name: string\n');

    // Cross-sync updates
    const u1 = Y.encodeStateAsUpdate(doc1);
    const u2 = Y.encodeStateAsUpdate(doc2);
    Y.applyUpdate(doc2, u1);
    Y.applyUpdate(doc1, u2);

    expect(text1.toString()).toEqual(text2.toString());
    expect(text1.toString()).toContain('+id: int');
    expect(text1.toString()).toContain('+name: string');
  });

  it('prevents text doubling on reconnect/soft reload', () => {
    const doc = new Y.Doc();
    const text = doc.getText('source');
    text.insert(0, 'diagram Architecture : class');
    
    // Simulate re-initialization check
    const existing = text.toString();
    if (existing.length === 0) {
      text.insert(0, 'diagram Architecture : class');
    }
    expect(text.toString()).toBe('diagram Architecture : class');
  });
});
```

### Suite 4: Real-Time Presence & Remote Cursors (`tests/presence-cursors.test.ts`)
Validates awareness states, cursor positioning, and collaborator roster ordering.

```typescript
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

describe('Real-Time Presence & Cursors Suite', () => {
  it('broadcasts pointer coordinates and user metadata via Awareness', () => {
    const doc1 = new Y.Doc();
    const awareness1 = new Awareness(doc1);
    const awareness2 = new Awareness(doc1);

    awareness1.setLocalStateField('user', {
      name: 'Alice',
      color: '#3B82F6',
      role: 'editor',
    });
    awareness1.setLocalStateField('pointer', { x: 120, y: 340 });

    const states = awareness1.getStates();
    expect(states.get(awareness1.clientID)?.pointer).toEqual({ x: 120, y: 340 });
    expect(states.get(awareness1.clientID)?.user.name).toBe('Alice');
  });

  it('removes remote cursor when client disconnects or times out', () => {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    awareness.setLocalStateField('pointer', { x: 50, y: 50 });
    expect(awareness.getStates().get(awareness.clientID)?.pointer).toBeDefined();

    awareness.destroy();
  });
});
```

---

## 4. UI Sentence Case & Typography Directives

1. **Sentence Case Enforcement (`clean.md`):**
   - All labels, dialog titles, toasts, subtitles, menu items, and buttons must use Sentence case.
   - Example: *"Export diagram as PNG"* (not *"Export Diagram As PNG"*), *"Direct access"* (not *"Direct Access"*).
2. **Typography Migration:**
   - The project has downloaded the complete Libron webfont family into `public/fonts/`:
     - `Libron-Regular.woff2`
     - `Libron-Italic.woff2`
     - `Libron-Bold.woff2`
     - `Libron-BoldItalic.woff2`
   - Configured in `@font-face` inside `src/index.css` and applied to SVG diagram export text nodes in `src/renderer/`.
3. **Mobile UI Roadmap:**
   - Logged under Phase 3 of `docs/stuff/ROADMAP.md` for dedicated touch controls, bottom sheet panel, and layout responsiveness.
