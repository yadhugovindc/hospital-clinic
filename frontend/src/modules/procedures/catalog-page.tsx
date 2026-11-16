import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { proceduresApi } from '../../services';
import type { ProcedureCatalogItem } from '../../types';
import { Button, ErrorNote, Field, Input, Modal, PageHeader, Table, EmptyRow } from '../../components/ui';
import { getApiError } from '../../lib/api';
import { money } from '../../lib/format';

export default function CatalogPage({ readOnly = false }: { readOnly?: boolean }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const catalog = useQuery({ queryKey: ['procedure-catalog'], queryFn: () => proceduresApi.catalog(true) });
  const create = useMutation({
    mutationFn: (data: FormData) => proceduresApi.createCatalogItem({ name: String(data.get('name')), description: String(data.get('description') || '') || undefined, defaultSessionDurationMinutes: Number(data.get('duration')), priceMinor: Math.round(Number(data.get('price')) * 100), taxRatePercent: Number(data.get('tax') || 0) }),
    onSuccess: () => { setOpen(false); setError(''); void client.invalidateQueries({ queryKey: ['procedure-catalog'] }); },
    onError: (err) => setError(getApiError(err).message),
  });
  const toggle = useMutation({ mutationFn: (procedure: ProcedureCatalogItem) => proceduresApi.updateCatalogItem(procedure._id, { isActive: !procedure.isActive }), onSuccess: () => void client.invalidateQueries({ queryKey: ['procedure-catalog'] }), onError: (err) => setError(getApiError(err).message) });
  return <div>
    <PageHeader title="Procedure catalog" sub="Therapy and treatment services, pricing, and session duration" actions={!readOnly && <Button onClick={() => setOpen(true)}><Plus size={16} /> Add procedure</Button>} />
    {error && <div className="mb-4"><ErrorNote message={error} /></div>}
    {catalog.error ? <ErrorNote message={getApiError(catalog.error).message} /> : <Table head={['Procedure', 'Description', 'Session length', 'Price', 'Tax', 'Status', ...(!readOnly ? [''] : [])]}>
      {(catalog.data ?? []).length === 0 && <EmptyRow span={readOnly ? 6 : 7} message="No procedures in the catalog" />}
      {(catalog.data ?? []).map((procedure) => <tr key={procedure._id} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium">{procedure.name}</td><td className="max-w-sm px-4 py-3 text-gray-600">{procedure.description || '—'}</td><td className="px-4 py-3">{procedure.defaultSessionDurationMinutes} min</td><td className="px-4 py-3">{money(procedure.priceMinor)}</td><td className="px-4 py-3">{procedure.taxRatePercent}%</td><td className="px-4 py-3">{procedure.isActive ? 'Active' : 'Inactive'}</td>{!readOnly && <td className="px-4 py-3 text-right"><Button variant="secondary" className="px-2.5 py-1.5 text-xs" loading={toggle.isPending} onClick={() => toggle.mutate(procedure)}>{procedure.isActive ? 'Deactivate' : 'Activate'}</Button></td>}</tr>)}
    </Table>}
    <Modal open={open} title="Add procedure" onClose={() => setOpen(false)}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setError(''); create.mutate(new FormData(event.currentTarget)); }}>
        <Field label="Procedure name *"><Input name="name" required minLength={2} /></Field><Field label="Description"><Input name="description" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Session duration (minutes) *"><Input name="duration" type="number" min="5" max="600" required /></Field><Field label="Price (₹) *"><Input name="price" type="number" min="0" step="0.01" required /></Field></div>
        <Field label="Tax rate (%)"><Input name="tax" type="number" min="0" max="28" step="0.1" defaultValue="0" /></Field>
        <div className="flex justify-end"><Button type="submit" loading={create.isPending}>Save procedure</Button></div>
      </form>
    </Modal>
  </div>;
}