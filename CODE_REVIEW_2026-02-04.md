# ShotFlow Code Review — 2026-02-04

**Reviewer:** Automated (Claude)  
**Scope:** Full codebase review following fix of 18 findings from 2026-02-03 review  
**Build Status:** ✅ Clean (0 errors, 0 warnings)  
**Files Reviewed:** 101 TypeScript/TSX files, 25 SQL migrations, all API routes

---

## Executive Summary

The codebase is in **good shape** following today's fixes. The new `src/lib/auth.ts` module is solid — proper session validation via `getUser()`, role lookups via service client to avoid RLS self-lock, and clean separation between auth/admin/internal role checks. The Bunny signed URL implementation is correct and no raw credentials are exposed to clients.

However, the review uncovered **11 new findings** — 1 critical, 2 high, 5 medium, and 3 low. The most severe is a SQL injection vector in the source media search endpoint.

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 2 |
| MEDIUM | 5 |
| LOW | 3 |

---

## Findings

### 1. SQL Injection via Search Parameter in Source Media API
**Severity: CRITICAL**  
**File:** `src/app/api/source-media/route.ts:152`

```typescript
query = query.or(`clip_name.ilike.%${search}%,scene.ilike.%${search}%,camera.ilike.%${search}%`);
```

The `search` query parameter is interpolated directly into the Supabase `.or()` filter string without sanitization. An attacker could inject arbitrary filter logic (e.g., `search=foo%,id.neq.x)` to manipulate the query structure. While Supabase's PostgREST layer provides some protection, filter-string injection can still leak data or cause errors.

**Fix:** Use Supabase's parameterized filter methods instead:
```typescript
if (search) {
  const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
  query = query.or(
    `clip_name.ilike.%${escaped}%,scene.ilike.%${escaped}%,camera.ilike.%${escaped}%`
  );
}
```
Or better yet, use separate `.ilike()` calls with `.or()` on the query builder.

---

### 2. VFX Vendor Upload Blocked by Auth — `requireInternal` Excludes `VFX_VENDOR` Role
**Severity: HIGH**  
**Files:** `src/lib/auth.ts:29`, `src/app/api/versions/prepare-upload/route.ts`, `src/components/vendor-version-upload.tsx`

The `INTERNAL_ROLES` array in `auth.ts` is:
```typescript
const INTERNAL_ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR', 'PRODUCER', 'COORDINATOR', 'VFX_EDITOR', 'ARTIST'];
```

`VFX_VENDOR` is intentionally excluded. However, the `VendorVersionUpload` component calls `/api/versions/prepare-upload`, which uses `requireInternal()`. This means **vendors cannot upload versions** — the API will return 403.

The component has a fallback (catches the error and skips upload), but it then creates a `shot_versions` record with `created_by_id: "vendor"` (a hardcoded string, not a real user ID), which violates the FK constraint.

**Fix:** Either:
1. Create a separate vendor upload endpoint with `requireRole(user, ['VFX_VENDOR', 'ARTIST', ...])`, or
2. Add `VFX_VENDOR` to `INTERNAL_ROLES` (though this may grant too much access elsewhere), or
3. Create a `requireUploader` helper that includes vendor + internal roles.

---

### 3. RLS Missing on Four Tables
**Severity: HIGH**  
**Files:** `supabase/migrations/00006_delivery_specs.sql`, `00007_cdl_lut_management.sql`, `00008_ale_import.sql`

The following tables have **no RLS policies at all** (RLS is not even enabled):

| Table | Contains | Risk |
|-------|----------|------|
| `delivery_specs` | Project delivery specifications | Low sensitivity, but should be auth-gated |
| `lut_files` | LUT file records and paths | Contains file paths that could be used to access files |
| `shot_cdls` | Color Decision Lists per shot | Low sensitivity |
| `shot_metadata` | Rich camera/production metadata | Low sensitivity |

Without RLS, **any user with the anon key** (which is public via `NEXT_PUBLIC_SUPABASE_ANON_KEY`) can read/write these tables directly from the browser. The anon key is visible in client-side JavaScript.

**Fix:** Add a new migration enabling RLS on these four tables with authenticated-only read and internal-only write policies, matching the pattern in `20260204_rls_policies.sql`.

---

### 4. Review API Routes Not Using Centralized Auth Pattern
**Severity: MEDIUM**  
**Files:** `src/app/api/review/[token]/submit/route.ts`, `comment/route.ts`, `route.ts`

These three routes create a `createClient(supabaseUrl, supabaseServiceKey)` inline rather than using `getServiceClient()` from `auth.ts`. While functionally identical, this is inconsistent and means:
- If the auth pattern changes, these routes won't benefit
- The service key variable names must be kept in sync in multiple places

Additionally, the `submit` and `comment` routes accept a `token` parameter from the URL path. They properly validate the token against the database, but:
- The token lookup uses `.eq("access_token", token)` which is fine
- Session expiration is checked ✅
- Version-to-session binding is verified ✅ (fixed from previous review)

**Fix:** Refactor to use `getServiceClient()` from `auth.ts` for consistency.

---

### 5. `version_status_history` RLS Policies Regression
**Severity: MEDIUM**  
**File:** `supabase/migrations/20260204_rls_policies.sql`

The `version_status_history` table has RLS enabled (in `20260201_versioning.sql`), but the old permissive policy (`"Allow all for authenticated users"`) was **not replaced** in the `20260204_rls_policies.sql` migration. Unlike `turnovers` and `turnover_shots` where old policies are explicitly dropped and replaced, `version_status_history` still has `USING(true) WITH CHECK(true)`.

This means any authenticated user (including clients) can read all status history and insert arbitrary status change records.

**Fix:** Add to the RLS migration:
```sql
DROP POLICY IF EXISTS "Allow all for authenticated users" ON version_status_history;
CREATE POLICY "Authenticated users can read version_status_history"
  ON version_status_history FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Internal users can manage version_status_history"
  ON version_status_history FOR ALL
  USING (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
  ));
```

---

### 6. Middleware Makes a Database Query on Every Request
**Severity: MEDIUM**  
**File:** `src/middleware.ts:56-60`

For every authenticated request, the middleware queries the `users` table to get the user's role:
```typescript
const { data: userData } = await supabase
  .from("users")
  .select("role")
  .eq("auth_id", user.id)
  .single();
```

This adds latency to **every single page load and API call**. For static assets, the matcher already excludes them, but for all route navigations, this is an N+1 on every request.

**Fix:** Store the user role in Supabase auth metadata (already being done when role is updated in `/api/users/[id]`). Then read it from `user.user_metadata.role` in the middleware instead of making a DB query. Fall back to the DB query only if metadata is missing.

---

### 7. `listUsers()` Fetches All Auth Users for Email Lookup
**Severity: MEDIUM**  
**Files:** `src/app/api/vendors/invite/route.ts:92`, `vendors/[id]/artists/route.ts:81`, `users/invite/route.ts:29`

When checking if a user already exists, the code calls:
```typescript
const { data: existingUsers } = await adminClient.auth.admin.listUsers();
const existingAuth = existingUsers?.users?.find(u => u.email === email);
```

This fetches the **entire auth.users table** into memory just to check one email. For small deployments this is fine, but it will become a bottleneck at scale and could cause timeouts.

**Fix:** Use the Supabase admin API's built-in filter:
```typescript
const { data } = await adminClient.auth.admin.listUsers({ 
  filter: { email: email }
});
```
Or better, use `getUserByEmail()` if available in the Supabase version.

---

### 8. Unbounded Client-Side Data Fetches
**Severity: MEDIUM**  
**Files:** Multiple page components

Several pages fetch large datasets client-side with high limits:

| Page | Query | Limit |
|------|-------|-------|
| `dashboard/page.tsx` | shots | 5,000 |
| `projects/page.tsx` | shots | 5,000 |
| `client/page.tsx` | shot_versions | 5,000 |
| `client/page.tsx` | notes | 5,000 |
| `color/page.tsx` | shot_cdls, lut_files | unbounded (`select("*")`) |
| `users/page.tsx` | auth users | 10,000 |

This creates performance and memory issues as the app scales. The dashboard fetching 5,000 shots just to count statuses is especially wasteful.

**Fix:** 
- Use server-side RPC functions (like `get_source_media_stats`) for counts/aggregations
- Implement pagination on list pages
- Use `select('id, status')` instead of `select('*')` where only specific fields are needed

---

### 9. Duplicate Supabase Client Modules
**Severity: LOW**  
**Files:** `src/lib/supabase.ts`, `src/lib/supabase-auth.ts`, `src/lib/supabase-server.ts`

There are three separate Supabase client modules:
1. `supabase.ts` — Singleton browser client (legacy, exports `supabase` and `createServiceClient`)
2. `supabase-auth.ts` — Browser client factory (SSR-compatible, used by AuthProvider)
3. `supabase-server.ts` — Server-side client (cookies-based, used in server components)

Most pages import from `supabase.ts` (the singleton), while `AuthProvider` uses `supabase-auth.ts`. The `supabase.ts` singleton doesn't use `@supabase/ssr` and won't properly handle cookie-based sessions in some edge cases.

Additionally, `supabase.ts` exports a `createServiceClient()` function that's now redundant with `getServiceClient()` in `auth.ts`.

**Fix:** Consolidate to two clients: browser (from `supabase-auth.ts`) and server (from `supabase-server.ts`). Remove the legacy `supabase.ts` singleton over time.

---

### 10. Inconsistent `params` Pattern Across API Routes
**Severity: LOW**  
**Files:** Various API route handlers

Some routes use the Next.js 15 async params pattern:
```typescript
{ params }: { params: Promise<{ id: string }> }
// then: const { id } = await params;
```

While others use the sync pattern:
```typescript
{ params }: { params: { id: string } }
// then: const vendorId = params.id;
```

**Routes using async (Promise) params:** `thumbnail/[videoId]`, `versions/[id]/*`, `users/[id]`  
**Routes using sync params:** `vendors/[id]/artists`, `review/[token]/*`

This works in Next.js 14.2.21 (the current version) since both patterns are accepted, but will cause issues if only one pattern is supported in a future upgrade.

**Fix:** Standardize on one pattern. Since the app is on Next 14, use sync params consistently, or prepare for Next 15 by using async everywhere.

---

### 11. Hardcoded Bunny CDN URL in Thumbnail Route
**Severity: LOW**  
**File:** `src/app/api/thumbnail/[videoId]/route.ts:3`

```typescript
const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN || 'https://vz-3b0f7864-a89.b-cdn.net';
```

The fallback contains a real CDN URL hardcoded in the source. While the env var should always be set in production, having a real URL as a fallback means:
- It could accidentally be used in dev/staging
- The CDN identifier is exposed in the codebase

**Fix:** Remove the hardcoded fallback:
```typescript
const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN;
if (!BUNNY_STREAM_CDN) {
  return NextResponse.json({ error: 'CDN not configured' }, { status: 500 });
}
```

---

## Positive Findings (What's Working Well)

### Auth Layer (`src/lib/auth.ts`) ✅
- Uses `getUser()` (not `getSession()`) for auth validation — correct per Supabase security guidelines
- Separates auth ID from public user ID properly
- Uses service-role client for user lookups (avoids RLS chicken-and-egg issues)
- Clean `AuthUser` type with both `authId` and `userId`
- `requireAdmin`, `requireInternal`, `requireRole` helpers are well-designed

### Bunny Signed URLs ✅
- SHA256 hash with base64url encoding matches Bunny's token auth spec
- Expiry timestamps are properly computed
- Storage password is used only server-side (never exposed to client)
- The `generateSignedUploadUrl` functions in prepare-upload routes are correct
- Download URLs are generated on-demand with 1-hour expiry

### Atomic Turnover Creation (`create_turnover_atomic`) ✅
- Uses `pg_advisory_xact_lock` for serialization — prevents race conditions
- Lock is transaction-scoped (auto-released on commit/rollback)
- Returns structured data via `RETURNS TABLE`

### `get_source_media_stats` RPC ✅
- Marked as `STABLE` (correct for read-only functions)
- Uses aggregations server-side instead of fetching all rows
- Good pattern that should be replicated for dashboard stats

### RLS Policies ✅ (mostly)
- Proper `auth.role() = 'authenticated'` checks
- Admin-level operations properly gated to ADMIN/SUPERVISOR/PRODUCER
- Review sessions correctly allow public read (for token-based access)
- Internal-only write policies properly exclude CLIENT and VFX_VENDOR

### Middleware ✅
- Proper session refresh via cookie handling
- Role-based routing (client → `/client`, vendor → `/vendor`)
- Login page redirect for authenticated users (prevents confusion)
- Public routes properly exempted

### API Route Auth ✅ (except review routes)
- All non-review API routes use `authenticateRequest()` → `requireAdmin()`/`requireInternal()`
- `createdById` is derived from the auth session, not from client input (ignores deprecated `createdById` field)
- Version-to-session binding in review submit/comment endpoints prevents cross-session manipulation

---

## Build Health

```
✅ npm run build — SUCCESS
✅ 0 TypeScript errors
✅ 0 build warnings
✅ All routes compile (22 static, 8 dynamic)
✅ Middleware: 72.9 kB
```

---

## Recommendations (Prioritized)

1. **[CRITICAL]** Fix SQL injection in source-media search (Finding #1)
2. **[HIGH]** Fix vendor upload auth — vendors can't upload versions (Finding #2)
3. **[HIGH]** Add RLS to `delivery_specs`, `lut_files`, `shot_cdls`, `shot_metadata` (Finding #3)
4. **[MEDIUM]** Replace old permissive RLS on `version_status_history` (Finding #5)
5. **[MEDIUM]** Cache user role in middleware to avoid per-request DB query (Finding #6)
6. **[MEDIUM]** Replace `listUsers()` with filtered lookup (Finding #7)
7. **[MEDIUM]** Move dashboard/project stats to server-side aggregation (Finding #8)
8. **[LOW]** Consolidate Supabase client modules (Finding #9)
9. **[LOW]** Standardize params pattern across API routes (Finding #10)

---

*Review conducted on 2026-02-04. Previous review: 2026-02-03 (18 findings, all fixed).*
