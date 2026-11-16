import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { clinicalApi } from '../../services';
import { EmptyRow, ErrorNote, Input, PageHeader, Pagination, Select, Spinner, StatusBadge, Table } from '../../components/ui';
import { getApiError } from '../../lib/api';
import { formatDate, todayIso } from '../../lib/format';

const PAGE_SIZE = 20;

export default function PrescriptionsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const visits = useQuery({ queryKey: ['doctor-visits', search, status, page], queryFn: () => clinicalApi.visits({ page, limit: PAGE_SIZE, status: status || undefined }) });
  const rows = (visits.data?.visits ?? []).filter((visit) => {
    const patient = visit.patientId as unknown as { name?: string; uhid?: string };
    return !search || `${patient.name ?? ''} ${patient.uhid ?? ''} ${visit.diagnosis ?? ''}`.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <PageHeader title="Consultations" sub="Review visits and continue clinical documentation" />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
        <label className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input className="pl-9" placeholder="Search patient, UHID, or diagnosis" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All visit statuses</option><option value="open">Open</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></Select>
      </div>
      {visits.isLoading ? <Spinner label="Loading consultations…" /> : visits.error ? <ErrorNote message={getApiError(visits.error).message} /> : <>
        <Table head={['Visit date', 'Patient', 'Reason / diagnosis', 'Status', 'Action']}>
          {rows.length === 0 && <EmptyRow span={5} message="No consultations match these filters" />}
          {rows.map((visit) => {
            const patient = visit.patientId as unknown as { name?: string; uhid?: string };
            return <tr key={visit._id} className="hover:bg-gray-50"><td className="px-4 py-3">{formatDate(visit.visitDate)}</td><td className="px-4 py-3"><span className="font-medium">{patient.name ?? 'Patient record'}</span><span className="ml-2 font-mono text-xs text-gray-500">{patient.uhid ?? ''}</span></td><td className="max-w-sm px-4 py-3 text-gray-600">{visit.chiefComplaints || visit.diagnosis || 'Not recorded'}</td><td className="px-4 py-3"><StatusBadge status={visit.status} /></td><td className="px-4 py-3"><Link className="font-medium text-brand-700 hover:underline" to={`/doctor/visits/${visit._id}/consultation`}>{visit.status === 'open' ? 'Continue' : 'Review'}</Link></td></tr>;
          })}
        </Table>
        <Pagination page={page} limit={PAGE_SIZE} total={visits.data?.total ?? 0} onPage={setPage} />
      </>}
      <p className="mt-3 text-xs text-gray-400">Business date: {todayIso()}</p>
    </div>
  );
}