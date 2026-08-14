import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Patient } from "@dental/shared";
import { api, ApiError } from "../lib/api";
import { formatDate } from "../lib/time";

/** Ekran 4 "Bemor kartasi" — hozircha faqat asosiy ma'lumot. Vizit tarixi,
 * to'lovlar va qarz — hafta 3-6 ishi (appointments/visits/payments). */
export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api
      .get<Patient>(`/patients/${id}`)
      .then(setPatient)
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

          <div className="mt-6 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-400">
            Vizit tarixi, to'lovlar va qarz — bu bo'lim hafta 3-6 ishi (qollanma bo'lim 7).
          </div>
        </div>
      )}
    </div>
  );
}
