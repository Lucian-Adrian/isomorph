# Phase B: Fixes & Sharing Implementation

## 1. Yjs Text Sync Bug Fix
**The Problem:** You noticed that typing in the middle of a file caused changes to be appended to the beginning in the other session. This happened because the `y-websocket` server was failing to load the initial document state. The server queried for a `source` column, but our database actually stores it inside the `content` JSONB column. Because the server's `Y.Text` was empty, when two clients connected, their CodeMirror instances tried to merge their local text into the empty server state simultaneously, creating duplicated, misaligned text indices.

**Proposed Fix:**
- Update `server/index.js` to correctly query the `content` column and initialize `Y.Text` with `data.content.source`.
- Adjust `IsomorphEditor.tsx` so that `fast-myers-diff` strictly ignores updates that originate from `y-codemirror.next` typing, preventing local echo loops.

## 2. Share Links & Access Control
To handle your second question—sharing projects with people who don't have access to your account—we need to implement the Share Link system we laid out in the database schema.

**Proposed Changes:**

### Routing & URL Handling
- We will use query parameters for share links, e.g., `https://isomorph.app/?share=<TOKEN>`.
- When `App.tsx` mounts, it will check `window.location.search` for `?share=...`. 
- If present, it will call `resolveShareLink(token)` to validate the token.

### Anonymous Sessions
- If the share link is valid and the user is NOT logged in, we will seamlessly generate an `anonymous_session` in the database.
- This gives them a temporary ID, a generated display name (e.g., "Anonymous Capybara"), and a cursor colour.
- They will be granted read-only or commenter access to the project based on the link's permissions.

### Share UI Modal
- We will add a "Share" button to the top-right header in `App.tsx`.
- Clicking it opens `ShareModal.tsx`, where you (the project owner) can:
  - Generate a new Share Link (Viewer or Commenter).
  - See a list of active share links and revoke them.
  - See who currently has explicit project access.

### Database RLS (Row Level Security) Update
- We need to write `007_update_rls.sql` to modify the existing `projects` and `diagrams` policies. Currently, they say `USING (auth.uid() = owner_id)`. We must expand this to: `USING (auth.uid() = owner_id OR <user has active share link/access>)`.

---

> [!IMPORTANT]
> **User Review Required:**
> 1. Does the URL structure `?share=<TOKEN>` work for you, or do you prefer a hash like `#share=<TOKEN>`?
> 2. For anonymous users, should they be forced to enter a display name when they open a share link, or should we auto-generate an animal name for them (like Google Docs)?

Let me know your thoughts on the plan above and the open questions, and I'll begin execution!
