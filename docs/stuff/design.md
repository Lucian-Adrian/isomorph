# Isomorph Design Paradigm

These guidelines define the core design system, user interaction model, and visual standards for the Isomorph application. All future modifications and features must strictly adhere to these paradigm rules.

---

## 1. Action Visibility & Feedbacks (Toasts)
All actions that perform operations in the background (which the user cannot directly observe visually on the screen, such as copying text to clipboard, saving a file, exporting diagrams, or background syncs) **MUST** show a toast message to confirm execution.

### Example: Error Copy Implementation
```typescript
const handleCopyErrors = useCallback(async () => {
  if (allErrors.length === 0) return;
  const text = allErrors.join('\n');
  let copied = false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch {
    copied = false;
  }

  if (!copied) {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', 'true');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      copied = document.execCommand('copy');
      document.body.removeChild(area);
    } catch {
      copied = false;
    }
  }

  if (copied) {
    addToast(t('ui.copied') || 'Copied', 'success'); // Toast notification
  }
}, [allErrors]);
```

---

## 2. Tooltips, Right-Click Menus, & Popovers
- **Outside Click Dismissal**: All custom context menus, right-click popovers, and floating tooltips **must** be dismissible by clicking anywhere outside of their boundaries.
- **Custom Implementations**: Never use browser-default context menus or tooltips. Use native React/HTML wrappers (`iso-context-menu`, `iso-context-menu-item`, etc.).
- **Consistent Styles & Behaviors**:
  - Right-click tooltips and dropdown menus must look uniform across the app (library cards context menu, filter context menu, canvas right-click menu).
  - Sub-menus (e.g., "Add to Folder") must render inline and overlay properly beside the parent menu.

---

## 3. Modals & Dialog Box Behavior
- **Overlay Dismissal**: All modals must close when clicking the overlay (outside the modal container) or pressing the `Escape` key, unless there is unsaved critical data (in which case a confirmation is shown).
- **Close Button**: Every modal must have a clearly visible close button (`×`) in the top right styled with `.iso-modal-close-btn`.
- **Keyboard Submission**: Pressing `Enter` in input fields (when not in a multiline textarea) must automatically trigger the modal's primary confirmation/save action.

---

## 4. Typography & Title Casing
- **Sentence Casing**: Headings, modal titles, and label texts should **not** be in all-caps or title-case (except where brand-required). Use sentence case (e.g., capitalize only the first word and proper nouns).
  - *Correct*: `Create new diagram`, `Delete project`, `Settings`
  - *Incorrect*: `CREATE NEW DIAGRAM`, `Delete Project`

---

## 5. Theme Accent Colors
The application has a unified palette of status and highlight colors defined in `index.css`. Never hardcode raw hex values; always use CSS variables.

| System Variable | Light Theme | Dark Theme | Purpose / Example |
| :--- | :--- | :--- | :--- |
| `var(--iso-danger)` / `var(--iso-error)` | `#ff5f57` | `#ff7b72` | Delete buttons, error states, and destructive actions. |
| `var(--iso-warning)` | `#febc2e` | `#d29922` | Feedback actions, limit warnings, and notes. |
| `var(--iso-success)` | `#28c840` | `#3fb950` | Successful saves, copy notifications, and creation toasts. |
| `var(--iso-info)` | `#0550ae` | `#58a6ff` | Information tabs, generic toasts, and links. |
| `var(--iso-primary)` | `var(--ink-deep)` | `var(--ink-deep)` | Selected tabs, key boundaries, and submit buttons. |

---

## 6. Button Interactive States
All buttons, tab items, and clickable options must include active/hover feedback in their CSS selectors:
- **Hover**: Subtle shift in background color (`background: var(--iso-bg-hover)`), border, or color.
- **On Click (Active)**: Visual compression feedback (e.g. `transform: scale(0.97)`).
- **Danger Hover**: Red destructive actions should hover with a subtle red tinted background (`rgba(255, 95, 87, 0.08)`) while retaining their red text color.

---

## 7. Storage & Synchronization
- All configuration changes, folder/category creation, and workspace changes **must** save to:
  1. Local storage (`localStorage`) for immediate persistence in the offline state.
  2. Supabase database via updates to user profile settings or projects settings columns for cloud sync.
- Both light/dark mode theme configurations and custom folder category tabs must sync automatically.

---

## 8. Toast Foreground & Z-Index
- **Absolute Foreground Priority**: The toast container (`.iso-toast-container`) must use a high `z-index` (specifically `99999 !important`) to guarantee that notification bubbles remain in the absolute foreground, rendering cleanly above active modals, drawer panels, drop-downs, and dark overlay backdrops.
- **Micro-Animations**: Toasts must slide in or fade in smoothly and remain interactable (e.g., clickable to dismiss or pause auto-dismiss on hover).

---

## 9. Double-Press Button Prevention
- **State Protection**: All interactive controls that trigger asynchronous operations, network requests, database mutations, or file creation (e.g., creating a diagram, creating a project, sending an email invite) **must** implement double-press prevention.
- **Visual Feedback**:
  - Disable the trigger element immediately upon click (`disabled={loading}`).
  - Change the cursor state to `not-allowed`.
  - Shift label text to indicate active progress (e.g., changing "Create" to "Creating...", "Save" to "Saving...").
  - Restore interactive capabilities only after the asynchronous operation has fully resolved or failed (providing appropriate error toast notifications).

---

## 10. Security Blueprints & Input Sanitization
- **Cross-Site Scripting (XSS)**: Ensure all user input is sanitized before rendering. React's default escaping is leveraged, but any raw HTML insertion (`dangerouslySetInnerHTML`) is strictly prohibited unless sanitized via a validated library.
- **SQL Injection (SQLi)**: All database queries must run through PostgREST/Supabase client parameterized queries. Do not construct raw SQL query strings dynamically inside client-side components or database functions.
- **Server-Side Request Forgery (SSRF)**: Any fetch or redirection endpoints validating external URLs must parse and whitelist protocol prefixes (`http://`, `https://`) and explicitly reject requests targeting local subnets, private IPs, or internal service endpoints.
- **Input Validation**: Enforce strict constraints on input fields (max length, allowed characters) both client-side and via database constraints/policies to safeguard resources against buffer manipulation and formatting issues.
