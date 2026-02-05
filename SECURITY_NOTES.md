# Security Notes — ShotFlow

## Intentional "Open" RLS Policies

The following tables have permissive RLS policies (`USING (true)`) by design to support the **public client review flow**:

| Table | Why Open |
|-------|----------|
| `review_sessions` | Clients access reviews via token URL without login |
| `review_session_versions` | Links versions to review sessions for token-based access |
| `shot_versions` | Clients can view/approve versions in review flow |
| `version_comments` | Clients can add comments during review |

**These are NOT bugs.** The public review feature requires unauthenticated read/write access scoped by review token validation in the API routes (`/api/review/[token]/*`).

### Token-Based Security Model
- Review sessions have a unique `token` (UUID)
- API routes validate the token before exposing data
- Only data linked to that session is accessible
- No login required — link sharing is the auth mechanism

---

## Route Protection Model

### Internal Routes (require internal team roles)
Protected by middleware + RLS:
- `/dashboard`, `/projects`, `/shots`, `/turnovers`, `/turnover/*`
- `/users`, `/source-media`, `/deliveries`, `/reviews`
- `/settings`, `/account`

### Vendor Routes
- `/vendor` — requires VFX_VENDOR or ARTIST role

### Client Routes  
- `/client` — requires CLIENT role
- `/review/[token]` — public, token-validated

### Public Routes
- `/login`, `/signup`, `/client-login`
- `/review/[token]` — client review via token

---

## Known Accepted Risks

1. **Public review links** — Anyone with the link can access. Mitigation: tokens are UUIDs, not guessable.
2. **Vendor self-management** — Vendors can manage their own artists. This is intentional.

---

*Last updated: 2026-02-04*
*Reviewed by: Codex + manual verification*
