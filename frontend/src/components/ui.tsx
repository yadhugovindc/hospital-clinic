import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2, X, AlertTriangle, Inbox } from 'lucide-react';

// ---------- Buttons ----------
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const btnStyles: Record<BtnVariant, string> = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white',
  secondary: 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-800',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  ghost: 'text-brand-700 hover:bg-brand-50',
};

export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; loading?: boolean }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${btnStyles[variant]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

// ---------- Form controls ----------
export function Field({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const inputClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:bg-gray-100';

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClass} ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputClass} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputClass} ${className} min-h-20`} rows={3} {...rest} />;
}

// ---------- Badges ----------
type BadgeTone = 'gray' | 'green' | 'amber' | 'red' | 'blue';

const badgeTones: Record<BadgeTone, string> = {
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
};

export function Badge({ tone = 'gray', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone: BadgeTone =
    status === 'completed' || status === 'paid' || status === 'finalized' ? 'green'
    : status === 'waiting' || status === 'scheduled' || status === 'active' ? 'blue'
    : status === 'cancelled' || status === 'missed' || status === 'no_show' ? 'red'
    : status === 'in_consultation' || status === 'partial' || status === 'rescheduled' ? 'amber'
    : 'gray';
  return <Badge tone={tone}>{status.replace(/_/g, ' ')}</Badge>;
}

// ---------- Modal ----------
export function Modal({ open, title, onClose, children, wide = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, loading, destructive = true }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; loading?: boolean; destructive?: boolean;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="flex gap-3">
        <AlertTriangle className={`mt-0.5 shrink-0 ${destructive ? 'text-red-600' : 'text-amber-500'}`} size={20} />
        <p className="text-sm text-gray-700">{message}</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>Confirm</Button>
      </div>
    </Modal>
  );
}

// ---------- Table ----------
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-2.5 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyRow({ span, message = 'No records found' }: { span: number; message?: string }) {
  return (
    <tr>
      <td colSpan={span} className="px-4 py-10 text-center">
        <Inbox className="mx-auto mb-2 text-gray-300" size={28} />
        <span className="text-sm text-gray-500">{message}</span>
      </td>
    </tr>
  );
}

// ---------- Pagination ----------
export function Pagination({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return <p className="mt-3 text-xs text-gray-500">{total} record(s)</p>;
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
      <span>
        Page {page} of {pages} ({total} records)
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Button>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

// ---------- Misc ----------
export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
      <Loader2 size={18} className="animate-spin" />
      {label}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
      {message}
    </div>
  );
}

export function PageHeader({ title, actions, sub }: { title: string; actions?: ReactNode; sub?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-gray-500">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
