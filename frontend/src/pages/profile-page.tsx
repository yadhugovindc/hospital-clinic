import { useState } from 'react';
import { useAuth } from '../app/auth-context';
import { authApi } from '../services';
import { Button, ErrorNote, Field, Input, PageHeader } from '../components/ui';
import { getApiError } from '../lib/api';
import { titleCase } from '../lib/format';

export default function ProfilePage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); setError(''); setFeedback('');
    if (newPassword !== confirmPassword) { setError('New password and confirmation do not match.'); return; }
    setSaving(true);
    try { await authApi.changePassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setFeedback('Password changed successfully.'); }
    catch (err) { setError(getApiError(err).message); }
    finally { setSaving(false); }
  };
  return <div>
    <PageHeader title="My profile" sub="Account details and security" />
    <div className="grid gap-5 lg:grid-cols-[minmax(240px,0.8fr)_minmax(360px,1.2fr)]">
      <section className="rounded-lg border border-gray-200 bg-white p-5"><h2 className="mb-4 text-sm font-semibold">Staff account</h2><dl className="space-y-4"><div><dt className="text-xs text-gray-500">Name</dt><dd className="mt-1 font-medium">{user?.name}</dd></div><div><dt className="text-xs text-gray-500">Email</dt><dd className="mt-1 font-medium">{user?.email}</dd></div><div><dt className="text-xs text-gray-500">Role</dt><dd className="mt-1 font-medium">{titleCase(user?.role)}</dd></div></dl></section>
      <section className="rounded-lg border border-gray-200 bg-white p-5"><h2 className="mb-4 text-sm font-semibold">Change password</h2>{error && <div className="mb-4"><ErrorNote message={error} /></div>}{feedback && <p className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">{feedback}</p>}<form className="space-y-4" onSubmit={(event) => void submit(event)}><Field label="Current password"><Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" /></Field><Field label="New password" hint="Use at least 8 characters"><Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} autoComplete="new-password" /></Field><Field label="Confirm new password"><Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" /></Field><Button type="submit" loading={saving}>Update password</Button></form></section>
    </div>
  </div>;
}