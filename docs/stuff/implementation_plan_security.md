# Input Validation & Zero-Trust Security Hardening

> **Scope**: Email validation, username rules, XSS/injection protection, DB-level zero-trust constraints
> **Priority**: Security-critical — should be done before any public-facing deployment

---

## Current Security Posture (What Already Exists)

### ✅ Already Protected

| Layer | Protection | Status |
|-------|-----------|--------|
| **SQL Injection** | Supabase JS client uses **parameterized queries** — all `.eq()`, `.insert()`, `.rpc()` calls pass values as parameters, never string-concatenated into SQL | ✅ Safe |
| **XSS (React)** | React's JSX auto-escapes all `{variables}` rendered in templates — no `dangerouslySetInnerHTML` found | ✅ Safe |
| **RLS** | Row Level Security enabled on all tables — users can only access their own data | ✅ Safe |
| **JWT Auth** | WebSocket server verifies JWT tokens via `jsonwebtoken` | ✅ Safe |
| **CORS** | Server restricts origins to allowed list | ✅ Safe |
| **Rate Limiting** | Server limits 30 req/min per IP | ✅ Safe |
| **Email Enumeration** | AuthModal suppresses "already registered" errors | ✅ Safe |
| **Share Tokens** | Uses `crypto.randomUUID()` (not `Math.random()`) | ✅ Safe |
| **Password** | Minimum 6 chars enforced by `minLength={6}` on input + server-side Supabase auth | ✅ Safe |

### 🔴 Not Protected (What's Missing)

| Gap | Risk | Location |
|-----|------|----------|
| **No email format validation** | Malformed emails sent to Supabase — relies entirely on browser `type="email"` | [AuthModal.tsx L104-111](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/AuthModal.tsx#L104-L111) |
| **No username validation** | Any string accepted — SQL special chars, unicode, emoji, XSS payloads, unlimited length | [SettingsModal.tsx L245-258](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/SettingsModal.tsx#L245-L258) |
| **No display name validation** | Same as username — no length/character restrictions | [SettingsModal.tsx L221-236](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/SettingsModal.tsx#L221-L236) |
| **No anonymous name validation** | Any string including `<script>` tags accepted as display name | [AnonymousLoginModal.tsx L52-63](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/AnonymousLoginModal.tsx#L52-L63) |
| **No project/diagram name validation** | Unlimited length, any characters | [projects.ts L70-90](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/projects.ts#L70-L90) |
| **No feedback content length limit** | Could submit megabytes of text | [FeedbackModal.tsx L80-87](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/FeedbackModal.tsx#L80-L87) |
| **No DB-level constraints** | `profiles.username` has `UNIQUE` but no format/length `CHECK` | [001_initial_schema.sql L7](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/supabase/migrations/001_initial_schema.sql#L7) |
| **`innerHTML` usage** | SVG rendering uses `innerHTML` — not exploitable since input is from the diagram parser (not user text), but should be noted | [DiagramView.tsx L387](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/DiagramView.tsx#L387) |
| **No Content-Security-Policy** | Server doesn't set CSP headers | [server/index.js](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/server/index.js) |
| **No invite email/username validation** | ShareModal sends raw user input to `grantAccess()` → `get_user_id_by_email_or_username` RPC | [ShareModal.tsx L85-97](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/ShareModal.tsx#L85-L97) |

---

## Proposed Changes

### Layer 1: Shared Validation Library (Defense-in-Depth Foundation)

#### [NEW] [validators.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/validators.ts)

A single source of truth for all input validation rules. Used by both frontend UI and the `profile.ts` / `projects.ts` libs before sending to Supabase.

```typescript
// ── Email ─────────────────────────────────────────────
// RFC 5322 simplified: local@domain.tld
// Must have @, domain part must have at least one dot, TLD ≥ 2 chars
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim();
  if (!trimmed) return { valid: false, error: 'Email is required' };
  if (trimmed.length > 254) return { valid: false, error: 'Email too long' };
  if (!EMAIL_REGEX.test(trimmed)) return { valid: false, error: 'Invalid email format' };
  return { valid: true };
}

// ── Username ──────────────────────────────────────────
// Rules: a-z, 0-9, hyphen, underscore, dot only. Max 13 chars. Min 2.
const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;
const MAX_USERNAME_LENGTH = 13;
const MIN_USERNAME_LENGTH = 2;

export function validateUsername(username: string): { valid: boolean; error?: string } {
  const trimmed = username.trim();
  if (!trimmed) return { valid: false, error: 'Username is required' };
  if (trimmed.length < MIN_USERNAME_LENGTH) return { valid: false, error: `Min ${MIN_USERNAME_LENGTH} characters` };
  if (trimmed.length > MAX_USERNAME_LENGTH) return { valid: false, error: `Max ${MAX_USERNAME_LENGTH} characters` };
  if (!USERNAME_REGEX.test(trimmed)) return { valid: false, error: 'Only letters, numbers, . _ - allowed' };
  if (trimmed.startsWith('.') || trimmed.endsWith('.')) return { valid: false, error: 'Cannot start/end with a dot' };
  if (trimmed.includes('..')) return { valid: false, error: 'No consecutive dots' };
  return { valid: true };
}

// ── Display Name ──────────────────────────────────────
export function validateDisplayName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: 'Name is required' };
  if (trimmed.length > 50) return { valid: false, error: 'Max 50 characters' };
  if (/<[^>]*>/.test(trimmed)) return { valid: false, error: 'HTML tags not allowed' };
  return { valid: true };
}

// ── Project / Diagram Name ────────────────────────────
export function validateProjectName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: 'Name is required' };
  if (trimmed.length > 100) return { valid: false, error: 'Max 100 characters' };
  if (/<[^>]*>/.test(trimmed)) return { valid: false, error: 'HTML tags not allowed' };
  return { valid: true };
}

// ── Generic text sanitizer (strips HTML tags) ─────────
export function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

// ── Feedback content ──────────────────────────────────
export function validateFeedbackContent(content: string): { valid: boolean; error?: string } {
  if (!content.trim()) return { valid: false, error: 'Content is required' };
  if (content.length > 5000) return { valid: false, error: 'Max 5000 characters' };
  return { valid: true };
}
```

---

### Layer 2: Frontend Enforcement (UI-Level Validation)

#### [MODIFY] [AuthModal.tsx](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/AuthModal.tsx)

- Import `validateEmail` from validators
- Add client-side email validation **before** calling `supabase.auth.signInWithPassword` / `signUp`
- Show inline error if email doesn't match `@` + `.tld` pattern
- Add `maxLength={254}` to the email input

#### [MODIFY] [SettingsModal.tsx](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/SettingsModal.tsx)

**Username field** (~L245-258):
- Import `validateUsername` from validators
- Add `maxLength={13}` to the input
- Add `pattern` attribute: `[a-zA-Z0-9._-]+`
- Validate on `onChange` — show inline error/border color if invalid
- Block `onBlur` auto-save if validation fails
- Show character count (e.g., `3/13`)

**Display Name field** (~L221-236):
- Import `validateDisplayName` from validators
- Add `maxLength={50}` to the input
- Validate on `onChange` — reject HTML tags
- Block auto-save if invalid

#### [MODIFY] [AnonymousLoginModal.tsx](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/AnonymousLoginModal.tsx)

- Import `validateDisplayName`
- Add `maxLength={50}` to the name input
- Validate before calling `onJoin` — strip HTML tags via `sanitizeText()`
- Disable submit button if validation fails

#### [MODIFY] [ShareModal.tsx](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/ShareModal.tsx)

- Before calling `grantAccess(projectId, inviteEmail, ...)`:
  - If input contains `@`: validate with `validateEmail()`
  - If input doesn't contain `@`: validate with `validateUsername()`
- Show appropriate error message for invalid format

#### [MODIFY] [FeedbackModal.tsx](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/components/FeedbackModal.tsx)

- Add `maxLength={5000}` to the textarea
- Show character count
- Validate with `validateFeedbackContent()` before submit

#### [MODIFY] [App.tsx](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/App.tsx)

- In `handleRenameSubmit` (~L363): validate with `validateProjectName()` before saving
- In `autoSaveProfile` (~L587): validate username/display name before upserting
- In `handleCreateProjectSubmit` (~L794): validate project name before creating

#### [MODIFY] [profile.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/profile.ts)

- In `updateProfile()`: validate username with `validateUsername()` and full_name with `validateDisplayName()` before the Supabase upsert — **defense in depth** (even if UI is bypassed)

#### [MODIFY] [projects.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/src/lib/projects.ts)

- In `createProject()`: validate name with `validateProjectName()` before insert
- In `createDiagram()`: validate name before insert

---

### Layer 3: Database-Level Zero-Trust Constraints (The Final Wall)

> [!IMPORTANT]
> Even if the frontend is completely bypassed (Supabase anon key is public — anyone can call the API directly), these DB constraints will reject bad data.

#### [NEW] `supabase/migrations/017_input_validation_constraints.sql`

```sql
-- ══════════════════════════════════════════════════════
-- Migration 017: Zero-Trust Input Validation Constraints
-- ══════════════════════════════════════════════════════
-- These CHECK constraints ensure that even if the frontend is
-- bypassed, the database rejects malformed or malicious input.
-- This implements the "zero trust" principle at the data layer.
-- ══════════════════════════════════════════════════════

-- ── PROFILES ─────────────────────────────────────────

-- Username: 2-13 chars, only a-z 0-9 . _ -
-- Cannot start/end with dot, no consecutive dots
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_username_format
  CHECK (
    username IS NULL OR (
      length(username) BETWEEN 2 AND 13
      AND username ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$'
      AND username !~ '\.\.'
    )
  );

-- Display name: max 50 chars, no HTML tags
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_full_name_length
  CHECK (
    full_name IS NULL OR (
      length(full_name) BETWEEN 1 AND 50
      AND full_name !~ '<[^>]*>'
    )
  );

-- Avatar URL: max 500 chars, must start with https://
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_avatar_url_format
  CHECK (
    avatar_url IS NULL OR (
      length(avatar_url) <= 500
      AND avatar_url ~ '^https://'
    )
  );

-- ── PROJECTS ─────────────────────────────────────────

-- Project name: 1-100 chars, no HTML tags
ALTER TABLE public.projects
  ADD CONSTRAINT chk_project_name_length
  CHECK (
    length(name) BETWEEN 1 AND 100
    AND name !~ '<[^>]*>'
  );

-- ── DIAGRAMS ─────────────────────────────────────────

-- Diagram name: 1-100 chars, no HTML tags
ALTER TABLE public.diagrams
  ADD CONSTRAINT chk_diagram_name_length
  CHECK (
    length(name) BETWEEN 1 AND 100
    AND name !~ '<[^>]*>'
  );

-- Diagram kind: only known values
ALTER TABLE public.diagrams
  DROP CONSTRAINT IF EXISTS chk_diagram_kind;
ALTER TABLE public.diagrams
  ADD CONSTRAINT chk_diagram_kind
  CHECK (kind IN (
    'class', 'usecase', 'component', 'deployment',
    'sequence', 'activity', 'state', 'collaboration', 'flow'
  ));

-- ── FEEDBACK ─────────────────────────────────────────

-- Feedback content: max 5000 chars
ALTER TABLE public.feedback
  ADD CONSTRAINT chk_feedback_content_length
  CHECK (length(content) BETWEEN 1 AND 5000);

-- ── SHARE LINKS ──────────────────────────────────────

-- Role must be valid
ALTER TABLE public.share_links
  DROP CONSTRAINT IF EXISTS chk_share_link_role;
ALTER TABLE public.share_links
  ADD CONSTRAINT chk_share_link_role
  CHECK (role IN ('editor', 'commenter', 'viewer'));

-- ══════════════════════════════════════════════════════
-- Validation trigger: reject usernames that look suspicious
-- ══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_profile_input()
RETURNS TRIGGER AS $$
BEGIN
  -- Reject usernames that contain SQL keywords (defense in depth)
  IF NEW.username IS NOT NULL AND (
    lower(NEW.username) ~ '(select|insert|update|delete|drop|union|exec|script)'
  ) THEN
    RAISE EXCEPTION 'Invalid username: contains reserved keywords';
  END IF;

  -- Reject display names with suspicious patterns
  IF NEW.full_name IS NOT NULL AND (
    NEW.full_name ~ '<script' OR
    NEW.full_name ~ 'javascript:' OR
    NEW.full_name ~ 'on\w+\s*='
  ) THEN
    RAISE EXCEPTION 'Invalid display name: contains prohibited patterns';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_profile ON public.profiles;
CREATE TRIGGER trg_validate_profile
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_input();
```

---

### Layer 4: Server-Side Hardening

#### [MODIFY] [server/index.js](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/server/index.js)

Add security headers to HTTP responses:

```javascript
// Add to HTTP server response headers
response.setHeader('X-Content-Type-Options', 'nosniff');
response.setHeader('X-Frame-Options', 'DENY');
response.setHeader('X-XSS-Protection', '0'); // Deprecated but harmless
response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
response.setHeader('Content-Security-Policy',
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' wss: https:");
```

Add WebSocket message size limit:

```javascript
// In wss.on('connection', ...) after setupWSConnection:
conn.on('message', (data) => {
  // Reject oversized messages (>1MB) to prevent DoS
  if (data.length > 1_048_576) {
    console.warn(`Oversized message (${data.length} bytes) from ${ip}. Dropping.`);
    conn.close(4013, 'Message too large');
  }
});
```

---

### Layer 5: Vite/Build Security Headers

#### [MODIFY] [vite.config.ts](file:///c:/Users/0xAu/Documents/School/University/Year%202/PBL/Semester%202%20(Isomorph)/code/isomorph/vite.config.ts) (if exists) or index.html

Add CSP meta tag to `index.html` as a fallback for when the app is served without the Node server:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' wss: https: http://localhost:*;">
```

---

## Open Questions

> [!IMPORTANT]
> **Q1: Username case sensitivity** — Should usernames be case-insensitive? (e.g., `John` and `john` are the same user). I recommend **yes** — store lowercase, display original. This requires `lower(username)` in the DB unique constraint.

> [!IMPORTANT]
> **Q2: Existing invalid usernames** — If there are already usernames in the DB that violate the new rules (e.g., longer than 13 chars, contain spaces), the migration will fail. Should we:
> - **(A)** Run a cleanup query first to truncate/normalize existing usernames
> - **(B)** Add the constraints as `NOT VALID` (deferred validation) and fix data manually
> - **(C)** Skip constraints on existing data, only validate new inserts via the trigger

> [!IMPORTANT]
> **Q3: The `innerHTML` in DiagramView** — The SVG is generated from the diagram parser (not raw user input), so it's not a direct XSS vector. However, if a user types `<script>alert(1)</script>` as an entity name in the editor, that text flows through the parser → renderer → SVG → `innerHTML`. Should we sanitize entity names at the parser level, or is the SVG renderer already safe? I'll investigate this if you want.

---

## Verification Plan

### Automated
- `npm run typecheck` — all new validator types check out
- `npm run build` — production build passes

### Manual
- [ ] Try registering with `not-an-email` → should show "Invalid email format"
- [ ] Try registering with `test@x` (no TLD) → should reject
- [ ] Try setting username to `hello world` → should show "Only letters, numbers, . _ - allowed"
- [ ] Try setting username to `this_is_a_very_long_name` → should show "Max 13 characters"
- [ ] Try setting username to `ab` → should accept (minimum 2)
- [ ] Try setting username to `<script>` → should reject
- [ ] Try setting display name to `<img src=x onerror=alert(1)>` → should reject
- [ ] Try submitting feedback with 10,000 chars → should be limited to 5,000
- [ ] Try creating a project with name > 100 chars → should reject
- [ ] Verify existing functionality still works after DB migration
- [ ] Test share modal invite with valid email and valid username

### DB-Level
- [ ] Directly call Supabase API with invalid username → should get CHECK constraint error
- [ ] Directly insert a profile with `<script>` in full_name → should be rejected by trigger
