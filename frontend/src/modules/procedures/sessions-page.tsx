import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { proceduresApi } from '../../services';
import { useAuth } from '../../app/auth-context';
import { Button, ErrorNote, Field, Input, PageHeader, Select, StatusBadge, Table, EmptyRow, Pagination } from '../../components/ui';
import { getApiError } from '../../lib/api';
import { formatDate, todayIso } from '../../lib/format';

const SIZE = 25;

export default function SessionsPage() {
  const client = useQueryClient();
  const { user } = useAuth();
  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const sessions = useQuery({ queryKey: ['therapy-sessions', date, status, page, user?.role], queryFn: () => proceduresApi.sessions({ scheduledDate: date || undefined, status: status || undefined, therapistId: user?.role === 'therapist' ? user.id : undefined, page, limit: SIZE }) });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: string; scheduledDate?: string; notes?: string } }) => proceduresApi.updateSession(id, data),
    onSuccess: () => { setError(''); void client.invalidateQueries({ queryKey: ['therapy-sessions'] }); },
    onError: (err) => setError(getApiError(err).message),
  });
  return <div>
    <PageHeader title="Therapy sessions" sub="Schedule and record each delivered treatment" />
    {error && <div className="mb-4"><ErrorNote message={error} /></div>}
    <div className="mb-4 grid gap-3 sm:grid-cols-[220px_220px_1fr]"><Field label="Scheduled date"><Input type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); }} /></Field><Field label="Status"><Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{['scheduled', 'completed', 'cancelled', 'missed', 'rescheduled'].map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field></div>
    {sessions.error ? <ErrorNote message={getApiError(sessions.error).message} /> : <>
      <Table head={['Patient', 'Treatment', 'Session', 'Date', 'Therapist', 'Status', 'Notes / update']}>
        {(sessions.data?.sessions ?? []).length === 0 && <EmptyRow span={7} message="No sessions for this date and filter" />}
        {(sessions.data?.sessions ?? []).map((session) => { const patient = typeof session.patientId === 'string' ? { name: session.patientId, uhid: '' } : session.patientId; const therapist = typeof session.assignedTherapistId === 'string' ? '' : session.assignedTherapistId?.name ?? ''; return <tr key={session._id} className="align-top hover:bg-gray-50"><td className="px-4 py-3"><span className="font-medium">{patient.name}</span><span className="block font-mono text-xs text-gray-500">{patient.uhid}</span></td><td className="px-4 py-3">{session.procedureNameSnapshot}</td><td className="px-4 py-3">#{session.sessionIndex}</td><td className="px-4 py-3">{formatDate(session.scheduledDate)}</td><td className="px-4 py-3">{therapist || 'Unassigned'}</td><td className="px-4 py-3"><StatusBadge status={session.status} /></td><td className="min-w-56 px-4 py-3"><div className="flex gap-2"><Input aria-label="Session note" placeholder={session.notes || 'Add note'} value={notes[session._id] ?? ''} onChange={(event) => setNotes({ ...notes, [session._id]: event.target.value })} /><Select aria-label="Update session status" defaultValue={session.status} onChange={(event) => update.mutate({ id: session._id, data: { status: event.target.value } })}>{['scheduled', 'completed', 'cancelled', 'missed', 'rescheduled'].map((value) => <option key={value} value={value}>{value}</option>)}</Select><Button className="px-2 py-1.5" variant="secondary" onClick={() => update.mutate({ id: session._id, data: { notes: notes[session._id] ?? session.notes ?? '' } })}>Save</Button></div></td></tr>; })}
      </Table><Pagination page={page} limit={SIZE} total={sessions.data?.total ?? 0} onPage={setPage} />
    </>}
  </div>;
}