import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { clinicalApi, pharmacyApi } from '../../services';
import { Button, ErrorNote, Field, Input, PageHeader, Select, Spinner, Textarea } from '../../components/ui';
import { getApiError } from '../../lib/api';
import { formatDate, patientAge } from '../../lib/format';

interface PrescriptionRow {
  medicineId: string;
  dosage: string;
  frequency: string;
  timing: string;
  durationDays: string;
  instructions: string;
}

const emptyRow = (): PrescriptionRow => ({ medicineId: '', dosage: '', frequency: '', timing: '', durationDays: '', instructions: '' });

export default function ConsultationPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const queryClient = useQueryClient();
  const visit = useQuery({ queryKey: ['visit', visitId], queryFn: () => clinicalApi.visit(visitId!) });
  const medicines = useQuery({ queryKey: ['active-medicines'], queryFn: () => pharmacyApi.medicines({ limit: 100 }) });
  const [complaints, setComplaints] = useState('');
  const [notes, setNotes] = useState('');
  const [findings, setFindings] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [investigations, setInvestigations] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [vitals, setVitals] = useState<Record<string, string>>({});
  const [generalInstructions, setGeneralInstructions] = useState('');
  const [rows, setRows] = useState<PrescriptionRow[]>([emptyRow()]);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visit.data) return;
    setComplaints(visit.data.chiefComplaints ?? '');
    setNotes(visit.data.clinicalNotes ?? '');
    setFindings(visit.data.examinationFindings ?? '');
    setDiagnosis(visit.data.diagnosis ?? '');
    setInvestigations(visit.data.investigations ?? '');
    setFollowUpDate(visit.data.followUpDate?.slice(0, 10) ?? '');
    setFollowUpNotes(visit.data.followUpNotes ?? '');
    setVitals(Object.fromEntries(Object.entries(visit.data.vitals ?? {}).map(([key, value]) => [key, String(value)])));
  }, [visit.data]);

  const visitPayload = (complete = false): Record<string, unknown> => ({
    chiefComplaints: complaints.trim(), clinicalNotes: notes.trim(), examinationFindings: findings.trim(),
    diagnosis: diagnosis.trim(), investigations: investigations.trim(), followUpDate: followUpDate || undefined,
    followUpNotes: followUpNotes.trim(),
    vitals: Object.fromEntries(Object.entries(vitals).filter(([, value]) => value !== '').map(([key, value]) => [key, Number(value)])),
    ...(complete ? { status: 'completed' } : {}),
  });

  const saveVisit = useMutation({
    mutationFn: (complete: boolean) => clinicalApi.updateVisit(visitId!, visitPayload(complete)),
    onSuccess: () => { setFeedback('Consultation notes saved.'); setError(''); void queryClient.invalidateQueries({ queryKey: ['visit', visitId] }); },
    onError: (err) => setError(getApiError(err).message),
  });

  const savePrescription = useMutation({
    mutationFn: () => clinicalApi.createPrescription({
      visitId: visitId!,
      items: rows.map((row) => ({
        medicineId: row.medicineId,
        dosage: row.dosage || undefined,
        frequency: row.frequency.trim(),
        timing: row.timing || undefined,
        durationDays: row.durationDays ? Number(row.durationDays) : undefined,
        instructions: row.instructions || undefined,
      })),
      generalInstructions: generalInstructions.trim() || undefined,
      status: 'finalized',
    }),
    onSuccess: () => { setFeedback('Prescription finalized.'); setError(''); void queryClient.invalidateQueries({ queryKey: ['visit', visitId] }); },
    onError: (err) => setError(getApiError(err).message),
  });

  if (visit.isLoading) return <Spinner label="Loading consultation…" />;
  if (visit.error || !visit.data) return <ErrorNote message={getApiError(visit.error).message} />;
  const current = visit.data;
  const patient = current.patientId as unknown as { _id: string; name: string; uhid: string; gender: string; ageYears?: number; dateOfBirth?: string };

  return (
    <div>
      <PageHeader title="Consultation" sub={`${patient.name} · ${patient.uhid} · ${patient.gender} · ${patientAge(patient)} · ${formatDate(current.visitDate)}`} actions={<Link to="/doctor/queue"><Button variant="secondary"><ArrowLeft size={16} /> Queue</Button></Link>} />
      {feedback && <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">{feedback}</div>}
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      {current.status !== 'open' && <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">This visit is {current.status}. Notes remain available for review.</div>}

      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); saveVisit.mutate(false); }}>
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Clinical notes</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Chief complaints"><Textarea disabled={current.status !== 'open'} value={complaints} onChange={(event) => setComplaints(event.target.value)} /></Field>
            <Field label="Examination findings"><Textarea disabled={current.status !== 'open'} value={findings} onChange={(event) => setFindings(event.target.value)} /></Field>
            <Field label="Diagnosis"><Textarea disabled={current.status !== 'open'} value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} /></Field>
            <Field label="Investigations"><Textarea disabled={current.status !== 'open'} value={investigations} onChange={(event) => setInvestigations(event.target.value)} /></Field>
            <div className="md:col-span-2"><Field label="Clinical notes"><Textarea disabled={current.status !== 'open'} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field></div>
            <Field label="Follow-up date"><Input disabled={current.status !== 'open'} type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /></Field>
            <Field label="Follow-up instructions"><Input disabled={current.status !== 'open'} value={followUpNotes} onChange={(event) => setFollowUpNotes(event.target.value)} /></Field>
          </div>
          <h3 className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">Vitals</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['temperatureC', 'Temperature (°C)', '0.1'], ['pulseBpm', 'Pulse (bpm)', '1'], ['respRate', 'Respiratory rate', '1'],
              ['bpSystolic', 'Systolic BP', '1'], ['bpDiastolic', 'Diastolic BP', '1'], ['weightKg', 'Weight (kg)', '0.1'],
              ['heightCm', 'Height (cm)', '0.1'], ['spo2', 'SpO₂ (%)', '1'],
            ].map(([key, label, step]) => <Field key={key} label={label}><Input disabled={current.status !== 'open'} type="number" step={step} value={vitals[key] ?? ''} onChange={(event) => setVitals({ ...vitals, [key]: event.target.value })} /></Field>)}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit" disabled={current.status !== 'open'} loading={saveVisit.isPending}>Save consultation</Button>
            {current.status === 'open' && <Button type="button" variant="secondary" loading={saveVisit.isPending} onClick={() => saveVisit.mutate(true)}>Complete visit</Button>}
          </div>
        </section>
      </form>

      <section className="mt-5 rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-gray-900">Prescription</h2><p className="mt-1 text-xs text-gray-500">Select medicines from the active clinic inventory.</p></div>
          <Button type="button" variant="secondary" disabled={current.status !== 'open'} onClick={() => setRows([...rows, emptyRow()])}><Plus size={15} /> Add medicine</Button>
        </div>
        {medicines.error && <ErrorNote message={getApiError(medicines.error).message} />}
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="grid gap-3 rounded-md border border-gray-200 p-3 sm:grid-cols-2 lg:grid-cols-6">
              <Field label="Medicine"><Select value={row.medicineId} onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, medicineId: event.target.value } : item))}><option value="">Choose medicine</option>{(medicines.data?.medicines ?? []).map((medicine) => <option key={medicine._id} value={medicine._id}>{medicine.name}{medicine.strength ? ` · ${medicine.strength}` : ''}</option>)}</Select></Field>
              <Field label="Dosage"><Input placeholder="e.g. 1 tablet" value={row.dosage} onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, dosage: event.target.value } : item))} /></Field>
              <Field label="Frequency *"><Input placeholder="e.g. twice daily" value={row.frequency} onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, frequency: event.target.value } : item))} /></Field>
              <Field label="Timing"><Input placeholder="After meals" value={row.timing} onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, timing: event.target.value } : item))} /></Field>
              <Field label="Days"><Input type="number" min="1" value={row.durationDays} onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, durationDays: event.target.value } : item))} /></Field>
              <div className="flex items-end gap-2"><Field label="Instructions"><Input value={row.instructions} onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, instructions: event.target.value } : item))} /></Field><button type="button" className="mb-1 rounded p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label="Remove medicine" onClick={() => setRows(rows.filter((_, i) => i !== index))}><Trash2 size={16} /></button></div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1"><Field label="General instructions"><Input value={generalInstructions} onChange={(event) => setGeneralInstructions(event.target.value)} placeholder="Diet, rest, or other guidance" /></Field></div>
          <Button loading={savePrescription.isPending} disabled={current.status !== 'open' || rows.some((row) => !row.medicineId || !row.frequency.trim())} onClick={() => savePrescription.mutate()}>Finalize prescription</Button>
        </div>
      </section>
    </div>
  );
}