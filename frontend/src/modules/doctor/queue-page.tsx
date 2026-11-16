import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clinicalApi } from '../../services';
import { formatDate, todayIso } from '../../lib/format';
import { Button, EmptyRow, Table, PageHeader, StatCard, Pagination, StatusBadge } from '../../components/ui';
import { getApiError } from '../../lib/api';

const PAGE_SIZE = 20;

export default function DoctorQueue() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const visits = useQuery({
    queryKey: ['queue', status, page],
    queryFn: () =>
      clinicalApi.visits({
        visitDate: todayIso(),
        status: status ?? undefined,
        page,
        limit: PAGE_SIZE,
      }),
  });

  if (visits.isLoading) return <PageHeader title="Queue" sub="Loading today's queue…" />;
  if (visits.error) return <div><p className="text-sm text-red-600">{getApiError(visits.error).message}</p></div>;

  return (
    <div>
      <PageHeader title="My Queue" sub={`Today's queue for ${formatDate(todayIso())}`} />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Pending" value={visits.data?.visits.filter((v) => v.status === 'open').length ?? 0} />
        <StatCard label="Completed" value={visits.data?.visits.filter((v) => v.status === 'completed').length ?? 0} />
        <StatCard label="Cancelled" value={visits.data?.visits.filter((v) => v.status === 'cancelled').length ?? 0} />
        <StatCard label="Today" value={visits.data?.total ?? 0} />
      </div>

      <div className="mb-4 flex gap-2">
        <Button
          variant={status === 'open' ? 'primary' : 'secondary'}
          onClick={() => setStatus('open')}
        >
          Pending
        </Button>
        <Button
          variant={status === 'completed' ? 'primary' : 'secondary'}
          onClick={() => setStatus('completed')}
        >
          Completed
        </Button>
        <Button
          variant={status === 'cancelled' ? 'primary' : 'secondary'}
          onClick={() => setStatus('cancelled')}
        >
          Cancelled
        </Button>
        <Button
          variant={status === '' ? 'primary' : 'secondary'}
          onClick={() => { setStatus(''); setPage(1); }}
        >
          All
        </Button>
      </div>

      <Table head={['Date', 'Patient', 'Status', 'Doctor', 'Actions']}>
        {visits.data?.visits.length === 0 && <EmptyRow span={5} message="No visits" />}
        {visits.data?.visits.map((v) => (
          <tr key={v._id}>
            <td className="px-4 py-2.5 text-sm">{formatDate(v.visitDate)}</td>
            <td className="px-4 py-2.5">
              <div>
                <Link to={`/doctor/visits/${v._id}/consultation`} className="font-medium text-brand-700 hover:underline">
                  {(v as { patientId: { name?: string } }).patientId?.name ?? '—'}
                </Link>
                <div className="text-xs text-gray-500">
                  {(v as { patientId: { uhid?: string } }).patientId?.uhid ?? '—'}
                </div>
              </div>
            </td>
            <td className="px-4 py-2.5"><StatusBadge status={v.status} /></td>
            <td className="px-4 py-2.5 text-xs text-gray-500"><DoctorName /></td>
            <td className="px-4 py-2.5">
              <Link to={`/doctor/visits/${v._id}/consultation`}>
                <Button variant="secondary" className="text-xs">Consultation</Button>
              </Link>
            </td>
          </tr>
        ))}
      </Table>

      <Pagination
        page={page}
        limit={PAGE_SIZE}
        total={visits.data?.total ?? 0}
        onPage={setPage}
      />
    </div>
  );
}

const Trivia = () => null;
function DoctorName() {
  return <Trivia />;
}
void Trivia;
