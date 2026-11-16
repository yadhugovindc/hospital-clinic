import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pharmacyApi } from '../../services';
import { Button, ErrorNote, Field, Input, PageHeader, Table, EmptyRow, Modal, Pagination } from '../../components/ui';
import { getApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';

const SIZE = 25;

export default function StockPage() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [showExpiry, setShowExpiry] = useState(false);
  const [adjustBatch, setAdjustBatch] = useState('');
  const [error, setError] = useState('');
  const stock = useQuery({ queryKey: ['stock', page, showExpiry], queryFn: () => showExpiry ? pharmacyApi.expiry({ withinDays: 30, page, limit: SIZE }) : pharmacyApi.stock({ page, limit: SIZE }) });
  const adjustment = useMutation({
    mutationFn: (form: FormData) => pharmacyApi.adjustStock({ batchId: String(form.get('batchId')), quantityChange: Number(form.get('quantityChange')), reason: String(form.get('reason')) }),
    onSuccess: () => { setAdjustBatch(''); setError(''); void client.invalidateQueries({ queryKey: ['stock'] }); void client.invalidateQueries({ queryKey: ['medicines'] }); },
    onError: (err) => setError(getApiError(err).message),
  });
  const batches = stock.data?.batches ?? [];
  return <div>
    <PageHeader title="Stock & expiry" sub="Track received batches, remaining quantities, and expiry dates" />
    {error && <div className="mb-4"><ErrorNote message={error} /></div>}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1"><button className={`rounded px-3 py-1.5 text-sm ${!showExpiry ? 'bg-brand-700 text-white' : 'text-gray-600'}`} onClick={() => { setShowExpiry(false); setPage(1); }}>All batches</button><button className={`rounded px-3 py-1.5 text-sm ${showExpiry ? 'bg-brand-700 text-white' : 'text-gray-600'}`} onClick={() => { setShowExpiry(true); setPage(1); }}>Expiring soon</button></div><span className="text-xs text-gray-500">Showing {batches.length} batches</span></div>
    {stock.error ? <ErrorNote message={getApiError(stock.error).message} /> : <>
      <Table head={['Medicine', 'Batch', 'Expiry', 'Received', 'Remaining', 'Action']}>
        {batches.length === 0 && <EmptyRow span={6} message="No stock batches found" />}
        {batches.map((batch) => { const medicine = typeof batch.medicineId === 'string' ? { name: 'Medicine' } : batch.medicineId; return <tr key={batch._id} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium">{medicine.name}</td><td className="px-4 py-3 font-mono text-xs">{batch.batchNumber}</td><td className="px-4 py-3">{formatDate(batch.expiryDate)}</td><td className="px-4 py-3">{batch.quantityReceived}</td><td className="px-4 py-3 font-semibold">{batch.quantityRemaining}</td><td className="px-4 py-3"><Button variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={() => setAdjustBatch(batch._id)}>Adjust</Button></td></tr>; })}
      </Table><Pagination page={page} limit={SIZE} total={stock.data?.total ?? 0} onPage={setPage} />
    </>}
    <Modal open={Boolean(adjustBatch)} title="Adjust batch quantity" onClose={() => setAdjustBatch('')}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); form.set('batchId', adjustBatch); adjustment.mutate(form); }}>
        <input type="hidden" name="batchId" value={adjustBatch} />
        <Field label="Quantity change *" hint="Use a negative number to remove stock"><Input name="quantityChange" type="number" required step="1" placeholder="e.g. -2 or 5" /></Field>
        <Field label="Reason *"><Input name="reason" required minLength={3} placeholder="Stock count correction" /></Field>
        <div className="flex justify-end"><Button type="submit" loading={adjustment.isPending}>Save adjustment</Button></div>
      </form>
    </Modal>
  </div>;
}