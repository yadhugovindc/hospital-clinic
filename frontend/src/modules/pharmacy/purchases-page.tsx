import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { pharmacyApi } from '../../services';
import { Button, ErrorNote, Field, Input, Modal, PageHeader, Table, EmptyRow, Pagination } from '../../components/ui';
import { getApiError } from '../../lib/api';
import { formatDate, money, todayIso } from '../../lib/format';

const SIZE = 20;

export default function PurchasesPage() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const purchases = useQuery({ queryKey: ['purchases', page], queryFn: () => pharmacyApi.purchases({ page, limit: SIZE }) });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: pharmacyApi.suppliers });
  const medicines = useQuery({ queryKey: ['medicines-for-purchase'], queryFn: () => pharmacyApi.medicines({ limit: 100 }) });
  const create = useMutation({
    mutationFn: (data: FormData) => pharmacyApi.createPurchase({
      supplierId: String(data.get('supplierId')), purchaseDate: String(data.get('purchaseDate')), invoiceNumber: String(data.get('invoiceNumber') || '') || undefined,
      lines: [{ medicineId: String(data.get('medicineId')), batchNumber: String(data.get('batchNumber')), expiryDate: String(data.get('expiryDate')), quantity: Number(data.get('quantity')), purchasePriceMinor: Math.round(Number(data.get('purchasePrice')) * 100), taxRatePercent: Number(data.get('taxRatePercent') || 0) }],
    }),
    onSuccess: () => { setOpen(false); setError(''); void client.invalidateQueries({ queryKey: ['purchases'] }); void client.invalidateQueries({ queryKey: ['stock'] }); void client.invalidateQueries({ queryKey: ['medicines'] }); },
    onError: (err) => setError(getApiError(err).message),
  });
  return <div>
    <PageHeader title="Purchases" sub="Receive supplier invoices into tracked batches" actions={<Button onClick={() => setOpen(true)}><Plus size={16} /> Receive purchase</Button>} />
    {error && <div className="mb-4"><ErrorNote message={error} /></div>}
    {purchases.error ? <ErrorNote message={getApiError(purchases.error).message} /> : <>
      <Table head={['Purchase', 'Supplier', 'Invoice', 'Date', 'Lines', 'Total', 'Status']}>
        {(purchases.data?.purchases ?? []).length === 0 && <EmptyRow span={7} message="No purchases recorded" />}
        {(purchases.data?.purchases ?? []).map((purchase) => <tr key={purchase._id} className="hover:bg-gray-50"><td className="px-4 py-3 font-mono text-xs">{purchase.purchaseNumber}</td><td className="px-4 py-3">{purchase.supplierNameSnapshot ?? (typeof purchase.supplierId === 'string' ? '—' : purchase.supplierId.name)}</td><td className="px-4 py-3">{purchase.invoiceNumber || '—'}</td><td className="px-4 py-3">{formatDate(purchase.purchaseDate)}</td><td className="px-4 py-3">{purchase.lines.length}</td><td className="px-4 py-3 font-medium">{money(purchase.totalMinor)}</td><td className="px-4 py-3">{purchase.status}</td></tr>)}
      </Table><Pagination page={page} limit={SIZE} total={purchases.data?.total ?? 0} onPage={setPage} />
    </>}
    <Modal open={open} title="Receive purchase" onClose={() => setOpen(false)} wide>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setError(''); create.mutate(new FormData(event.currentTarget)); }}>
        <Field label="Supplier *"><select name="supplierId" className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" required defaultValue=""><option value="" disabled>Select supplier</option>{(suppliers.data?.suppliers ?? []).map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}</select></Field>
        <Field label="Medicine *"><select name="medicineId" className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" required defaultValue=""><option value="" disabled>Select medicine</option>{(medicines.data?.medicines ?? []).map((medicine) => <option key={medicine._id} value={medicine._id}>{medicine.name}</option>)}</select></Field>
        <Field label="Purchase date *"><Input name="purchaseDate" type="date" required defaultValue={todayIso()} /></Field><Field label="Supplier invoice"><Input name="invoiceNumber" /></Field>
        <Field label="Batch number *"><Input name="batchNumber" required /></Field><Field label="Expiry date *"><Input name="expiryDate" type="date" required /></Field>
        <Field label="Quantity *"><Input name="quantity" type="number" min="1" required /></Field><Field label="Purchase price per unit (₹) *"><Input name="purchasePrice" type="number" min="0" step="0.01" required /></Field>
        <Field label="Tax (%)"><Input name="taxRatePercent" type="number" min="0" max="28" step="0.1" defaultValue="0" /></Field>
        <div className="sm:col-span-2 flex justify-end"><Button type="submit" loading={create.isPending}>Receive into stock</Button></div>
      </form>
    </Modal>
  </div>;
}