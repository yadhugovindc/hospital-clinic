export type Role = 'admin' | 'receptionist' | 'doctor' | 'pharmacist' | 'therapist' | 'accountant';

export const ROLES: readonly Role[] = ['admin', 'receptionist', 'doctor', 'pharmacist', 'therapist', 'accountant'] as const;

export const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value);

/**
 * Central permission matrix. Modules map to permission strings that are checked
 * in routes via `requirePermission(...)`.
 */
export type Permission =
  | 'admin:manage'
  | 'users:read'
  | 'users:write'
  | 'clinic:read'
  | 'clinic:write'
  | 'audit:read'
  | 'patients:read'
  | 'patients:write'
  | 'tokens:read'
  | 'tokens:write'
  | 'clinical:read'
  | 'clinical:write'
  | 'pharmacy:read'
  | 'pharmacy:write'
  | 'procedures:read'
  | 'procedures:write'
  | 'procedure-bills:write'
  | 'accounts:read'
  | 'accounts:write'
  | 'reports:read'
  | 'dashboard:read';

const ADMIN = (): Permission[] => [
  'users:read', 'users:write', 'clinic:read', 'clinic:write', 'audit:read',
  'patients:read', 'patients:write', 'tokens:read', 'tokens:write',
  'clinical:read', 'clinical:write', 'pharmacy:read', 'pharmacy:write',
  'procedures:read', 'procedures:write', 'procedure-bills:write', 'accounts:read', 'accounts:write',
  'reports:read', 'dashboard:read',
];

const RECEPTIONIST = (): Permission[] => [
  'dashboard:read', 'patients:read', 'patients:write', 'tokens:read', 'tokens:write',
];

const DOCTOR = (): Permission[] => [
  'dashboard:read', 'patients:read', 'clinical:read', 'clinical:write',
  'procedures:read', 'procedures:write',
];

const PHARMACIST = (): Permission[] => ['dashboard:read', 'pharmacy:read', 'pharmacy:write', 'patients:read'];

const THERAPIST = (): Permission[] => ['dashboard:read', 'procedures:read', 'procedures:write', 'patients:read'];

const ACCOUNTANT = (): Permission[] => [
  'dashboard:read', 'accounts:read', 'accounts:write', 'reports:read', 'patients:read',
  'procedures:read', 'procedure-bills:write',
];

export const ROLE_PERMISSIONS: Record<Role, () => Permission[]> = {
  admin: ADMIN,
  receptionist: RECEPTIONIST,
  doctor: DOCTOR,
  pharmacist: PHARMACIST,
  therapist: THERAPIST,
  accountant: ACCOUNTANT,
};

export const roleHasPermission = (role: Role, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role]().includes(permission);
