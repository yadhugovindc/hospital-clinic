import { useState } from 'react';
import { Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '../../services';
import { Button, ErrorNote, Field, Input, PageHeader, Spinner, StatCard, Table, EmptyRow } from '../../components/ui';
import { getApiError } from '../../lib/api';
import { money, todayIso } from '../../lib/format';

function daysAgo(count: number): string { const date = new Date(); date.setDate(date.getDate() - count); return date.toISOString().slice(0, 10); }

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(daysAgo(6));
  const [endDate, setEndDate] = useState(todayIso());
  const report = useQuery({ queryKey: ['financial-report', startDate, endDate], queryFn: () => accountsApi.report(startDate, endDate), enabled: Boolean(startDate && endDate && startDate <= endDate) });
  return <div>
    <PageHeader title="Financial reports" sub="Collections and expenses across a selected date range" actions={startDate && endDate && startDate <= endDate ? <a href={accountsApi.reportCsvUrl(startDate, endDate)}><Button variant="secondary"><Download size={15} /> Export CSV</Button></a> : undefined} />
    <div className="mb-5 grid gap-3 sm:grid-cols-2"><Field label="From"><Input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></Field><Field label="To"><Input type="date" value={endDate} min={startDate} max={todayIso()} onChange={(event) => setEndDate(event.target.value)} /></Field></div>
    {startDate > endDate ? <ErrorNote message="The end date must be on or after the start date." /> : report.isLoading ? <Spinner label="Preparing report…" /> : report.error || !report.data ? <ErrorNote message={getApiError(report.error).message} /> : <>
      <div className="mb-5 grid gap-3 sm:grid-cols-3"><StatCard label="Net collections" value={money(report.data.netCollectionsMinor)} /><StatCard label="Expenses" value={money(report.data.netExpensesMinor)} /><StatCard label="Net income" value={money(report.data.netIncomeMinor)} /></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section><h2 className="mb-2 text-sm font-semibold">Collections by service</h2><Table head={['Category', 'Transactions', 'Amount']}>{report.data.collections.length === 0 && <EmptyRow span={3} />}{report.data.collections.map((item) => <tr key={item.kind}><td className="px-4 py-3 capitalize">{item.kind}</td><td className="px-4 py-3">{item.count}</td><td className="px-4 py-3 font-medium">{money(item.amountMinor)}</td></tr>)}</Table></section>
        <section><h2 className="mb-2 text-sm font-semibold">Expenses by category</h2><Table head={['Category', 'Transactions', 'Amount']}>{report.data.expenses.length === 0 && <EmptyRow span={3} />}{report.data.expenses.map((item) => <tr key={item.category}><td className="px-4 py-3 capitalize">{item.category}</td><td className="px-4 py-3">{item.count}</td><td className="px-4 py-3 font-medium">{money(item.amountMinor)}</td></tr>)}</Table></section>
      </div>
      <section className="mt-5"><h2 className="mb-2 text-sm font-semibold">Daily totals</h2><Table head={['Date', 'Collections', 'Expenses', 'Net']}>{report.data.daily.length === 0 && <EmptyRow span={4} />}{report.data.daily.map((day) => <tr key={day.date}><td className="px-4 py-3">{day.date}</td><td className="px-4 py-3">{money(day.collectionsMinor)}</td><td className="px-4 py-3">{money(day.expensesMinor)}</td><td className="px-4 py-3 font-semibold">{money(day.collectionsMinor - day.expensesMinor)}</td></tr>)}</Table></section>
    </>}
  </div>;
}