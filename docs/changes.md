# Implemented Changes Summary

All development targets under Workstream 1 (AAA Hardening - Audit Trails), user-reported UI issues, and granular diagram-level sharing requirements have been resolved.

## AAA Hardening (Workstream 1)
- **Database FK Migration**: Added `015_add_project_access_profiles_fk.sql` which adds a foreign key constraint from `project_access(user_id)` to `public.profiles(id)` enabling join queries via PostgREST.
- **Audit Trails**: Integrated explicit logging in `src/lib/projects.ts` (project creation), `src/lib/auth-context.tsx` (user logout), and `src/App.tsx` (diagram saving, anonymous and authenticated share link redemption, and account deletion).

## UI, Collaboration & Style Fixes
1. **User Not Found Modal**: Replaced browser `alert()` with a custom modal inside `ShareModal.tsx` when a collaborator search fails.
2. **Enter to Submit Invites**: Enabled press-to-submit `Enter` key bindings in `ShareModal.tsx` for inviting users.
3. **Toast Foreground Stack**: Elevated `.iso-toast-container` `z-index` to `99999 !important` in `index.css` so toast messages are rendered on top of active modals.
4. **Multiple Press Protection**: Implemented `isCreatingProject` indicator to disable creation triggers during project creation.
5. **Cursor Collaboration & Clear**: Enabled canvas tracking of coordinates and Yjs broadcasts on mouse pointer hover, with canvas `onPointerLeave` clearing cursor state to prevent stuck cursor ghosts on other screens.
6. **CodeMirror Y-Collab & Avatars Styling**: Added custom styling inside `index.css` for collaborative selection, caret lines, caret hover tooltips, and client avatar stack highlights. Restored dynamic color properties to prevent user cursor colors from being overridden.
7. **Shared Links in Direct Access**: Configured access indicators inside `App.tsx` to automatically sync and list shared libraries and permissions for editors/viewers.
8. **Dynamic Public/Private Indicators**: Visibility updates dynamically on the client dashboard whenever a share link is created/deleted or collaborator list changes, counting any share links or direct access users.
9. **Revoke Access Cleanup**: Adjusted deletion parameters inside `access-control.ts` and `ShareModal.tsx` to delete direct permissions specifically by record ID.

## Granular Diagram-Level Sharing & RLS Fixes
- **Diagrams RLS Scoping Fix**: Created `016_fix_diagrams_rls_scoping.sql` to explicitly qualify references in diagrams RLS policies (`project_access.project_id = diagrams.project_id`, etc.), resolving PostgreSQL scoping bugs that caused diagram lists to appear empty for shared projects.
- **Library Cards Deduplication**: Modified `getSharedProjects` inside `projects.ts` to unique-group shared items by project ID and prioritize project-level base roles, preventing multiple project cards from showing up when a user is granted project-level access and separate diagram-level access in the same folder.
- **Diagram-Level Role Mapping**: Updated `handleOpenProjectDetails` in `App.tsx` to query and cache all specific diagram-level access records. The Library modal now displays distinct status badges (e.g. Viewer, Editor) for each file according to permissions.
- **Permission Enforcement**: Configured file-opening logic so that opening shared project files (individually or via "Open Whole Project") respects individual diagram-level permissions (e.g. allowing editing on specific files even when the base project role is viewer).

