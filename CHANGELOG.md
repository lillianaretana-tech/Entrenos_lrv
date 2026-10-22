# EntreNos v0.74

- Recuerdos: administrators can choose, replace, or clear a fixed cover and closing photo. The shared album always orders cover, ordinary memories, then closing.
- Database: unique partial indexes enforce one cover and one closing per memory space; atomic invoker RPCs serialize changes per space. Reordering ordinary memories preserves both fixed pages. Existing Events code is unchanged.
- Shared album queries fetch all pages in batches instead of truncating at 500. Navigation, swiping, and direct page jumps retain the v0.73 frontend behavior. Rendering thousands of pages still needs future pagination work.
- Admin dates prefer `captured_date_text` before `captured_at`.
- Voice: mutable file selection, stable identifiers for retries, recording retained on failure, normalized upload MIME type, object download and checksum verification, and a fresh media-row check before success. Failed saves offer “Intentar de nuevo”. Drafts remain in the open page; persistent offline drafts are not implemented.

Validation: `node --test tests/*.test.cjs` (Node 24+); database transaction tests for role changes, uniqueness, reordering, permissions, and growth past 2,000 items (rolled back). Browser microphone/device recording remains to be validated with a real recording. A rendered browser test could not run in the build environment because the browser download failed.

Deployment source: `database_changes/v074_bookends.sql` and `supabase/functions/memory-guest/index.ts`. SQL was applied directly to the existing project, and the function retains JWT verification. The SQL file records the applied change; it is not a repeatable migration runner.
