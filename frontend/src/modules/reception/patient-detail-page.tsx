import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { receptionApi, clinicalApi, usersApi } from "../../services";
import { formatDate, patientAge } from "../../lib/format";
import {
  Button,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  EmptyRow,
  Textarea,
} from "../../components/ui";
import { getApiError } from "../../lib/api";

interface Details {
  name: string;
  ageYears: string;
  phone: string;
  altPhone: string;
  email: string;
  address: string;
  registrationNotes: string;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const patient = useQuery({
    queryKey: ["patient", id],
    queryFn: () => receptionApi.patient(id!),
  });
  const visits = useQuery({
    queryKey: ["patient-visits", id],
    queryFn: () => clinicalApi.history(id!).catch(() => []),
  });
  const doctors = useQuery({
    queryKey: ["doctors"],
    queryFn: usersApi.doctors,
  });

  const [details, setDetails] = useState<Details>({
    name: "",
    ageYears: "",
    phone: "",
    altPhone: "",
    email: "",
    address: "",
    registrationNotes: "",
  });
  const [toast, setToast] = useState<Toast | null>(null);
  const [doctorId, setDoctorId] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (patient.data) {
      const calculatedAge = patientAge(patient.data).match(/^\d+/)?.[0] ?? "";
      setDetails({
        name: patient.data.name,
        ageYears:
          patient.data.ageYears != null
            ? String(patient.data.ageYears)
            : calculatedAge,
        phone: patient.data.phone,
        altPhone: patient.data.altPhone ?? "",
        email: patient.data.email ?? "",
        address: patient.data.address ?? "",
        registrationNotes: patient.data.registrationNotes ?? "",
      });
    }
  }, [patient.data]);

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {};
      if (details.name !== patient.data?.name)
        payload.name = details.name.trim();
      if (
        details.ageYears !== "" &&
        Number(details.ageYears) !== patient.data?.ageYears
      )
        payload.ageYears = Number(details.ageYears);
      if (details.phone !== patient.data?.phone)
        payload.phone = details.phone.trim();
      if (details.altPhone !== (patient.data?.altPhone ?? ""))
        payload.altPhone = details.altPhone.trim();
      if (details.email !== (patient.data?.email ?? ""))
        payload.email = details.email.trim();
      if (details.address !== (patient.data?.address ?? ""))
        payload.address = details.address.trim();
      if (details.registrationNotes !== (patient.data?.registrationNotes ?? ""))
        payload.registrationNotes = details.registrationNotes.trim();
      return receptionApi.updatePatient(id!, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient", id] });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });

  const bookToken = useMutation({
    mutationFn: () =>
      receptionApi.bookToken({
        patientId: id!,
        doctorId: doctorId || undefined,
      }),
    onSuccess: async (token) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tokens"] }),
        queryClient.invalidateQueries({ queryKey: ["token-counts"] }),
      ]);
      const doctorName = doctors.data?.doctors.find(
        (doctor) => doctor.id === doctorId,
      )?.name;
      setToast({
        message: `Token #${token.tokenNumber} booked successfully${doctorName ? ` with ${doctorName}` : ""}.`,
        type: "success",
      });
    },
    onError: (error) =>
      setToast({ message: getApiError(error).message, type: "error" }),
  });

  if (patient.isLoading)
    return <p className="text-sm text-gray-500">Loading patient…</p>;
  if (patient.error)
    return (
      <p className="text-sm text-red-600">
        {getApiError(patient.error).message}
      </p>
    );
  const p = patient.data!;

  return (
    <div>
      {toast && (
        <div
          role={toast.type === "error" ? "alert" : "status"}
          aria-live={toast.type === "error" ? "assertive" : "polite"}
          className={`fixed bottom-5 right-5 z-50 rounded-md border px-4 py-3 text-sm shadow-lg ${
            toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.message}
        </div>
      )}
      <PageHeader
        title={p.name}
        sub={`UHID ${p.uhid} · ${p.gender} · ${patientAge(p)} · registered ${formatDate(p.createdAt)}`}
        actions={
          <Link to="/reception/patients">
            <Button variant="secondary">Back to list</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            Demographics
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input
                value={details.name}
                onChange={(e) =>
                  setDetails({ ...details, name: e.target.value })
                }
              />
            </Field>
            <Field label="Age (years)">
              <Input
                type="number"
                min={0}
                max={130}
                value={details.ageYears}
                onChange={(e) =>
                  setDetails({ ...details, ageYears: e.target.value })
                }
              />
            </Field>
            <Field label="Phone">
              <Input
                value={details.phone}
                onChange={(e) =>
                  setDetails({ ...details, phone: e.target.value })
                }
              />
            </Field>
            <Field label="Alternate phone">
              <Input
                value={details.altPhone}
                onChange={(e) =>
                  setDetails({ ...details, altPhone: e.target.value })
                }
              />
            </Field>
            <Field label="Email">
              <Input
                value={details.email}
                onChange={(e) =>
                  setDetails({ ...details, email: e.target.value })
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <Input
                  value={details.address}
                  onChange={(e) =>
                    setDetails({ ...details, address: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Registration notes">
                <Textarea
                  value={details.registrationNotes}
                  onChange={(e) =>
                    setDetails({
                      ...details,
                      registrationNotes: e.target.value,
                    })
                  }
                />
              </Field>
            </div>
          </div>
          <div className="mt-4">
            {save.error && (
              <div className="mb-3">
                <ErrorNote message={getApiError(save.error).message} />
              </div>
            )}
            <Button
              type="submit"
              onClick={() => save.mutate()}
              loading={save.isPending}
            >
              Save changes
            </Button>
          </div>
        </section>

        <section className="rounded-lg border bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            Visit history
          </h2>
          <Table head={["Date", "Status", "Follow-up"]}>
            {(visits.data ?? []).length === 0 && (
              <EmptyRow span={3} message="No recorded visits" />
            )}
            {(visits.data ?? []).map((v) => (
              <tr key={v._id}>
                <td className="px-4 py-2.5">{v.visitDate}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={v.status} />
                </td>
                <td className="px-4 py-2.5">{v.followUpDate ?? "—"}</td>
              </tr>
            ))}
          </Table>
          <div className="mt-4">
            <div className="max-w-sm space-y-3">
              <Field label="Assign doctor (optional)">
                <Select
                  value={doctorId}
                  onChange={(event) => setDoctorId(event.target.value)}
                  disabled={doctors.isLoading || bookToken.isPending}
                >
                  <option value="">
                    {doctors.isLoading
                      ? "Loading doctors…"
                      : "Leave unassigned"}
                  </option>
                  {(doctors.data?.doctors ?? []).map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {doctors.error && (
                <ErrorNote message={getApiError(doctors.error).message} />
              )}
              {!doctors.isLoading &&
                !doctors.error &&
                doctors.data?.doctors.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No active doctors available to assign.
                  </p>
                )}
              <Field label="Book token">
                <Button
                  variant="secondary"
                  loading={bookToken.isPending}
                  disabled={doctors.isLoading || !!doctors.error}
                  onClick={() => bookToken.mutate()}
                >
                  Book today's token
                </Button>
              </Field>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
