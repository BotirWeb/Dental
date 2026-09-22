import { useEffect, useState, type FormEvent } from "react";
import type { Chair, CreateAppointmentInput, Doctor, Patient } from "@dental/shared";
import { api, ApiError } from "../lib/api";
import { useNetworkStatus } from "../state/NetworkContext";

const DURATION_OPTIONS_MIN = [15, 30, 45, 60, 90];

function toTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function combineDateAndTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const result = new Date(day);
  result.setHours(h, m, 0, 0);
  return result;
}

export interface AppointmentModalPrefill {
  chairId: string;
  startAt: Date;
}

interface AppointmentModalProps {
  day: Date;
  chairs: Chair[];
  doctors: Doctor[];
  prefill: AppointmentModalPrefill;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Ekran 5 "Yozuv modal" — bo'sh katakka bosilganda ochiladi (ekran 2 ichida).
 * Bemor mavjud ro'yxatdan qidiriladi (yangi bemor bu yerda yaratilmaydi —
 * ekran 3 vazifasi).
 */
export function AppointmentModal({ day, chairs, doctors, prefill, onClose, onCreated }: AppointmentModalProps) {
  const networkStatus = useNetworkStatus();
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [chairId, setChairId] = useState(prefill.chairId);
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const [startTime, setStartTime] = useState(toTimeInputValue(prefill.startAt));
  const [durationMin, setDurationMin] = useState(30);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!patientQuery.trim()) {
      setPatientResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      api
        .get<Patient[]>(`/patients?q=${encodeURIComponent(patientQuery.trim())}`)
        .then(setPatientResults)
        .catch(() => setPatientResults([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [patientQuery]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedPatient) {
      setError("Bemor tanlanmagan — yuqoridan qidirib tanlang");
      return;
    }

    const startAt = combineDateAndTime(day, startTime);
    const endAt = new Date(startAt.getTime() + durationMin * 60_000);

    const input: CreateAppointmentInput = {
      patientId: selectedPatient.id,
      doctorId,
      chairId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      note: note.trim() || undefined,
    };

    setSubmitting(true);
    try {
      await api.postIdempotent("/appointments", input, idempotencyKey);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        // Server javob berdi (rad etdi) — shu kalit shu tana bilan "band",
        // keyingi (tuzatilgan bo'lsa ham) urinish yangi kalit olsin (T4).
        setIdempotencyKey(crypto.randomUUID());
        setError(err.message);
      } else {
        setError("Saqlab bo'lmadi");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Yangi yozuv</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Bemor</label>
            {selectedPatient ? (
              <div className="mt-1 flex items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-sm">
                <span>
                  {selectedPatient.fullName} — {selectedPatient.phone}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null);
                    setPatientQuery("");
                  }}
                  className="text-xs text-slate-500 underline"
                >
                  o'zgartirish
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  placeholder="Ism yoki telefon bo'yicha qidiring…"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
                {patientResults.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                    {patientResults.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPatient(p);
                            setPatientResults([]);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          {p.fullName} — {p.phone}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Shifokor</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Kreslo</label>
              <select
                value={chairId}
                onChange={(e) => setChairId(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {chairs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Boshlanish vaqti</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Davomiyligi</label>
              <select
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {DURATION_OPTIONS_MIN.map((min) => (
                  <option key={min} value={min}>
                    {min} daqiqa
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Izoh (ixtiyoriy)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={submitting || networkStatus !== "online"}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
