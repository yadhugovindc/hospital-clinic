import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { pharmacyApi } from '../../services';
import { Button, ErrorNote, Field, Input, Modal, PageHeader, Table, EmptyRow } from '../../components/ui';
import { getApiError } from '../../lib/api';

export default function SuppliersPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: pharmacyApi.suppliers });
  const create = useMutation({
    mutationFn: (data: FormData) => pharmacyApi.createSupplier({ name: String(data.get('name')), contactPerson: String(data.get('contactPerson') || '') || undefined, phone: String(data.get('phone') || '') || undefined, email: String(data.get('email') || '') || undefined, gstNumber: String(data.get('gstNumber') || '') || undefined, address: String(data.get('address') || '') || undefined }),
    onSuccess: () => { setOpen(false); setError(''); void client.invalidateQueries({ queryKey: ['suppliers'] }); },
    onError: (err) => setError(getApiError(err).message),
  });
  return <div>
    <PageHeader title="Suppliers" sub="Supplier directory for medicine purchasing" actions={<Button onClick={() => setOpen(true)}><Plus size={16} /> Add supplier</Button>} />
    {error && <div className="mb-4"><ErrorNote message={error} /></div>}
    {suppliers.error ? <ErrorNote message={getApiError(suppliers.error).message} /> : <Table head={['Supplier', 'Contact person', 'Phone', 'Email', 'GSTIN', 'Status']}>
      {(suppliers.data?.suppliers ?? []).length === 0 && <EmptyRow span={6} message="No suppliers added yet" />}
      {(suppliers.data?.suppliers ?? []).map((supplier) => <tr key={supplier._id} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium">{supplier.name}</td><td className="px-4 py-3">{supplier.contactPerson || '—'}</td><td className="px-4 py-3">{supplier.phone || '—'}</td><td className="px-4 py-3">{supplier.email || '—'}</td><td className="px-4 py-3 font-mono text-xs">{supplier.gstNumber || '—'}</td><td className="px-4 py-3">{supplier.isActive ? 'Active' : 'Inactive'}</td></tr>)}
    </Table>}
    <Modal open={open} title="Add supplier" onClose={() => setOpen(false)}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setError(''); create.mutate(new FormData(event.currentTarget)); }}>
        <Field label="Supplier name *"><Input name="name" required minLength={2} /></Field><Field label="Contact person"><Input name="contactPerson" /></Field><Field label="Phone"><Input name="phone" /></Field><Field label="Email"><Input name="email" type="email" /></Field><Field label="GSTIN"><Input name="gstNumber" /></Field><Field label="Address"><Input name="address" /></Field>
        <div className="flex justify-end"><Button type="submit" loading={create.isPending}>Save supplier</Button></div>
      </form>
    </Modal>
  </div>;
}