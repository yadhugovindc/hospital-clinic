import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { pharmacyApi } from '../../services';
import { Button, ErrorNote, Field, Input, PageHeader, Pagination, Select, Table, EmptyRow, Modal } from '../../components/ui';
import { getApiError } from '../../lib/api';
import { money } from '../../lib/format';

const PAGE_SIZE = 25;

export default function MedicinesPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lowStock, setLowStock] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const medicines = useQuery({ queryKey: ['medicines', search, page, lowStock], queryFn: () => pharmacyApi.medicines({ search: search || undefined, page, limit: PAGE_SIZE, lowStock }) });
  const create = useMutation({
    mutationFn: (form: FormData) => pharmacyApi.createMedicine({
      name: String(form.get('name')), category: String(form.get('category') || '') || undefined, form: String(form.get('form')),
      strength: String(form.get('strength') || '') || undefined, unit: String(form.get('unit')), isAyurvedic: form.get('isAyurvedic') === 'on',
      taxRatePercent: Number(form.get('taxRatePercent') || 0), sellingPriceMinor: Math.round(Number(form.get('price')) * 100), lowStockThreshold: Number(form.get('lowStockThreshold') || 10),
    }),
    onSuccess: () => { setOpen(false); setError(''); void client.invalidateQueries({ queryKey: ['medicines'] }); },
    onError: (err) => setError(getApiError(err).message),
  });
  return <div>
    <PageHeader title="Medicines" sub="Maintain the dispensary catalogue and pricing" actions={<Button onClick={() => setOpen(true)}><Plus size={16} /> New medicine</Button>} />
    {error && <div className="mb-4"><ErrorNote message={error} /></div>}
    <div className="mb-4 flex flex-wrap gap-3">
      <label className="relative min-w-64 flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input className="pl-9" placeholder="Search name or category" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
      <label className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm"><input type="checkbox" checked={lowStock} onChange={(event) => { setLowStock(event.target.checked); setPage(1); }} /> Low stock only</label>
    </div>
    {medicines.error ? <ErrorNote message={getApiError(medicines.error).message} /> : <>
      <Table head={['Medicine', 'Category', 'Form', 'Stock', 'Price', 'Tax', 'Status']}>
        {(medicines.data?.medicines ?? []).length === 0 && <EmptyRow span={7} message="No medicines found" />}
        {(medicines.data?.medicines ?? []).map((medicine) => <tr key={medicine._id} className="hover:bg-gray-50"><td className="px-4 py-3"><span className="font-medium">{medicine.name}</span><span className="ml-2 text-xs text-gray-500">{medicine.strength}</span></td><td className="px-4 py-3">{medicine.category || '—'}</td><td className="px-4 py-3">{medicine.form} / {medicine.unit}</td><td className={`px-4 py-3 font-medium ${(medicine.stockRemaining ?? 0) <= medicine.lowStockThreshold ? 'text-amber-700' : ''}`}>{medicine.stockRemaining ?? 0}<span className="ml-1 text-xs font-normal text-gray-500">{medicine.unit}</span></td><td className="px-4 py-3">{money(medicine.sellingPriceMinor)}</td><td className="px-4 py-3">{medicine.taxRatePercent}%</td><td className="px-4 py-3">{medicine.isActive ? 'Active' : 'Inactive'}</td></tr>)}
      </Table><Pagination page={page} limit={PAGE_SIZE} total={medicines.data?.total ?? 0} onPage={setPage} />
    </>}
    <Modal open={open} title="Add medicine" onClose={() => setOpen(false)} wide>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setError(''); create.mutate(new FormData(event.currentTarget)); }}>
        <Field label="Medicine name *"><Input name="name" required /></Field><Field label="Category"><Input name="category" placeholder="Classical, proprietary…" /></Field>
        <Field label="Form *"><Select name="form" required><option value="tablet">Tablet</option><option value="capsule">Capsule</option><option value="powder">Powder</option><option value="liquid">Liquid</option><option value="oil">Oil</option><option value="other">Other</option></Select></Field>
        <Field label="Strength"><Input name="strength" /></Field><Field label="Dispensing unit *"><Input name="unit" required placeholder="tablet, bottle, g" /></Field>
        <Field label="Selling price (₹) *"><Input name="price" type="number" min="0" step="0.01" required /></Field><Field label="Tax rate (%)"><Input name="taxRatePercent" type="number" min="0" max="28" step="0.1" defaultValue="0" /></Field>
        <Field label="Low-stock threshold"><Input name="lowStockThreshold" type="number" min="0" defaultValue="10" /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input name="isAyurvedic" type="checkbox" defaultChecked /> Ayurvedic medicine</label>
        <div className="sm:col-span-2 flex justify-end"><Button type="submit" loading={create.isPending}>Save medicine</Button></div>
      </form>
    </Modal>
  </div>;
}