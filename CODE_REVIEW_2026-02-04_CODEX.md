# Code Review — ShotFlow — 2026-02-04 (Iteration 1)

## Summary
Full codebase review of the ShotFlow VFX pipeline management app. Build passes clean (Next.js 14 + Supabase + Bunny.net). Database migrations verified against production.

---

## Findings

### 1. CRITICAL — RLS "Allow All" Bypass Policies
**Tables affected:** `artists`, `review_session_versions`, `review_sessions`, `shot_versions`, `turnover_refs`, `turnover_shot_refs`, `user_vendors`, `vendors`, `version_comments`

Each of these tables has an `"Allow all for authenticated users"` policy with `qual = true AND with_check = true AND cmd = ALL`. Since PostgreSQL PERMISSIVE policies are OR'd, this completely bypasses the stricter role-based policies on the same table. A CLIENT or VFX_VENDOR user can insert/update/delete ANY row in these tables.

**Fix:** Drop these 9 overly permissive policies.

### 2. HIGH — Unauthenticated RLS Policies on `turnovers` and `turnover_shots`
The `turnover_policy` and `turnover_shots_policy` policies have `qual = true, with_check = true, cmd = ALL` with **no auth check at all**. Even the anon key can read/write/delete these tables directly.

**Fix:** Drop both policies.

### 3. MEDIUM — Phantom Function in TypeScript Types
`database.types.ts` defines `get_next_turnover_number` in the Functions section, but this function does not exist in the production database. Only `create_turnover_atomic` and `get_source_media_stats` exist. No code calls `get_next_turnover_number`.

**Fix:** Remove from type definitions.

### 4. MEDIUM — Hardcoded Bunny CDN Fallback URL
`src/components/video-player/video-player.tsx` contains a hardcoded production Bunny CDN URL: `https://vz-3b0f7864-a89.b-cdn.net`. If the env var is missing, this leaks a specific CDN endpoint and could break in other environments.

**Fix:** Remove the hardcoded fallback; use empty string like other components.

### 5. LOW — Dead Code: `serializeCookie` Export
`src/lib/supabase-server.ts` exports `serializeCookie()` which is never imported or used anywhere in the codebase.

**Fix:** Remove the dead function.

### 6. LOW — Missing Env Var in `.env.example`
`NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID` is referenced in `bunny-player.tsx` but not listed in `.env.example`.

**Fix:** Add to `.env.example`.

### 7. LOW — Hardcoded Notification Badge Count
`src/components/header.tsx` shows a hardcoded "3" notification badge. There's no actual notification system wired up.

**Fix:** Hide the badge count until a notification system exists.

---

## Database Migration Status
All 28 migration files have been applied to production. Schema matches code expectations:
- All 25 tables present ✓
- All 5 RPC functions present ✓ (except `get_next_turnover_number` which is only in types)
- All indexes present ✓
- RLS enabled on all tables ✓
- FK constraints intact ✓

## Build Status
`npm run build` — ✅ Passes clean (no TypeScript errors, no warnings)

## Notes
- Both `versions` and `shot_versions` tables exist. `versions` is used by the upload/finalize API routes and some pages; `shot_versions` is used by the review system, vendor portal, and client portal. FKs differ (`deliveries` → `versions`, `review_session_versions` → `shot_versions`). This works but is architecturally confusing. Not fixing in this iteration (large refactor).
- The "Anyone can read/update" policies on `review_session_versions`, `review_sessions`, `shot_versions`, and `version_comments` are **intentional** — needed for the unauthenticated client review flow (token-based). The API routes validate tokens server-side.
