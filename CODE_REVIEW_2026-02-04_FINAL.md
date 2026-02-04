# ShotFlow Code Review — Final (Clean)

**Date:** 2026-02-04  
**Reviewer:** Stu (AI Code Review)  
**Scope:** Full codebase review (src/, supabase/migrations/, build health)  
**Previous rounds:** R1 (18 findings), R2 (11 findings), R3 (8 findings), R4 (2 findings)  
**Build status:** ✅ `npm run build` passes with 0 errors, 0 warnings

---

## Executive Summary

After **4 iterations** of fix-then-review, the ShotFlow codebase is **clean and production-ready**. All critical, high, medium, and low findings have been resolved. The auth layer, RLS policies, signed URL handling, API security, and UI functionality are all solid.

---

## Review Checklist — All Clear ✅

### 1. Security
- ✅ **Auth layer** — `authenticateRequest()` uses `getUser()` (not `getSession()`), derives user from `public.users` via service role. All API routes use this consistently.
- ✅ **RLS policies** — Comprehensive coverage across all tables. Review sessions correctly allow public SELECT for token-based access.
- ✅ **Signed URLs** — SHA256 tokens generated server-side. No raw API keys exposed to clients. Upload signing via shared `generateSignedUploadUrl()` in `src/lib/bunny.ts`.
- ✅ **Role enforcement** — All API routes check roles. VFX_VENDOR scoped to own vendor for artist invites.
- ✅ **Input validation** — Thumbnail proxy validates UUID format. Source media search sanitizes PostgREST filter characters.
- ✅ **Review tokens** — Centralized in `validateReviewToken()`. Checks expiry, permission flags. API routes verify version-session membership.
- ✅ **No credential leakage** — `createdById` derived from auth session in all upload routes. DEPRECATED comments document old field.

### 2. Data Integrity
- ✅ **Schema** — 28 migrations, sequential, with `IF EXISTS` guards where needed.
- ✅ **Atomic operations** — Turnover creation uses advisory locks via `create_turnover_atomic` RPC.
- ✅ **User ID consistency** — All queries use `auth_id` when looking up `public.users` from `auth.users.id`. Fixed in R3-01.
- ✅ **FK relationships** — Properly modeled (shots→sequences→projects, versions→shots, notes→versions, etc.)

### 3. Performance
- ✅ **No unbounded fetches** — Notes query filters by version IDs (fixed in R3-05). Users query limited to necessary columns with `limit(500)`.
- ✅ **Batch operations** — Source media imports use batched upserts (500 per batch). Turnover imports batch shot creation.
- ✅ **Pagination** — Source media API supports `limit`/`offset`. Shot listings bounded by project scope.

### 4. Code Quality
- ✅ **DRY** — `generateSignedUploadUrl` extracted to shared `src/lib/bunny.ts` (was duplicated 5x, fixed in R3-06).
- ✅ **No dead code** — `auth-utils.ts` deleted (R3-07). No other dead imports.
- ✅ **Consistent patterns** — All API routes follow `authenticateRequest() → requireRole() → getServiceClient()` pattern.
- ✅ **Error handling** — All API routes have try/catch with proper error responses.

### 5. UX / Functionality
- ✅ **Shot detail notes** — "Post" button wired up with database insert (R3-02).
- ✅ **Client portal actions** — Approve/Request Revision/Send feedback buttons all functional (R3-03).
- ✅ **Shot assignment** — Select persists changes to database (R3-04).
- ✅ **Vendor portal** — User lookup fixed to use `auth_id` (R3-01).
- ✅ **Artist invite** — VFX_VENDOR users can now invite artists to their own vendor (R4-01).

### 6. Build Health
- ✅ **TypeScript** — 0 errors, 0 warnings.
- ✅ **Next.js build** — Clean production build.

---

## Informational Notes (Not Findings)

These were reviewed and deemed acceptable:

1. **`src/lib/notifications.ts`** — Email/Slack notification utilities not yet imported. This is intentional scaffolding for upcoming notification features, not accidental dead code. Tree-shaken from builds.

2. **`console.log` statements** — A few debug logs exist in `turnover/page.tsx`, `shot-count-sheet.tsx`, and `turnover/import/route.ts`. These are useful for development debugging and don't affect production behavior (server logs are server-side only; client logs are minimal).

---

## Summary of All Rounds

| Round | Findings | Severity Breakdown |
|-------|----------|--------------------|
| R1 | 18 | 2 CRITICAL, 4 HIGH, 7 MEDIUM, 5 LOW |
| R2 | 11 | 1 CRITICAL, 3 HIGH, 4 MEDIUM, 3 LOW |
| R3 | 8 | 0 CRITICAL, 1 HIGH, 4 MEDIUM, 3 LOW |
| R4 | 2 | 0 CRITICAL, 0 HIGH, 1 MEDIUM, 1 LOW |
| **R5 (Final)** | **0** | **Clean** ✅ |

---

## Totals

- **Total iterations:** 5 (4 fix rounds + 1 final verification)
- **Total findings fixed:** 39
- **Final status:** ✅ **CLEAN — Production Ready**

---

## Architecture Highlights

The codebase demonstrates several solid patterns:

- **Dual-table version strategy** — `shot_versions` (new, rich schema) with transparent fallback to `versions` (legacy). All queries try `shot_versions` first.
- **Signed URL security** — Server-side SHA256 signing for both uploads and downloads. No raw credentials exposed to clients.
- **Role-based access control** — Clean hierarchy: ADMIN > SUPERVISOR/PRODUCER > COORDINATOR > ARTIST/VFX_EDITOR > VFX_VENDOR > CLIENT. Enforced at both middleware and API levels.
- **Token-based public review** — Public review sessions with granular permissions (`allow_comments`, `allow_approvals`, expiry). Comments validated against session membership.
- **Atomic turnover creation** — PostgreSQL advisory locks prevent race conditions on auto-incrementing turnover numbers.
- **File import pipeline** — Supports EDL, ALE, XML (FCPXML), CDL/CC, and FilmScribe XML with proper parsing and validation.
