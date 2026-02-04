# Code Review — ShotFlow — 2026-02-04 FINAL

## Status: ✅ CLEAN

## Summary
Full codebase review with fix-then-review loop completed. All findings from iteration 1 were fixed and verified in iteration 2.

---

## Iterations: 2

## Total Findings Fixed: 8

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | **CRITICAL** | 9 "Allow all for authenticated users" RLS policies bypassed role-based access on `artists`, `review_session_versions`, `review_sessions`, `shot_versions`, `turnover_refs`, `turnover_shot_refs`, `user_vendors`, `vendors`, `version_comments` | Dropped all 9 policies via migration + direct DB |
| 2 | **HIGH** | `turnover_policy` and `turnover_shots_policy` on `turnovers`/`turnover_shots` had `qual=true` with NO auth check — allowing unauthenticated anon-key access | Dropped both policies |
| 3 | **MEDIUM** | `get_next_turnover_number` function defined in TypeScript types but not in production DB | Removed from `database.types.ts` |
| 4 | **MEDIUM** | Hardcoded Bunny CDN URL `vz-3b0f7864-a89.b-cdn.net` in `video-player.tsx` and `shot-count-sheet.tsx` (3 occurrences) | Replaced with `process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN` |
| 5 | **LOW** | Dead code: `serializeCookie()` export in `supabase-server.ts` | Removed |
| 6 | **LOW** | `NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID` env var referenced in code but missing from `.env.example` | Added to `.env.example` |
| 7 | **LOW** | Hardcoded "3" notification badge in header with no backing notification system | Removed badge count |
| 8 | **LOW** | Migration file created to record RLS policy changes | `20260205_drop_bypass_rls_policies.sql` |

---

## Database Status
- **All 29 migration files applied** (28 existing + 1 new) ✓
- **25 tables** present with correct schema ✓
- **RLS enabled** on all tables ✓
- **Role-based policies** enforced on all tables ✓
- **No bypass policies** remaining ✓
- **Public review policies** (intentional `qual=true` for unauthenticated review) intact ✓
- **All FK constraints** intact ✓
- **All indexes** present ✓

## Build Status
`npm run build` — ✅ Passes clean
`npx tsc --noEmit` — ✅ No type errors

## Commits
1. `36de842` — fix: drop dangerous RLS bypass policies, remove dead code, fix hardcoded values
2. `7e0183a` — fix: remove remaining hardcoded Bunny CDN URLs in shot-count-sheet

## Architectural Notes (Not Bugs)
- Dual version tables (`versions` + `shot_versions`) exist. `versions` is used by internal upload/finalize flow; `shot_versions` by review/vendor/client flows. FKs differ. Working correctly but confusing. Recommend eventual consolidation.
- The "Anyone can read/update" policies on `review_session_versions`, `review_sessions`, `shot_versions`, and `version_comments` are intentional for the public token-based client review flow.
