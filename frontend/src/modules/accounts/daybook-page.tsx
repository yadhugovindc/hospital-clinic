import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '../../services';
import { ErrorNote, Field, Input, PageHeader, Spinner, StatCard, Table, EmptyRow } from '../../components/ui';
import { getApiError } from '../../lib/api';
import { formatDate, money, todayIso } from '../../lib/format';

export default function DaybookPage() {
  const [date, setDate] = useState(todayIso());
  const daybook = useQuery({ queryKey: ['daybook', date], queryFn: () => accountsApi.daybook(date) });
  return <div>
    <PageHeader title="Day book" sub="Daily collections, expenses, and payment reconciliation" />
    <div className="mb-5 max-w-xs"><Field label="Business date"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field></div>
    {daybook.isLoading ? <Spinner label="Loading day book…" /> : daybook.error || !daybook.data ? <ErrorNote message={getApiError(daybook.error).message} /> : <>
      <div className="mb-5 grid gap-3 sm:grid-cols-3"><StatCard label="Collections" value={money(daybook.data.totals.billsMinor)} /><StatCard label="Expenses" value={money(daybook.data.totals.expensesMinor)} /><StatCard label="Net for the day" value={money(daybook.data.totals.netMinor)} /></div>
      <section className="mb-5 rounded-md border border-gray-200 bg-white p-4"><h2 className="mb-3 text-sm font-semibold">Collections by payment method</h2><div className="flex flex-wrap gap-3">{Object.entries(daybook.data.totals.byMethod).map(([method, amount]) => <div key={method} className="min-w-32 border-l-2 border-brand-600 pl-3"><p className="text-xs capitalize text-gray-500">{method.replace('_', ' ')}</p><p className="mt-1 font-semibold">{money(amount)}</p></div>)}</div></section>
      <Table head={['Time', 'Type', 'Reference', 'Description', 'Method', 'Amount']}>
        {daybook.data.entries.length === 0 && <EmptyRow span={6} message="No financial entries for this date" />}
        {daybook.data.entries.map((entry, index) => <tr key={`${entry.kind}-${entry.number}-${index}`} className="hover:bg-gray-50"><td className="px-4 py-3">{new Date(entry.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td><td className="px-4 py-3 capitalize">{entry.kind}</td><td className="px-4 py-3 font-mono text-xs">{entry.number}</td><td className="px-4 py-3">{entry.description}</td><td className="px-4 py-3 capitalize">{entry.method.replace('_', ' ')}</td><td className={`px-4 py-3 font-semibold ${entry.kind === 'expense' ? 'text-red-700' : 'text-green-700'}`}>{entry.kind === 'expense' ? '−' : '+'}{money(entry.amountMinor)}</td></tr>)}
      </Table>
      <p className="mt-2 text-right text-xs text-gray-500">Report date: {formatDate(daybook.data.date)}</p>
    </>}
  </div>;
}