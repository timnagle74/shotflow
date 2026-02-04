# ShotFlow Code Review — Round 3

**Date:** 2026-02-04  
**Reviewer:** Stu (AI Code Review)  
**Scope:** Full codebase review (src/, supabase/migrations/, build health)  
**Previous rounds:** R1 (2026-02-03, 18 findings — all fixed), R2 (2026-02-04, 11 findings — all fixed)  
**Build status:** ✅ `npm run build` passes with 0 errors

---

## Executive Summary

The codebase is in **good shape** after two rounds of fixes. Auth patterns, RLS policies, signed URL handling, and the migration chain are all solid. This third pass found **8 findings** — none critical, 1 high, 4 medium, 3 low. The most impactful issues are non-functional UI buttons (notes, client approval) and a wrong column lookup in the vendor portal.

---

## Findings

### R3-01: Vendor Portal queries `public.users.id` with `auth.users.id` — **HIGH**

**File:** `src/app/(app)/vendor/page.tsx:193`

```ts
const { data: userData } = await (supabase as any)
  .from("users")
  .select("id, role, vendor_id")
  .eq("id", authUser.id)  // ← BUG: authUser.id is auth.users.id
  .single();
```

`authUser` comes from `useAuth()` which provides the Supabase auth user object. Its `.id` is `auth.users.id` (a UUID from Supabase Auth). But the query filters on `public.users.id`, which is a different column. This means the lookup will **fail for any user whose `public.users.id` differs from `auth.users.id`** — which is the common case when users are invited (the invite flow generates separate UUIDs).

**Impact:** Vendor portal is completely broken for invited vendor/artist users. They see "No vendor account linked" even when properly configured.

**Fix:** Change `.eq("id", authUser.id)` to `.eq("auth_id", authUser.id)`.

---

### R3-02: Shot detail "Post" note button has no onClick handler — **MEDIUM**

**File:** `src/app/(app)/shots/[id]/page.tsx:902`

```tsx
<Button className="self-end" disabled={!noteText.trim()}>Post</Button>
```

The "Post" button for adding notes to a version has no `onClick` handler. Users can type a note but clicking "Post" does nothing.

**Impact:** Notes cannot be created from the shot detail page. The UI is misleading.

**Fix:** Add an `onClick` handler that calls `supabase.from("notes").insert(...)` with the `version_id`, `author_id`, `content` (from `noteText`), and optionally `frame_reference`.

---

### R3-03: Client portal "Approve", "Request Revision", and "Send" buttons are non-functional — **MEDIUM**

**File:** `src/app/(app)/client/page.tsx:297-300, 390`

```tsx
<Button variant="outline" size="sm" ...>
  <RotateCcw />Request Revision
</Button>
<Button size="sm" className="bg-green-600 hover:bg-green-700">
  <Check />Approve
</Button>
```

None of these buttons have `onClick` handlers. Clients can view shots in `CLIENT_REVIEW` status but cannot approve or request revisions. The "Send" feedback button (line 390) is also missing its handler.

**Impact:** The entire client review workflow in the internal client portal is non-functional. Clients can only view, not act. (The public review page at `/review/[token]` **does** work correctly.)

**Fix:** Implement `onClick` handlers that call Supabase to update shot status and create note records.

---

### R3-04: Shot detail assignment select doesn't persist changes — **MEDIUM**

**File:** `src/app/(app)/shots/[id]/page.tsx:~835`

```tsx
<Select defaultValue={assignee?.id || ""}>
  <SelectTrigger><SelectValue placeholder="Assign artist" /></SelectTrigger>
  ...
</Select>
```

The assignment `<Select>` uses `defaultValue` but has no `onValueChange` handler. Selecting a different artist doesn't update the database.

**Impact:** Artists cannot be reassigned from the shot detail page. The select is cosmetic only.

**Fix:** Add `onValueChange` handler that calls `supabase.from("shots").update({ assigned_to_id })`.

---

### R3-05: Notes query fetches ALL notes without shot/version filter — **MEDIUM**

**File:** `src/app/(app)/shots/[id]/page.tsx:234-239`

```ts
const { data: notesData } = await supabase
  .from("notes")
  .select("*")
  .order("created_at", { ascending: true });
```

This fetches **every note in the database** regardless of which shot or version they belong to. The filtering happens client-side (`currentVersionNotes = notes.filter(n => n.version_id === selectedVersion)`). Similarly, the users query at line 246 fetches all users with `select("*")` and no limit.

**Impact:** As the database grows, this will fetch increasingly large payloads. With 100+ shots each having 5+ versions with notes, this could be thousands of rows fetched unnecessarily. Also leaks notes for other shots to the client.

**Fix:**
- Filter notes server-side: `.in("version_id", versionIds)` using the version IDs already fetched
- For users: `.select("id, name, email, role").limit(500)` (already done on dashboard/shots page but not here)

---

### R3-06: `generateSignedUploadUrl` duplicated across 5 API routes — **LOW**

**Files:**
- `src/app/api/versions/prepare-upload/route.ts:26`
- `src/app/api/refs/prepare-upload/route.ts:14`
- `src/app/api/plates/prepare-upload/route.ts:13`
- `src/app/api/turnover/upload-media/route.ts:16`
- `src/app/api/turnover/prepare-uploads/route.ts:13`

The identical `generateSignedUploadUrl` function is copy-pasted in 5 files. `src/lib/bunny.ts` already has `generateSignedStorageUrl` (for downloads) but no shared upload URL generator.

**Impact:** DRY violation. If the signing algorithm needs to change, it must be updated in 5 places. Risk of divergence.

**Fix:** Extract to `src/lib/bunny.ts` as `generateSignedUploadUrl` and import in all routes.

---

### R3-07: `auth-utils.ts` is dead code — **LOW**

**File:** `src/lib/auth-utils.ts`

This file exports `getDefaultRouteForRole`, `isInternalRole`, `isClientRole`, `INTERNAL_ONLY_ROUTES`, and `isInternalOnlyRoute`. However, **none of these are imported anywhere** in the codebase. The middleware and API routes use their own inline implementations of the same logic.

Additionally, `isInternalRole` in auth-utils considers VFX_VENDOR as internal (`return role !== 'CLIENT'`), while the actual `isInternal` in `src/lib/auth.ts` correctly excludes VFX_VENDOR. If someone accidentally imports from auth-utils, they'd get the wrong behavior.

**Impact:** Dead code that could confuse future developers or introduce bugs if imported.

**Fix:** Delete `src/lib/auth-utils.ts` or merge the useful parts into `src/lib/auth.ts`.

---

### R3-08: Thumbnail proxy doesn't validate videoId format — **LOW**

**File:** `src/app/api/thumbnail/[videoId]/route.ts`

```ts
const thumbnailUrl = `${BUNNY_STREAM_CDN}/${videoId}/thumbnail.jpg`;
const response = await fetch(thumbnailUrl);
```

The `videoId` parameter is used directly in a URL without format validation. While this is a public route (thumbnails), a malicious videoId like `../../admin` could potentially craft unexpected URLs (though Bunny's CDN would reject them).

**Impact:** Low risk — Bunny CDN validates requests on their end. But defense-in-depth suggests validating that videoId is a UUID/GUID format.

**Fix:** Add a simple format check: `if (!/^[a-f0-9-]{36}$/i.test(videoId)) return 400`.

---

## Non-Findings (Things That Are Good)

These areas were specifically reviewed and found to be **well-implemented**:

1. **Auth layer (`src/lib/auth.ts`)** — Solid pattern. Uses `getUser()` (not `getSession()`), looks up `public.users` via service role, returns typed `AuthUser`. All API routes use this consistently.

2. **Signed URL implementation** — Properly generates SHA256 tokens server-side. No raw API keys exposed to clients. Expiry is enforced. The upload-to-Bunny flow (prepare → upload → finalize) is secure.

3. **RLS policies** — Comprehensive coverage across all tables. Review sessions correctly allow public SELECT for token-based access. The `version_comments` table allows unauthenticated INSERT for public review flows (intentional and correct).

4. **Migration chain** — 27 migrations run sequentially. Uses `DO $$ BEGIN ... IF EXISTS` guards where needed. The atomic turnover creation RPC with advisory locks is a smart solution for race conditions.

5. **Middleware** — Correctly refreshes auth session, redirects based on role, handles public routes. Falls back to DB lookup when metadata is missing.

6. **createdById injection prevention** — All API routes correctly derive `createdById` from the auth session, ignoring any client-provided value. DEPRECATED comments make this clear.

7. **Source media search sanitization** — PostgREST filter injection is properly prevented by escaping special characters in `src/app/api/source-media/route.ts`.

8. **Review token validation** — Centralized in `validateReviewToken()`. Checks expiry, permission flags (`allow_comments`, `allow_approvals`). API routes verify version-session membership before allowing operations.

9. **Build health** — Clean build, 0 TypeScript errors, 0 warnings.

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 0 | — |
| HIGH | 1 | Vendor portal user lookup uses wrong column |
| MEDIUM | 4 | Non-functional UI buttons (notes, client approval, assignment), unbounded notes query |
| LOW | 3 | DRY violation (5x duplicated function), dead code file, minor input validation |
| **Total** | **8** | |

### Priority Recommendations

1. **Fix R3-01 immediately** — The vendor portal is broken for invited users. One-line fix.
2. **Wire up R3-02, R3-03, R3-04** — These are UX-blocking. The client portal and shot detail page have buttons that look functional but aren't. Medium effort.
3. **Fix R3-05 before scaling** — The unbounded notes fetch won't matter with 10 notes but will hurt at 1000+.
4. **R3-06, R3-07, R3-08** — Clean up at leisure. No user impact.

### Overall Assessment

The codebase is **production-ready with the HIGH fix applied**. The auth layer, API security, RLS policies, and signed URL handling are all solid. The remaining issues are primarily incomplete UI wiring — common in active development. The architecture is clean and well-structured.
