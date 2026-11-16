import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { miscApi } from '../services';
import type { DashboardData } from '../types';
import { money } from '../lib/format';
import { ErrorNote, PageHeader, Spinner, StatCard } from '../components/ui';

export function useDashboard<T extends DashboardData = DashboardData>() {
  return useQuery({ queryKey: ['dashboard'], queryFn: async () => (await miscApi.dashboard()) as unknown as T });
}

export function DashboardShell({ title, children }: { title: string; children: (data: DashboardData) => ReactNode }) {
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorNote message={(error as Error | undefined)?.message ?? 'Failed to load dashboard'} />;
  return (
    <div>
      <PageHeader title={title} sub={`Business date: ${data.date}`} />
      {children(data)}
    </div>
  );
}

type Common = DashboardData & {
  tokenCounts?: Record<string, number>;
  registrationsToday?: number;
};

export default function DashboardPage() {
  return (
    <DashboardShell title="Dashboard">
      {(data) => (
        <>
          {(data.tokenCounts !== undefined || data.registrationsToday !== undefined) && <TokenCards data={data as Common} />}

          {'revenue' in data && data.revenue && typeof data.revenue === 'object' && (
            <section className="mt-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Today &middot; Revenue</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Pharmacy sales" value={money((data.revenue as Record<string, number>).pharmacyMinor ?? 0)} />
                <StatCard label="Procedure bills" value={money((data.revenue as Record<string, number>).procedureMinor ?? 0)} />
                <StatCard label="Expenses" value={money((data.revenue as Record<string, number>).expensesMinor ?? 0)} />
              </div>
            </section>
          )}

          {'activeUsers' in data && (
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Active users" value={String(data.activeUsers)} />
              <StatCard label="Low-stock medicines" value={String(data.lowStockCount ?? 0)} />
              <StatCard label="Near-expiry batches" value={String(data.nearExpiryCount ?? 0)} sub="next 30 days" />
            </section>
          )}

          {'waitingMyQueue' in data && (
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Waiting in my queue" value={String(data.waitingMyQueue)} />
              <StatCard label="Completed consultations today" value={String(data.completedToday)} />
            </section>
          )}

          {'salesTodayMinor' in data && (
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Pharmacy sales today" value={money(data.salesTodayMinor as number)} sub={`${data.billsToday} bills`} />
              <StatCard label="Low-stock medicines" value={String(Array.isArray(data.lowStock) ? data.lowStock.length : 0)} />
              <StatCard label="Near-expiry batches" value={String(Array.isArray(data.nearExpiry) ? data.nearExpiry.length : 0)} sub="next 30 days" />
            </section>
          )}

          {'pendingMine' in data && (
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="My pending sessions today" value={String(data.pendingMine)} />
              <StatCard label="My completed sessions" value={String(data.completedMine)} />
              <StatCard label="Active therapy plans" value={String(data.activePlans)} />
              <StatCard label="Sessions scheduled today" value={String(Array.isArray(data.todaySessions) ? data.todaySessions.length : 0)} />
            </section>
          )}

          {'collections' in data && data.collections && (
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Pharmacy collections" value={money((data.collections as Record<string, number>).pharmacyMinor ?? 0)} />
              <StatCard label="Procedure collections" value={money((data.collections as Record<string, number>).procedureMinor ?? 0)} />
              <StatCard label="Expenses today" value={money((data.collections as Record<string, number>).expensesMinor ?? 0)} />
            </section>
          )}
        </>
      )}
    </DashboardShell>
  );
}

function TokenCards({ data }: { data: Common }) {
  const c = data.tokenCounts ?? {};
  const waiting = c['waiting'] ?? 0;
  const inConsult = c['in_consultation'] ?? 0;
  const completed = c['completed'] ?? 0;
  const cancelled = (c['cancelled'] ?? 0) + (c['no_show'] ?? 0);
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Today's registrations" value={String(data.registrationsToday ?? 0)} />
      <StatCard label="Waiting tokens" value={String(waiting)} />
      <StatCard label="In consultation" value={String(inConsult)} />
      <StatCard label="Completed / cancelled" value={`${completed} / ${cancelled}`} />
    </section>
  );
}
