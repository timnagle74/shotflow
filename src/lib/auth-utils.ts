import type { UserRole } from './database.types';

/**
 * Get the default landing page for a given user role.
 */
export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case 'CLIENT':
      return '/client';
    case 'ADMIN':
    case 'SUPERVISOR':
    case 'PRODUCER':
    case 'COORDINATOR':
    case 'ARTIST':
    case 'VFX_VENDOR':
    default:
      return '/dashboard';
  }
}

/**
 * Check if a user role is considered an internal/team role.
 */
export function isInternalRole(role: UserRole): boolean {
  return role !== 'CLIENT';
}

/**
 * Check if a user role is a client role.
 */
export function isClientRole(role: UserRole): boolean {
  return role === 'CLIENT';
}

/**
 * Protected routes that require specific roles.
 * Clients can only access /client routes.
 * Internal users can access everything.
 */
export const INTERNAL_ONLY_ROUTES = [
  '/dashboard',
  '/projects',
  '/shots',
  '/artists',
  '/vendors',
  '/deliverables',
  '/settings',
];

/**
 * Check if a path is an internal-only route (not for clients).
 */
export function isInternalOnlyRoute(pathname: string): boolean {
  return INTERNAL_ONLY_ROUTES.some(route => pathname.startsWith(route));
}
