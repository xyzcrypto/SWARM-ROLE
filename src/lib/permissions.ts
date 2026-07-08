// Granular staff capabilities. This catalog is the single source of truth - the
// dashboard checkboxes, the API validation and the server gates all key off it,
// so adding a new capability is a one-line change here (scalable by design).
//
// Client-safe: no server-only imports. "Super Admin" status (env ADMIN_EMAILS) is
// computed server-side and carried on the session as `isSuperAdmin`; a Super Admin
// (or the legacy `role === "ADMIN"`) holds every capability implicitly and can't be
// demoted.

export const PERMISSIONS = {
  "dashboard:view": "Access the admin dashboard",
  "post:publish": "Create & edit research posts",
  "post:manage": "Manage or delete any post",
  "users:manage": "View & manage members",
  "premium:manage": "Change members' Premium status",
  "whatsnew:manage": "Manage the What's New feed",
  "users:roles": "Grant staff roles & permissions",
  "ai:manage": "View AI usage & set members' AI limits",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(v: unknown): v is Permission {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PERMISSIONS, v);
}

export type Principal = {
  email?: string | null;
  role?: string | null;
  permissions?: string[] | null;
  isSuperAdmin?: boolean | null;
};

/** A Super Admin holds every capability and is the immutable root of access. */
export function isSuperAdmin(user: Principal | null | undefined): boolean {
  if (!user) return false;
  // The `isSuperAdmin` flag is set from ADMIN_EMAILS server-side; `role === "ADMIN"`
  // is the legacy equivalent (kept so existing admin sessions never lose access).
  return Boolean(user.isSuperAdmin) || user.role === "ADMIN";
}

/** True if the principal holds the given capability (Super Admins hold all). */
export function hasPermission(user: Principal | null | undefined, perm: Permission): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(perm);
}

/** Any staff access at all - Super Admin or at least one granted capability. */
export function isStaff(user: Principal | null | undefined): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return (user.permissions?.length ?? 0) > 0;
}

/** Keep only valid, de-duplicated capability strings from arbitrary input. */
export function sanitizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<Permission>();
  for (const v of input) if (isPermission(v)) out.add(v);
  return [...out];
}
