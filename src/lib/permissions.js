/**
 * Centralized permission system
 * All role checks must go through canAccess() — never check role directly
 */

const permissions = {
  admin: [
    'admin.dashboard',
    'admin.pos',
    'admin.members',
    'admin.calendar',
    'admin.bookings',
    'admin.products',
    'admin.tournaments',
    'admin.formulas',
    'admin.settings',
    'admin.financial-export',
    'user.dashboard',
    'user.booking',
    'user.profile',
    'user.tournaments',
    'user.social',
    'user.events',
  ],
  user: [
    'user.dashboard',
    'user.booking',
    'user.profile',
    'user.tournaments',
    'user.social',
    'user.events',
  ],
}

export function canAccess(role, feature) {
  return permissions[role]?.includes(feature) ?? false
}

export function isAdmin(role) {
  return role === 'admin'
}

export function getRedirectAfterLogin(role) {
  return role === 'admin' ? '/admin' : '/dashboard'
}
