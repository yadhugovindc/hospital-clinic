import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserRound } from 'lucide-react';
import { usersApi } from '../../services';
import type { Role, ServerUser } from '../../types';
import { Button, ErrorNote, Field, Input, Modal, PageHeader, Table, EmptyRow, Pagination, Select } from '../../components/ui';
import { getApiError } from '../../lib/api';

const roles: Role[] = ['admin', 'receptionist', 'doctor', 'pharmacist', 'therapist', 'accountant'];
const SIZE = 25;

export default function UsersPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const users = useQuery({ queryKey: ['users', search, role, page], queryFn: () => usersApi.list({ search: search || undefined, role, page, limit: SIZE }) });
  const create = useMutation({ mutationFn: (data: FormData) => usersApi.create({ email: String(data.get('email')), name: String(data.get('name')), password: String(data.get('password')), role: String(data.get('role')) }), onSuccess: () => { setOpen(false); setError(''); void client.invalidateQueries({ queryKey: ['users'] }); }, onError: (err) => setError(getApiError(err).message) });
  const status = useMutation({ mutationFn: (user: ServerUser) => usersApi.setStatus(user.id, !user.isActive), onSuccess: () => void client.invalidateQueries({ queryKey: ['users'] }), onError: (err) => setError(getApiError(err).message) });
  return <div>
    <PageHeader title="Staff accounts" sub="Manage clinic access by role" actions={<Button onClick={() => setOpen(true)}><Plus size={16} /> Add user</Button>} />
    {error && <div className="mb-4"><ErrorNote message={error} /></div>}
    <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]"><Input placeholder="Search staff name or email" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /><Select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option value="all">All roles</option>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</Select></div>
    {users.error ? <ErrorNote message={getApiError(users.error).message} /> : <>
      <Table head={['Staff member', 'Email', 'Role', 'Created', 'Status', '']}>
        {(users.data?.users ?? []).length === 0 && <EmptyRow span={6} message="No staff accounts found" />}
        {(users.data?.users ?? []).map((user) => <tr key={user.id} className="hover:bg-gray-50"><td className="px-4 py-3"><span className="inline-flex items-center gap-2 font-medium"><UserRound size={15} className="text-gray-400" />{user.name}</span></td><td className="px-4 py-3">{user.email}</td><td className="px-4 py-3 capitalize">{user.role}</td><td className="px-4 py-3">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td><td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs ${user.isActive ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{user.isActive ? 'Active' : 'Disabled'}</span></td><td className="px-4 py-3 text-right"><Button variant="secondary" className="px-2.5 py-1.5 text-xs" loading={status.isPending} onClick={() => status.mutate(user)}>{user.isActive ? 'Disable' : 'Enable'}</Button></td></tr>)}
      </Table><Pagination page={page} limit={SIZE} total={users.data?.total ?? 0} onPage={setPage} />
    </>}
    <Modal open={open} title="Create staff account" onClose={() => setOpen(false)}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setError(''); create.mutate(new FormData(event.currentTarget)); }}>
        <Field label="Full name *"><Input name="name" required minLength={2} /></Field><Field label="Email *"><Input name="email" type="email" required /></Field><Field label="Temporary password *" hint="At least 8 characters"><Input name="password" type="password" required minLength={8} autoComplete="new-password" /></Field><Field label="Role"><Select name="role">{roles.filter((item) => item !== 'admin').map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
        <div className="flex justify-end"><Button type="submit" loading={create.isPending}>Create account</Button></div>
      </form>
    </Modal>
  </div>;
}