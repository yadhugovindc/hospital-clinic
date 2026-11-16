import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { receptionApi, usersApi } from '../../services';
import { todayIso, titleCase } from '../../lib/format';
import { ConfirmDialog, EmptyRow, Field, Select, StatusBadge, Table, PageHeader, Pagination } from '../../components/ui';
import { getApiError } from '../../lib/api';
import type { Token } from '../../types';

const PAGE_SIZE = 25;

export default function TokensPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [page, setPage] = useState(1);
  const [confirmCancel, setConfirmCancel] = useState<Token | null>(null);
  const [actionError, setActionError] = useState('');

  const doctors = useQuery({ queryKey: ['doctors'], queryFn: usersApi.doctors });
  const tokens = useQuery({
    queryKey: ['tokens', date, status, doctorId, page],
    queryFn: () =>
      receptionApi.tokens({
        tokenDate: date || undefined,
        status: status || undefined,
        doctorId: doctorId || undefined,
        page,
        limit: PAGE_SIZE,
      }),
  });
  const counts = useQuery({ queryKey: ['token-counts', date], queryFn: () => receptionApi.tokenCounts(date || undefined) });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) => receptionApi.setTokenStatus(id, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tokens'] });
      void queryClient.invalidateQueries({ queryKey: ['token-counts'] });
      setActionError('');
    },
    onError: (err) => setActionError(getApiError(err).message),
  });

  const nextSteps = (t: Token): Array<{ value: string; label: string }> => {
    switch (t.status) {
      case 'waiting':
        return [
          { value: 'in_consultation', label: 'Start consultation' },
          { value: 'cancelled', label: 'Cancel' },
          { value: 'no_show', label: 'Mark no-show' },
        ];
      case 'in_consultation':
        return [
          { value: 'completed', label: 'Complete' },
          { value: 'cancelled', label: 'Cancel' },
        ];
      default:
        return [];
    }
  };

  return (
    <div>
      <PageHeader title="Token Queue" sub="Daily patient queue" />

      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <Field label="Date">
          <input type="date" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {['waiting', 'in_consultation', 'completed', 'cancelled', 'no_show'].map((s) => (
              <option key={s} value={s}>{titleCase(s)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Doctor">
          <Select value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setPage(1); }}>
            <option value="">All doctors</option>
            {(doctors.data?.doctors ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-3 items-end gap-2 text-center text-sm">
          <div className="rounded-md bg-blue-50 px-2 py-2"><span className="block text-xs text-gray-500">Waiting</span><b>{counts.data ? String(counts.data['waiting'] ?? 0) : '—'}</b></div>
          <div className="rounded-md bg-amber-50 px-2 py-2"><span className="block text-xs text-gray-500">In consult</span><b>{counts.data ? String(counts.data['inConsultation'] ?? 0) : '—'}</b></div>
          <div className="rounded-md bg-green-50 px-2 py-2"><span className="block text-xs text-gray-500">Completed</span><b>{counts.data ? String(counts.data['completed'] ?? 0) : '—'}</b></div>
        </div>
      </div>

      {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}

      <Table head={['#', 'Patient', 'Doctor', 'Status', 'Booked at', 'Actions']}>
        {(tokens.data?.tokens ?? []).length === 0 && <EmptyRow span={6} message="No tokens for this day/filter" />}
        {(tokens.data?.tokens ?? []).map((t) => {
          const p = t.patientId as Token['patientId'];
          return (
            <tr key={t._id} className="hover:bg-gray-50">
              <td className="px-4 py-2.5 font-semibold">{t.tokenNumber}</td>
              <td className="px-4 py-2.5">
                <span className="font-medium">{p.name}</span>
                <span className="ml-1 font-mono text-[11px] text-gray-500">{p.uhid}</span>
              </td>
              <td className="px-4 py-2.5">{(t.doctorId as { name?: string } | undefined)?.name ?? '—'}</td>
              <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
              <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(t.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {nextSteps(t).map((s) => (
                    <button
                      key={s.value}
                      className={`rounded border px-2 py-1 text-xs font-medium hover:bg-gray-50 ${s.value === 'cancelled' || s.value === 'no_show' ? 'border-red-200 text-red-600' : 'border-brand-200 text-brand-700'}`}
                      onClick={() => {
                        if (s.value === 'cancelled') {
                          setConfirmCancel(t);
                        } else {
                          setStatusMutation.mutate({ id: t._id, next: s.value });
                        }
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
      <Pagination page={page} limit={PAGE_SIZE} total={tokens.data?.total ?? 0} onPage={setPage} />

      <ConfirmDialog
        open={confirmCancel !== null}
        title="Cancel token?"
        message={`This will cancel token #${confirmCancel?.tokenNumber} for ${confirmCancel && (confirmCancel.patientId as Token['patientId']).name}. This cannot be undone.`}
        loading={setStatusMutation.isPending}
        onConfirm={() => {
          if (confirmCancel) setStatusMutation.mutate({ id: confirmCancel._id, next: 'cancelled' });
          setConfirmCancel(null);
        }}
        onCancel={() => setConfirmCancel(null)}
      />
    </div>
  );
}
