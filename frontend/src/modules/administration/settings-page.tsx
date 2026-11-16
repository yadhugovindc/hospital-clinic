import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clinicApi } from '../../services';
import { Button, ErrorNote, Field, Input, PageHeader, Spinner } from '../../components/ui';
import { getApiError } from '../../lib/api';

interface SettingsForm { clinicName: string; address: string; phone: string; email: string; gstinNumber: string; currency: string; timezone: string; defaultTaxRatePercent: string; consultationFee: string }

const blank: SettingsForm = { clinicName: '', address: '', phone: '', email: '', gstinNumber: '', currency: 'INR', timezone: 'Asia/Kolkata', defaultTaxRatePercent: '0', consultationFee: '0' };

export default function SettingsPage() {
  const client = useQueryClient();
  const settings = useQuery({ queryKey: ['clinic-settings'], queryFn: clinicApi.get });
  const [form, setForm] = useState(blank);
  const [feedback, setFeedback] = useState('');
  useEffect(() => { if (settings.data) setForm({ clinicName: settings.data.clinicName, address: settings.data.address ?? '', phone: settings.data.phone ?? '', email: settings.data.email ?? '', gstinNumber: settings.data.gstinNumber ?? '', currency: settings.data.currency, timezone: settings.data.timezone, defaultTaxRatePercent: String(settings.data.defaultTaxRatePercent), consultationFee: (settings.data.consultationFeeMinor / 100).toFixed(2) }); }, [settings.data]);
  const save = useMutation({ mutationFn: () => clinicApi.update({ clinicName: form.clinicName.trim(), address: form.address.trim() || undefined, phone: form.phone.trim() || undefined, email: form.email.trim() || undefined, gstinNumber: form.gstinNumber.trim() || undefined, currency: form.currency.toUpperCase(), timezone: form.timezone.trim(), defaultTaxRatePercent: Number(form.defaultTaxRatePercent), consultationFeeMinor: Math.round(Number(form.consultationFee) * 100) }), onSuccess: () => { setFeedback('Clinic settings saved.'); void client.invalidateQueries({ queryKey: ['clinic-settings'] }); }, onError: (err) => setFeedback(getApiError(err).message) });
  const update = (key: keyof SettingsForm, value: string): void => setForm((current) => ({ ...current, [key]: value }));
  if (settings.isLoading) return <Spinner label="Loading clinic settings…" />;
  if (settings.error) return <ErrorNote message={getApiError(settings.error).message} />;
  return <div>
    <PageHeader title="Clinic settings" sub="Identity, contact details, currency, and default charges" />
    {feedback && <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${feedback.includes('saved') ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`} role="status">{feedback}</div>}
    <form className="max-w-3xl rounded-lg border border-gray-200 bg-white p-5" onSubmit={(event) => { event.preventDefault(); setFeedback(''); save.mutate(); }}>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Clinic name *"><Input value={form.clinicName} onChange={(event) => update('clinicName', event.target.value)} required minLength={2} /></Field><Field label="Phone"><Input value={form.phone} onChange={(event) => update('phone', event.target.value)} /></Field><Field label="Email"><Input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></Field><Field label="GSTIN"><Input value={form.gstinNumber} onChange={(event) => update('gstinNumber', event.target.value)} /></Field><div className="sm:col-span-2"><Field label="Address"><Input value={form.address} onChange={(event) => update('address', event.target.value)} /></Field></div><Field label="Currency code"><Input value={form.currency} maxLength={3} onChange={(event) => update('currency', event.target.value)} /></Field><Field label="Timezone"><Input value={form.timezone} onChange={(event) => update('timezone', event.target.value)} /></Field><Field label="Default tax (%)"><Input type="number" min="0" max="28" step="0.1" value={form.defaultTaxRatePercent} onChange={(event) => update('defaultTaxRatePercent', event.target.value)} /></Field><Field label="Consultation fee"><Input type="number" min="0" step="0.01" value={form.consultationFee} onChange={(event) => update('consultationFee', event.target.value)} /></Field></div>
      <div className="mt-5 flex justify-end"><Button type="submit" loading={save.isPending}>Save settings</Button></div>
    </form>
  </div>;
}