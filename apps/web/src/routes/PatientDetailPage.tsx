import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AppointmentWithPatient, Patient } from "@dental/shared";
import { api, ApiError } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/time";

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  planned: "Rejalashtirilgan",
  confirmed: "Tasdiqlangan",
  arrived: "Keldi",
  done: "Bajarildi",
  no_show: "Kelmadi",
  cancelled_patient: "Bemor bekor qildi",
  cancelled_clinic: "Klinika bekor qildi",
};

/** Ekran 4 "Bemor kartasi" — asosiy ma'lumot + yozuvlar tarixi (ekran 2 bilan
 * bog'liq). To'lovlar va qarz — ekran 6 "Kassa" ishi (hali qurilmagan). */
export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<Patient>(`/patients/${id}`),
      api.get<AppointmentWithPatient[]>(`/appointments?patientId=${id}`),
    ])
      .then(([p, a]) => {
        setPatient(p);
        setAppointments(a);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="space-y-4">
      <Link to="/patients" className="text-sm text-slate-500 hover:text-slate-700">
        ← Bemorlar ro'yxatiga
      </Link>

      {loading && <p className="text-sm text-slate-400">Yuklanmoqda…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {patient && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-slate-900">{patient.fullName}</h1>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-400">Telefon</dt>
              <dd className="text-slate-800">{patient.phone}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Ro'yxatga olingan</dt>
              <dd className="text-slate-800">{formatDate(patient.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">PD roziligi</dt>
              <dd className="text-slate-800">{patient.consentData ? "Bor" : "Yo'q"}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-700">Yozuvlar (ekran 2 "Jadval")</h2>
            {appointments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Hali yozuv yo'q.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
                {appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-slate-800">{formatDateTime(a.startAt)}</span>
                    <span className="text-slate-500">{APPOINTMENT_STATUS_LABELS[a.status] ?? a.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-400">
            To'lovlar va qarz — ekran 6 "Kassa" ishi (qollanma bo'lim 7, hali qurilmagan).
          </div>
        </div>
      )}
    </div>
  );
}
