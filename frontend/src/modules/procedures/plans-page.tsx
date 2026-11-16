import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { proceduresApi, receptionApi, usersApi } from '../../services';
import { useAuth } from '../../app/auth-context';
import { Button, ErrorNote, Field, Input, Modal, PageHeader, Table, EmptyRow, Pagination, StatusBadge, Select } from '../../components/ui';
import { getApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';

const SIZE = 20;

export default function PlansPage() {
  const client = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('active');
  const [open, setOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientId, setPatientId] = useState('');
  const [error, setError] = useState('');
  const plans = useQuery({ queryKey: ['procedure-plans', page, status, user?.role], queryFn: () => proceduresApi.plans({ page, limit: SIZE, status: status || undefined, therapistId: user?.role === 'therapist' ? user.id : undefined }) });
  const catalog = useQuery({ queryKey: ['procedure-catalog'], queryFn: () => proceduresApi.catalog() });
  const therapists = useQuery({ queryKey: ['therapists'], queryFn: usersApi.therapists });
  const patients = useQuery({ queryKey: ['plan-patient-search', patientSearch], queryFn: () => receptionApi.searchPatients({ name: patientSearch, limit: 8 }), enabled: patientSearch.trim().length >= 2 });
  const create = useMutation({
    mutationFn: (data: FormData) => proceduresApi.createPlan({ patientId, startDate: String(data.get('startDate')), endDate: String(data.get('endDate') || '') || undefined, assignedTherapistId: String(data.get('therapistId') || '') || undefined, notes: String(data.get('notes') || '') || undefined, items: [{ procedureId: String(data.get('procedureId')), sessionsPlanned: Number(data.get('sessionsPlanned')) }] }),
    onSuccess: () => { setOpen(false); setError(''); setPatientId(''); setPatientSearch(''); void client.invalidateQueries({ queryKey: ['procedure-plans'] }); },
    onError: (err) => setError(getApiError(err).message),
  });
  return <div>
    <PageHeader title="Therapy plans" sub="Prescribed course plans and assigned care" actions={<Button onClick={() => setOpen(true)}><Plus size={16} /> New plan</Button>} />
    {error && <div className="mb-4"><ErrorNote message={error} /></div>}
    <div className="mb-4 flex justify-end"><Select className="max-w-48" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="active">Active plans</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="">All plans</option></Select></div>
    {plans.error ? <ErrorNote message={getApiError(plans.error).message} /> : <>
      <Table head={['Plan', 'Patient', 'Start date', 'Procedures', 'Progress', 'Status']}>
        {(plans.data?.plans ?? []).length === 0 && <EmptyRow span={6} message="No therapy plans found" />}
        {(plans.data?.plans ?? []).map((plan) => { const patient = typeof plan.patientId === 'string' ? { name: plan.patientId, uhid: plan.uhidSnapshot ?? '' } : plan.patientId; const total = plan.items.reduce((sum, item) => sum + item.sessionsPlanned, 0); const done = plan.items.reduce((sum, item) => sum + item.sessionsCompleted, 0); return <tr key={plan._id} className="hover:bg-gray-50"><td className="px-4 py-3 font-mono text-xs">{plan.planNumber}</td><td className="px-4 py-3"><span className="font-medium">{patient.name}</span><span className="ml-2 font-mono text-xs text-gray-500">{patient.uhid}</span></td><td className="px-4 py-3">{formatDate(plan.startDate)}</td><td className="px-4 py-3">{plan.items.map((item) => item.nameSnapshot).join(', ')}</td><td className="px-4 py-3">{done} / {total} sessions</td><td className="px-4 py-3"><StatusBadge status={plan.status} /></td></tr>; })}
      </Table><Pagination page={page} limit={SIZE} total={plans.data?.total ?? 0} onPage={setPage} />
    </>}
    <Modal open={open} title="Create therapy plan" onClose={() => setOpen(false)} wide>
      <div className="space-y-4">
        <Field label="Find patient"><Input value={patientSearch} onChange={(event) => { setPatientSearch(event.target.value); setPatientId(''); }} placeholder="Search patient name" /></Field>
        {patientSearch.length >= 2 && <div className="max-h-32 overflow-auto rounded border border-gray-200">{(patients.data?.patients ?? []).map((patient) => <button key={patient._id} type="button" className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-brand-50" onClick={() => { setPatientId(patient._id); setPatientSearch(`${patient.name} · ${patient.uhid}`); }}>{patient.name} · {patient.uhid}</button>)}</div>}
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setError(''); create.mutate(new FormData(event.currentTarget)); }}>
          <Field label="Procedure *"><Select name="procedureId" required defaultValue=""><option value="" disabled>Select procedure</option>{(catalog.data ?? []).map((procedure) => <option key={procedure._id} value={procedure._id}>{procedure.name}</option>)}</Select></Field>
          <Field label="Sessions planned *"><Input name="sessionsPlanned" type="number" min="1" max="60" required defaultValue="10" /></Field>
          <Field label="Start date *"><Input name="startDate" type="date" required /></Field><Field label="End date"><Input name="endDate" type="date" /></Field>
          <Field label="Assigned therapist"><Select name="therapistId" defaultValue=""><option value="">Unassigned</option>{(therapists.data?.therapists ?? []).map((therapist) => <option key={therapist.id} value={therapist.id}>{therapist.name}</option>)}</Select></Field>
          <Field label="Notes"><Input name="notes" /></Field>
          <div className="sm:col-span-2 flex justify-end"><Button type="submit" disabled={!patientId} loading={create.isPending}>Create plan</Button></div>
        </form>
      </div>
    </Modal>
  </div>;
}