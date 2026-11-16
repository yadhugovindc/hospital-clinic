import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { miscApi } from '../../services';
import { EmptyRow, ErrorNote, PageHeader, Pagination, Select, Table } from '../../components/ui';
import { getApiError } from '../../lib/api';
import { formatDate, titleCase } from '../../lib/format';

const SIZE = 30;
const ENTITY_TYPES = [
  { value: 'Patient', label: 'Patient' },
  { value: 'Token', label: 'Token' },
  { value: 'Visit', label: 'Visit' },
  { value: 'Prescription', label: 'Prescription' },
  { value: 'IcdCode', label: 'ICD code' },
  { value: 'Medicine', label: 'Medicine' },
  { value: 'Supplier', label: 'Supplier' },
  { value: 'Purchase', label: 'Purchase' },
  { value: 'StockBatch', label: 'Stock batch' },
  { value: 'PharmacyBill', label: 'Pharmacy bill' },
  { value: 'ProcedureCatalog', label: 'Procedure catalog' },
  { value: 'ProcedurePlan', label: 'Procedure plan' },
  { value: 'ProcedureSession', label: 'Procedure session' },
  { value: 'ProcedureBill', label: 'Procedure bill' },
  { value: 'Expense', label: 'Expense' },
  { value: 'User', label: 'User' },
  { value: 'ClinicSettings', label: 'Clinic settings' },
];

export default function AuditPage() {
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const logs = useQuery({ queryKey: ['audit-logs', entityType, page], queryFn: () => miscApi.auditLogs({ entityType: entityType || undefined, page, limit: SIZE }) });
  return <div>
    <PageHeader title="Audit log" sub="Trace administrative and operational changes" />
    <div className="mb-4 max-w-xs"><Select value={entityType} onChange={(event) => { setEntityType(event.target.value); setPage(1); }}><option value="">All record types</option>{ENTITY_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</Select></div>
    {logs.error ? <ErrorNote message={getApiError(logs.error).message} /> : <>
      <Table head={['Timestamp', 'Actor', 'Role', 'Action', 'Record type', 'Record ID']}>
        {(logs.data?.logs ?? []).length === 0 && <EmptyRow span={6} message="No audit events found" />}
        {(logs.data?.logs ?? []).map((log) => <tr key={log._id} className="hover:bg-gray-50"><td className="whitespace-nowrap px-4 py-3">{formatDate(log.createdAt)}</td><td className="px-4 py-3">{log.actorId?.name ?? log.actorId?.email ?? 'System'}</td><td className="px-4 py-3 capitalize">{log.actorId?.role ?? '—'}</td><td className="px-4 py-3 font-medium">{titleCase(log.action)}</td><td className="px-4 py-3">{titleCase(log.entityType)}</td><td className="max-w-44 truncate px-4 py-3 font-mono text-xs" title={log.entityId}>{log.entityId ?? '—'}</td></tr>)}
      </Table><Pagination page={page} limit={SIZE} total={logs.data?.total ?? 0} onPage={setPage} />
    </>}
  </div>;
}