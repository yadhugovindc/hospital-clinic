import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RotateCcw } from 'lucide-react';
import { accountsApi } from '../../services';
import { Button, ErrorNote, Field, Input, Modal, PageHeader, Table, EmptyRow, Pagination, Select } from '../../components/ui';
import { getApiError } from '../../lib/api';
import { formatDate, money, todayIso } from '../../lib/format';
import type { Expense } from '../../types';

const SIZE = 20;
const categories = ['salary', 'rent', 'utilities', 'purchase', 'maintenance', 'marketing', 'miscellaneous', 'other'];

export default function ExpensesPage() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [date, setDate] = useState('');
  const [open, setOpen] = useState(false);
  const [reverse, setReverse] = useState<Expense | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const expenses = useQuery({ queryKey: ['expenses', page, date], queryFn: () => accountsApi.expenses({ page, limit: SIZE, expenseDate: date || undefined }) });
  const create = useMutation({
    mutationFn: (data: FormData) => accountsApi.createExpense({ category: String(data.get('category')), description: String(data.get('description')), amountMinor: Math.round(Number(data.get('amount')) * 100), expenseDate: String(data.get('expenseDate')), paymentMethod: String(data.get('paymentMethod')), reference: String(data.get('reference') || '') || undefined }),
    onSuccess: () => { setOpen(false); setError(''); void client.invalidateQueries({ queryKey: ['expenses'] }); void client.invalidateQueries({ queryKey: ['daybook'] }); },
    onError: (err) => setError(getApiError(err).message),
  });
  const undo = useMutation({ mutationFn: () => accountsApi.reverseExpense(reverse!._id, reason), onSuccess: () => { setReverse(null); setReason(''); setError(''); void client.invalidateQueries({ queryKey: ['expenses'] }); void client.invalidateQueries({ queryKey: ['daybook'] }); }, onError: (err) => setError(getApiError(err).message) });
  return <div>
    <PageHeader title="Expenses" sub="Record and review operating expenses" actions={<Button onClick={() => setOpen(true)}><Plus size={16} /> Record expense</Button>} />
    {error && <div className="mb-4"><ErrorNote message={error} /></div>}
    <div className="mb-4 max-w-xs"><Field label="Filter by date"><Input type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); }} /></Field></div>
    {expenses.error ? <ErrorNote message={getApiError(expenses.error).message} /> : <>
      <Table head={['Expense', 'Date', 'Category', 'Description', 'Payment', 'Amount', 'Status', '']}>
        {(expenses.data?.expenses ?? []).length === 0 && <EmptyRow span={8} message="No expenses recorded for this filter" />}
        {(expenses.data?.expenses ?? []).map((expense) => <tr key={expense._id} className="hover:bg-gray-50"><td className="px-4 py-3 font-mono text-xs">{expense.expenseNumber}</td><td className="px-4 py-3">{formatDate(expense.expenseDate)}</td><td className="px-4 py-3 capitalize">{expense.category}</td><td className="px-4 py-3">{expense.description}</td><td className="px-4 py-3 capitalize">{expense.paymentMethod.replace('_', ' ')}</td><td className="px-4 py-3 font-semibold">{money(expense.amountMinor)}</td><td className="px-4 py-3">{expense.reversedBy ? 'Reversed' : 'Recorded'}</td><td className="px-4 py-3 text-right">{!expense.reversedBy && <button className="rounded p-2 text-gray-500 hover:bg-amber-50 hover:text-amber-700" title="Reverse expense" aria-label="Reverse expense" onClick={() => { setReverse(expense); setReason(''); }}><RotateCcw size={15} /></button>}</td></tr>)}
      </Table><Pagination page={page} limit={SIZE} total={expenses.data?.total ?? 0} onPage={setPage} />
    </>}
    <Modal open={open} title="Record expense" onClose={() => setOpen(false)}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setError(''); create.mutate(new FormData(event.currentTarget)); }}>
        <Field label="Category"><Select name="category">{categories.map((category) => <option key={category} value={category}>{category}</option>)}</Select></Field>
        <Field label="Description *"><Input name="description" required minLength={3} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Amount (₹) *"><Input name="amount" type="number" min="0.01" step="0.01" required /></Field><Field label="Date *"><Input name="expenseDate" type="date" required defaultValue={todayIso()} /></Field></div>
        <Field label="Payment method"><Select name="paymentMethod">{['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other'].map((method) => <option key={method} value={method}>{method.replace('_', ' ')}</option>)}</Select></Field><Field label="Reference"><Input name="reference" /></Field>
        <div className="flex justify-end"><Button type="submit" loading={create.isPending}>Save expense</Button></div>
      </form>
    </Modal>
    <Modal open={Boolean(reverse)} title="Reverse expense" onClose={() => setReverse(null)}>
      <div className="space-y-4"><p className="text-sm text-gray-600">Reversal creates an audit record and cannot be undone.</p><Field label="Reason *"><Input value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} /></Field><div className="flex justify-end"><Button variant="danger" loading={undo.isPending} disabled={reason.trim().length < 3} onClick={() => undo.mutate()}>Reverse {reverse?.expenseNumber}</Button></div></div>
    </Modal>
  </div>;
}