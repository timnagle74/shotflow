# ShotFlow Full Code Review — February 3, 2026
## Performed by Codex (gpt-5.2-codex) + Stu

## CRITICAL

### 1) Privileged API endpoints use service-role DB access with no authorization checks
- Impact: any authenticated app user can invoke admin-grade operations (user invites, role changes, vendor creation, turnover imports, file metadata writes, signed download generation) because routes instantiate service-role clients and do not verify caller role/ownership.
- Files: All 18 API route files in `src/app/api/`

### 2) Long-lived Bunny credentials are exposed to clients from multiple API responses
- Impact: storage/stream master keys can be extracted and reused outside intended flows.
- Files: `plates/prepare-upload`, `refs/prepare-upload`, `turnover/prepare-uploads`, `turnover/upload-media`, `versions/prepare-upload`

### 3) Review token submit path can update arbitrary versions outside the session
- Impact: possession of one valid review token allows modifying unrelated `shot_versions` status.
- Files: `src/app/api/review/[token]/submit/route.ts:61-68`, `comment/route.ts:42-51`

### 4) RLS posture is unsafe: permissive `USING (true)` policies + many core tables without RLS
- Impact: data isolation depends entirely on app code; DB-layer protections are weak/inconsistent.
- Core tables (`users`, `projects`, `shots`, `versions`, `source_media`) have no RLS at all.

### 5) Migration chain is broken: `turnovers` table is created twice
- Impact: fresh migration runs can fail on duplicate table creation.
- Files: `00001_initial_schema.sql:99-107` and `20260131_turnovers.sql:2-30`

---

## HIGH

### 6) Public review flow is blocked by middleware route gating ✅ FIXED
- Impact: tokenized client review links redirect unauthenticated users to login.
- Fix: Added `/review` and `/api/review` to public routes in middleware.

### 7) `users.id` vs `auth.users.id` identity model is inconsistent across code paths
- Impact: role updates/deletes and vendor portal lookups can target wrong IDs or fail silently.

### 8) Vendor APIs are incompatible with current schema
- Impact: vendor/artist invite workflows can fail at runtime (missing `project_id`, no `artists.user_id` column).

### 9) Creator identity is client-controlled and incorrectly sourced
- Impact: forged attribution / bad FK data in version records. UI uses assignee instead of current user.

### 10) Turnover import is race-prone and non-transactional
- Impact: duplicate turnover number conflicts and partial writes under failures/concurrency.

---

## MEDIUM

### 11) Generated DB typings are stale vs schema, forcing broad `any` usage
- Impact: weak compile-time guarantees, higher runtime breakage risk.

### 12) Dual version models (`versions` vs `shot_versions`) are inconsistently used
- Impact: different screens show different truth, review/status logic diverges.

### 13) Over-broad client queries pull entire datasets then filter in memory
- Impact: scale/perf degradation as data grows.

### 14) N+1 query patterns in list views
- Impact: response time grows linearly with row count (turnovers page, users page).

### 15) RPC dependency missing from migrations
- Impact: `get_source_media_stats` function not in migrations, fails on fresh DB.

### 16) Review UI shows wrong comments set due to broken filter ✅ FIXED
- Impact: comments from other versions appear in current version sidebar.

---

## LOW

### 17) Delivery specs editing is non-functional
- Impact: misleading UI; save button only closes dialog, no persistence.

### 18) Dead code path in ref upload ✅ FIXED
- Impact: confusing maintenance; unused `streamUploadUrl` and incomplete stream-upload code.
