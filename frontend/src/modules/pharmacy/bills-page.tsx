import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { pharmacyApi, receptionApi } from '../../services';
import { Button, ErrorNote, Field, Input, Modal, PageHeader, Table, EmptyRow, Pagination, Select, StatusBadge } from '../../components/ui';
import { getApiError } from '../../lib/api';
import { formatDate, money } from '../../lib/format';

const SIZE = 20;
interface BillLine { medicineId: string; quantity: string; discount: string }

export default function PharmacyBillsPage() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSearchMode, setPatientSearchMode] = useState<'name' | 'phone' | 'uhid'>('name');
  const [patientId, setPatientId] = useState('');
  const [lines, setLines] = useState<BillLine[]>([{ medicineId: '', quantity: '1', discount: '0' }]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const bills = useQuery({ queryKey: ['pharmacy-bills', page], queryFn: () => pharmacyApi.bills({ page, limit: SIZE }) });
  const medicines = useQuery({ queryKey: ['medicines-for-bill'], queryFn: () => pharmacyApi.medicines({ limit: 100 }) });
  const patients = useQuery({ queryKey: ['bill-patient-search', patientSearchMode, patientSearch], queryFn: () => receptionApi.searchPatients({ [patientSearchMode]: patientSearch, limit: 8 }), enabled: patientSearch.trim().length >= 2 });
  const create = useMutation({
    mutationFn: () => pharmacyApi.createBill({ patientId, paymentMethod, lines: lines.map((line) => ({ medicineId: line.medicineId, quantity: Number(line.quantity), discountPercent: Number(line.discount) })) }),
    onSuccess: () => { setOpen(false); setError(''); setPatientId(''); setPatientSearch(''); setLines([{ medicineId: '', quantity: '1', discount: '0' }]); void client.invalidateQueries({ queryKey: ['pharmacy-bills'] }); void client.invalidateQueries({ queryKey: ['medicines'] }); void client.invalidateQueries({ queryKey: ['stock'] }); },
    onError: (err) => setError(getApiError(err).message),
  });
  return <div>
    <PageHeader title="Pharmacy bills" sub="Dispense medicines and record patient payments" actions={<Button onClick={() => setOpen(true)}><Plus size={16} /> New bill</Button>} />
    {error && <div className="mb-4"><ErrorNote message={error} /></div>}
    {bills.error ? <ErrorNote message={getApiError(bills.error).message} /> : <>
      <Table head={['Bill', 'Patient', 'Date', 'Items', 'Payment', 'Total', 'Status']}>
        {(bills.data?.bills ?? []).length === 0 && <EmptyRow span={7} message="No pharmacy bills recorded" />}
        {(bills.data?.bills ?? []).map((bill) => <tr key={bill._id} className="hover:bg-gray-50"><td className="px-4 py-3 font-mono text-xs">{bill.billNumber}</td><td className="px-4 py-3"><span className="font-medium">{bill.patientNameSnapshot}</span><span className="ml-2 font-mono text-xs text-gray-500">{bill.uhidSnapshot}</span></td><td className="px-4 py-3">{formatDate(bill.billDate)}</td><td className="px-4 py-3">{bill.lines.length}</td><td className="px-4 py-3 capitalize">{bill.paymentMethod.replace('_', ' ')}</td><td className="px-4 py-3 font-semibold">{money(bill.totalMinor)}</td><td className="px-4 py-3"><StatusBadge status={bill.status} /></td></tr>)}
      </Table><Pagination page={page} limit={SIZE} total={bills.data?.total ?? 0} onPage={setPage} />
    </>}
    <Modal open={open} title="Create pharmacy bill" onClose={() => setOpen(false)} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]"><Field label="Search by"><Select value={patientSearchMode} onChange={(event) => { setPatientSearchMode(event.target.value as typeof patientSearchMode); setPatientSearch(''); setPatientId(''); }}><option value="name">Name</option><option value="phone">Phone</option><option value="uhid">UHID</option></Select></Field><Field label="Find patient"><Input value={patientSearch} onChange={(event) => { setPatientSearch(event.target.value); setPatientId(''); }} placeholder="Type at least 2 characters" /></Field></div>
        {patients.error && <ErrorNote message={getApiError(patients.error).message} />}
        {patientSearch.length >= 2 && <div className="max-h-36 overflow-auto rounded border border-gray-200">{(patients.data?.patients ?? []).map((patient) => <button type="button" key={patient._id} className={`block w-full border-b px-3 py-2 text-left text-sm hover:bg-brand-50 ${patientId === patient._id ? 'bg-brand-50' : ''}`} onClick={() => { setPatientId(patient._id); setPatientSearch(`${patient.name} · ${patient.uhid}`); }}>{patient.name} <span className="font-mono text-xs text-gray-500">{patient.uhid}</span> · {patient.phone}</button>)}</div>}
        <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Items</h3><Button type="button" variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={() => setLines([...lines, { medicineId: '', quantity: '1', discount: '0' }])}><Plus size={14} /> Add item</Button></div>{lines.map((line, index) => <div key={index} className="grid items-end gap-3 rounded border border-gray-200 p-3 sm:grid-cols-[minmax(180px,1fr)_100px_110px_36px]"><Field label="Medicine"><Select value={line.medicineId} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, medicineId: event.target.value } : item))}><option value="">Select medicine</option>{(medicines.data?.medicines ?? []).map((medicine) => <option key={medicine._id} value={medicine._id}>{medicine.name} · {money(medicine.sellingPriceMinor)} · stock {medicine.stockRemaining ?? 0}</option>)}</Select></Field><Field label="Quantity"><Input type="number" min="1" value={line.quantity} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, quantity: event.target.value } : item))} /></Field><Field label="Discount (%)"><Input type="number" min="0" max="100" value={line.discount} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, discount: event.target.value } : item))} /></Field><button type="button" aria-label="Remove bill item" title="Remove item" className="mb-1 rounded p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, i) => i !== index))}><Trash2 size={16} /></button></div>)}</div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Payment method"><Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other'].map((method) => <option key={method} value={method}>{method.replace('_', ' ')}</option>)}</Select></Field><div className="flex items-end justify-end"><Button disabled={!patientId || lines.some((line) => !line.medicineId || Number(line.quantity) < 1)} loading={create.isPending} onClick={() => create.mutate()}>Create bill</Button></div></div>
      </div>
    </Modal>
  </div>;
}