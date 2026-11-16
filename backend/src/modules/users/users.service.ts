import bcrypt from 'bcrypt';
import { isValidObjectId, Types } from 'mongoose';
import { User, type UserDoc } from '../../database/models/user.model.js';
import { recordAudit } from '../../database/models/audit-log.model.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/api-error.js';
import { roleHasPermission, type Role } from '../../shared/utils/rbac.js';

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

function safeUser(user: UserDoc): SafeUser {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function listUsers(opts: { page: number; limit: number; role?: Role | 'all'; search?: string }): Promise<{
  users: SafeUser[];
  total: number;
  page: number;
  limit: number;
}> {
  const filter: Record<string, unknown> = {};
  if (opts.role && opts.role !== 'all') filter.role = opts.role;
  if (opts.search) {
    const rx = new RegExp(opts.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((opts.page - 1) * opts.limit).limit(opts.limit),
    User.countDocuments(filter),
  ]);
  return { users: users.map(safeUser), total, page: opts.page, limit: opts.limit };
}

export async function listDoctors(): Promise<SafeUser[]> {
  const doctors = await User.find({ role: 'doctor', isActive: true }, { name: 1, email: 1, role: 1 });
  return doctors.map(safeUser);
}

export async function listTherapists(): Promise<SafeUser[]> {
  const therapists = await User.find({ role: 'therapist', isActive: true }, { name: 1, email: 1, role: 1 });
  return therapists.map(safeUser);
}

export async function createUser(
  input: { email: string; name: string; password: string; role: Role },
  actorId: string,
): Promise<SafeUser> {
  const email = input.email.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) throw new BadRequestError('A user with this email already exists');

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({ email, name: input.name.trim(), passwordHash, role: input.role, isActive: true });
  recordAudit({
    actorId: new Types.ObjectId(actorId) as never,
    action: 'user.create',
    entityType: 'User',
    entityId: String(user._id),
    after: { email: user.email, role: user.role, name: user.name },
  } as never);
  return safeUser(user);
}

export async function updateUser(
  id: string,
  input: { name?: string; role?: Role; password?: string },
  actorId: string,
): Promise<SafeUser> {
  const user = await getValidId(id);
  if (input.name !== undefined) user.name = input.name.trim();
  if (input.role !== undefined) user.role = input.role;
  if (input.password !== undefined) {
    if (input.password.length < 8) throw new BadRequestError('Password must be at least 8 characters');
    user.passwordHash = await bcrypt.hash(input.password, 12);
  }
  await user.save();
  recordAudit({
    actorId: new Types.ObjectId(actorId) as never,
    action: 'user.update',
    entityType: 'User',
    entityId: String(user._id),
    after: { name: user.name, role: user.role },
  } as never);
  return safeUser(user);
}

export async function setUserStatus(
  id: string,
  isActive: boolean,
  actorId: string,
  actorRole: Role,
): Promise<SafeUser> {
  const user = await getValidId(id);
  if (String(user._id) === actorId && !isActive) {
    throw new BadRequestError('You cannot deactivate your own account');
  }
  if (actorRole === 'admin' && user.role === 'admin' && !isActive) {
    const activeAdmins = await User.countDocuments({ role: 'admin', isActive: true, _id: { $ne: user._id } });
    if (activeAdmins === 0) throw new BadRequestError('Cannot deactivate the last active admin');
  }
  user.isActive = isActive;
  await user.save();
  recordAudit({
    actorId: new Types.ObjectId(actorId) as never,
    action: isActive ? 'user.activate' : 'user.deactivate',
    entityType: 'User',
    entityId: String(user._id),
    after: { isActive },
  } as never);
  return safeUser(user);
}

/** Effective permissions for a role — read-only utility for UI menu construction. */
export function rolePermissions(role: Role): string[] {
  const all: string[] = [];
  for (const p of [
    'admin:manage', 'users:read', 'users:write', 'clinic:read', 'clinic:write', 'audit:read',
    'patients:read', 'patients:write', 'tokens:read', 'tokens:write', 'clinical:read', 'clinical:write',
    'pharmacy:read', 'pharmacy:write', 'procedures:read', 'procedures:write', 'accounts:read', 'accounts:write',
    'reports:read', 'dashboard:read',
  ] as const) {
    if (roleHasPermission(role, p)) all.push(p);
  }
  return all;
}

async function getValidId(id: string) {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid user id');
  const user = await User.findById(id);
  if (!user) throw new NotFoundError('User not found');
  return user;
}
