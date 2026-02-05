import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { UserRole } from './database.types';

/**
 * Authenticated user info returned by auth helpers.
 */
export interface AuthUser {
  /** Supabase auth uid */
  authId: string;
  /** public.users.id (may differ from authId) */
  userId: string;
  email: string;
  role: UserRole;
}

/** Roles that count as "admin-level" (can manage users, projects, etc.) */
const ADMIN_ROLES: UserRole[] = ['ADMIN', 'VFX_SUPERVISOR', 'POST_SUPERVISOR', 'SUPERVISOR', 'PRODUCER'];

/** Roles that count as internal team members */
const INTERNAL_ROLES: UserRole[] = ['ADMIN', 'VFX_SUPERVISOR', 'POST_SUPERVISOR', 'SUPERVISOR', 'PRODUCER', 'COORDINATOR', 'VFX_EDITOR', 'ARTIST'];

/** Roles allowed to upload versions (internal + vendors) */
const UPLOAD_ROLES: UserRole[] = [...INTERNAL_ROLES, 'VFX_VENDOR'];

// ── helpers ──────────────────────────────────────────────────────────

export function isAdmin(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function isSupervisorOrAbove(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function isInternal(role: UserRole): boolean {
  return INTERNAL_ROLES.includes(role);
}

// ── core auth function ───────────────────────────────────────────────

/**
 * Authenticate the caller from the request cookies.
 * Returns `{ user }` on success or `{ error }` on failure.
 * 
 * Usage in a route handler:
 * ```ts
 * const auth = await authenticateRequest(req);
 * if (auth.error) return auth.error;
 * const { user } = auth;
 * ```
 */
export async function authenticateRequest(
  req: NextRequest,
): Promise<{ user: AuthUser; error?: never } | { user?: never; error: NextResponse }> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {
          // API routes don't need to set cookies
        },
      },
    },
  );

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // Look up the public.users row using a service-role client
  // (so RLS doesn't block us from reading the users table)
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: userData, error: userError } = await adminClient
    .from('users')
    .select('id, email, role')
    .eq('auth_id', authUser.id)
    .single();

  if (userError || !userData) {
    return {
      error: NextResponse.json({ error: 'User profile not found' }, { status: 403 }),
    };
  }

  return {
    user: {
      authId: authUser.id,
      userId: userData.id,
      email: userData.email,
      role: userData.role as UserRole,
    },
  };
}

/**
 * Require that the caller has one of the listed roles.
 * Returns a 403 NextResponse if not authorized, or null if OK.
 */
export function requireRole(user: AuthUser, allowedRoles: UserRole[]): NextResponse | null {
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { error: `Forbidden: requires one of ${allowedRoles.join(', ')}` },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Convenience: require admin-level role (ADMIN, SUPERVISOR, PRODUCER).
 */
export function requireAdmin(user: AuthUser): NextResponse | null {
  return requireRole(user, ADMIN_ROLES);
}

/**
 * Convenience: require a role that can upload (internal + VFX_VENDOR).
 */
export function requireUploader(user: AuthUser): NextResponse | null {
  if (!UPLOAD_ROLES.includes(user.role)) {
    return NextResponse.json(
      { error: 'Forbidden: upload access required' },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Convenience: require any internal role (not CLIENT or VFX_VENDOR).
 */
export function requireInternal(user: AuthUser): NextResponse | null {
  if (!isInternal(user.role)) {
    return NextResponse.json(
      { error: 'Forbidden: internal team access required' },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Validate a review session token. Returns the session data if valid,
 * or a NextResponse error if invalid/expired.
 * Used by public review routes that don't require user authentication.
 */
export async function validateReviewToken(
  token: string,
  options?: { requireComments?: boolean; requireApprovals?: boolean },
): Promise<
  { session: { id: string; allow_comments: boolean; allow_approvals: boolean; expires_at: string | null }; error?: never }
  | { session?: never; error: NextResponse }
> {
  const supabase = getServiceClient();

  const { data: session, error } = await supabase
    .from('review_sessions')
    .select('id, allow_comments, allow_approvals, expires_at')
    .eq('access_token', token)
    .single();

  if (error || !session) {
    return { error: NextResponse.json({ error: 'Session not found' }, { status: 404 }) };
  }

  if (session.expires_at && new Date(session.expires_at) < new Date()) {
    return { error: NextResponse.json({ error: 'Session expired' }, { status: 404 }) };
  }

  if (options?.requireApprovals && !session.allow_approvals) {
    return { error: NextResponse.json({ error: 'Approvals not allowed' }, { status: 403 }) };
  }

  if (options?.requireComments && !session.allow_comments) {
    return { error: NextResponse.json({ error: 'Comments not allowed' }, { status: 403 }) };
  }

  return { session };
}

/**
 * Get the service-role admin Supabase client (for use after auth is verified).
 */
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
