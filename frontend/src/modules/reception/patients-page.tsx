import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { receptionApi } from '../../services';
import { formatDate, titleCase, patientAge, todayIso } from '../../lib/format';
import { Button, EmptyRow, ErrorNote, Field, Input, PageHeader, Pagination, Select, Table, Textarea } from '../../components/ui';
import { getApiError } from '../../lib/api';

const PAGE_SIZE = 15;

interface RegisterForm {
  name: string;
  gender: 'male' | 'female' | 'other';
  phone: string;
  dateOfBirth: string;
  ageYears: string;
  email: string;
  address: string;
  registrationNotes: string;
}

export default function PatientsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState({ name: '', phone: '', uhid: '' });
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState('');

  const patients = useQuery({
    queryKey: ['patients', page, search],
    queryFn: () =>
      receptionApi.searchPatients({
        page,
        limit: PAGE_SIZE,
        name: search.name || undefined,
        phone: search.phone || undefined,
        uhid: search.uhid || undefined,
      }),
  });

  const [form, setForm] = useState<RegisterForm>({
    name: '', gender: 'female', phone: '', dateOfBirth: '', ageYears: '', email: '', address: '', registrationNotes: '',
  });
  const [duplicates, setDuplicates] = useState<Array<{ id: string; uhid: string; name: string; phone: string }> | null>(null);
  const [formError, setFormError] = useState('');

  const checkDuplicates = useMutation({
    mutationFn: () =>
      receptionApi.checkDuplicates({
        phone: form.phone || undefined,
        name: form.name || undefined,
        gender: form.gender,
      }),
  });

  const register = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        gender: form.gender,
        phone: form.phone.trim(),
      };
      if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
      else if (form.ageYears) payload.ageYears = Number(form.ageYears);
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.address.trim()) payload.address = form.address.trim();
      if (form.registrationNotes.trim()) payload.registrationNotes = form.registrationNotes.trim();
      return receptionApi.register(payload);
    },
    onSuccess: (patient) => {
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      setShowForm(false);
      setDuplicates(null);
      setForm({ name: '', gender: 'female', phone: '', dateOfBirth: '', ageYears: '', email: '', address: '', registrationNotes: '' });
      setFeedback(`Patient registered successfully — UHID: ${patient.uhid}`);
    },
    onError: (err) => setFormError(getApiError(err).message),
  });

  const submitForm = async (): Promise<void> => {
    setFormError('');
    if (!form.dateOfBirth && !form.ageYears) {
      setFormError('Enter a date of birth or age to register this patient.');
      return;
    }
    try {
      const dup = await checkDuplicates.mutateAsync();
      if (dup.length > 0) {
        setDuplicates(dup);
        return;
      }
    } catch (err) {
      setFormError(getApiError(err).message);
      return;
    }
    register.mutate();
  };

  return (
    <div>
      <PageHeader
        title="Patients"
        sub="Register, search, and manage patient records"
        actions={<Button onClick={() => { setShowForm((v) => !v); setDuplicates(null); }}>{showForm ? 'Close form' : 'New patient'}</Button>}
      />

      {feedback && <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{feedback}</div>}

      {showForm && (
        <div className="mb-6 rounded-lg border bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Register new patient</h2>
          {formError && <div className="mb-3"><ErrorNote message={formError} /></div>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Full name *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Gender *">
              <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as RegisterForm['gender'] })}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Phone *">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 …" />
            </Field>
            <Field label="Date of birth" hint="Either DOB or age is required">
              <Input type="date" value={form.dateOfBirth} max={todayIso()} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            </Field>
            <Field label="Age (years)" hint="Used when DOB is unknown">
              <Input type="number" min={0} max={130} value={form.ageYears} onChange={(e) => setForm({ ...form, ageYears: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <div className="sm:col-span-2 lg:col-span-2">
              <Field label="Address">
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Registration notes">
                <Textarea value={form.registrationNotes} onChange={(e) => setForm({ ...form, registrationNotes: e.target.value })} />
              </Field>
            </div>
          </div>

          {duplicates && duplicates.length > 0 && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">Possible duplicate patient records found — review before creating:</p>
              <ul className="mt-2 list-inside list-disc">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    {d.uhid} — {d.name} ({d.phone})
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => { setDuplicates(null); register.mutate(); }} loading={register.isPending}>
                  Continue anyway
                </Button>
                <Button variant="ghost" onClick={() => setDuplicates(null)}>Revise details</Button>
              </div>
            </div>
          )}

          {(!duplicates || duplicates.length === 0) && (
            <div className="mt-4">
              <Button onClick={() => void submitForm()} loading={checkDuplicates.isPending || register.isPending}>
                Register patient
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <Input placeholder="Search by name" value={search.name} onChange={(e) => { setPage(1); setSearch({ ...search, name: e.target.value }); }} aria-label="Search by name" />
        <Input placeholder="Search by phone" value={search.phone} onChange={(e) => { setPage(1); setSearch({ ...search, phone: e.target.value }); }} aria-label="Search by phone" />
        <Input placeholder="Search by UHID" value={search.uhid} onChange={(e) => { setPage(1); setSearch({ ...search, uhid: e.target.value }); }} aria-label="Search by UHID" />
      </div>

      {patients.isLoading ? (
        <p className="text-sm text-gray-500">Loading patients…</p>
      ) : patients.error ? (
        <p className="text-sm text-red-600">{getApiError(patients.error).message}</p>
      ) : (
        <>
          <Table head={['UHID', 'Name', 'Gender', 'Age', 'Phone', 'Registered', '']}>
            {patients.data!.patients.length === 0 && <EmptyRow span={7} message="No patients match the search" />}
            {patients.data!.patients.map((p) => (
              <tr key={p._id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs">{p.uhid}</td>
                <td className="px-4 py-2.5 font-medium text-brand-700">{p.name}</td>
                <td className="px-4 py-2.5">{titleCase(p.gender)}</td>
                <td className="px-4 py-2.5">{patientAge(p)}</td>
                <td className="px-4 py-2.5">{p.phone}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(p.createdAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link className="text-sm font-medium text-brand-700 hover:underline" to={`/reception/patients/${p._id}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} limit={PAGE_SIZE} total={patients.data!.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
