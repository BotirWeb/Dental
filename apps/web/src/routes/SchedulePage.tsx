import { useEffect, useMemo, useState } from "react";
import type { AppointmentWithPatient, Chair, Doctor } from "@dental/shared";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import { formatDate, formatTime } from "../lib/time";
import { AppointmentModal, type AppointmentModalPrefill } from "../components/AppointmentModal";

// FARAZ: klinika ish soati hech qayerda sozlanmagan (bo'lim 13/talablar.md'ga
// yozilishi kerak — [?] klinikaga xos bo'lishi mumkin). Hozircha 08:00-20:00
// qattiq belgilangan — real ish vaqti aniqlangach sozlamaga ko'chiriladi.
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const SLOT_MINUTES = 30;
const TOTAL_SLOTS = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES;

const STATUS_LABELS: Record<string, string> = {
  planned: "Rejalashtirilgan",
  confirmed: "Tasdiqlangan",
  arrived: "Keldi",
  done: "Bajarildi",
  no_show: "Kelmadi",
  cancelled_patient: "Bemor bekor qildi",
  cancelled_clinic: "Klinika bekor qildi",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-blue-100 text-blue-800 border-blue-200",
  confirmed: "bg-indigo-100 text-indigo-800 border-indigo-200",
  arrived: "bg-amber-100 text-amber-800 border-amber-200",
  done: "bg-emerald-100 text-emerald-800 border-emerald-200",
  no_show: "bg-red-100 text-red-800 border-red-200",
  cancelled_patient: "bg-slate-100 text-slate-500 border-slate-200 line-through",
  cancelled_clinic: "bg-slate-100 text-slate-500 border-slate-200 line-through",
};

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Ekran 2 "Jadval" — kun ko'rinishi, kreslo × vaqt grid. */
export function SchedulePage() {
  const { user } = useAuth();
  const canCreate = user?.role === "owner" || user?.role === "admin";

  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [chairs, setChairs] = useState<Chair[]>([]);
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalPrefill, setModalPrefill] = useState<AppointmentModalPrefill | null>(null);
  const [selected, setSelected] = useState<AppointmentWithPatient | null>(null);

  useEffect(() => {
    api.get<Doctor[]>("/doctors").then(setDoctors).catch(() => setDoctors([]));
    api.get<Chair[]>("/chairs").then(setChairs).catch(() => setChairs([]));
  }, []);

  function reload() {
    setLoading(true);
    setError(null);
    const from = day.toISOString();
    const to = addDays(day, 1).toISOString();
    api
      .get<AppointmentWithPatient[]>(`/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(setAppointments)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Jadvalni yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [day]);

  const dayStart = useMemo(() => {
    const d = new Date(day);
    d.setHours(DAY_START_HOUR, 0, 0, 0);
    return d;
  }, [day]);

  function slotIndexForTime(t: Date): number {
    return Math.round((t.getTime() - dayStart.getTime()) / (SLOT_MINUTES * 60_000));
  }

  const occupied = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const a of appointments) {
      const start = Math.max(0, slotIndexForTime(new Date(a.startAt)));
      const end = Math.min(TOTAL_SLOTS, slotIndexForTime(new Date(a.endAt)));
      const set = map.get(a.chairId) ?? new Set<number>();
      for (let i = start; i < end; i++) set.add(i);
      map.set(a.chairId, set);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, dayStart]);

  if (chairs.length === 0 && !loading) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900">Jadval</h1>
        <p className="text-sm text-slate-500">
          Hali kreslo sozlanmagan. Kreslo qo'shilmaguncha jadval bo'sh ko'rinadi (sozlash — keyingi ish).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Jadval</h1>
          <p className="text-sm text-slate-500">{formatDate(day.toISOString())}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDay((d) => addDays(d, -1))}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            ← Oldingi
          </button>
          <button
            onClick={() => setDay(startOfDay(new Date()))}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Bugun
          </button>
          <button
            onClick={() => setDay((d) => addDays(d, 1))}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Keyingi →
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-400">Yuklanmoqda…</p>}

      {!loading && chairs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <div
            className="grid min-w-[640px]"
            style={{
              gridTemplateColumns: `80px repeat(${chairs.length}, minmax(140px, 1fr))`,
              gridTemplateRows: `2.5rem repeat(${TOTAL_SLOTS}, 2.25rem)`,
            }}
          >
            <div className="sticky top-0 z-10 border-b border-r border-slate-200 bg-slate-50" style={{ gridColumn: 1, gridRow: 1 }} />
            {chairs.map((c, ci) => (
              <div
                key={c.id}
                className="sticky top-0 z-10 flex items-center justify-center border-b border-r border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-700"
                style={{ gridColumn: ci + 2, gridRow: 1 }}
              >
                {c.name}
              </div>
            ))}

            {Array.from({ length: TOTAL_SLOTS }, (_, si) => {
              const t = new Date(dayStart.getTime() + si * SLOT_MINUTES * 60_000);
              const showLabel = si % 2 === 0; // faqat to'liq soatda (2 x 30min)
              return (
                <div
                  key={`label-${si}`}
                  className="border-b border-r border-slate-100 px-1 text-right text-[11px] text-slate-400"
                  style={{ gridColumn: 1, gridRow: si + 2 }}
                >
                  {showLabel ? formatTime(t.toISOString()) : ""}
                </div>
              );
            })}

            {chairs.map((c, ci) =>
              Array.from({ length: TOTAL_SLOTS }, (_, si) => {
                if (occupied.get(c.id)?.has(si)) return null;
                const slotStart = new Date(dayStart.getTime() + si * SLOT_MINUTES * 60_000);
                return (
                  <button
                    key={`cell-${c.id}-${si}`}
                    type="button"
                    disabled={!canCreate}
                    onClick={() => setModalPrefill({ chairId: c.id, startAt: slotStart })}
                    className="border-b border-r border-slate-100 hover:bg-slate-50 disabled:hover:bg-transparent"
                    style={{ gridColumn: ci + 2, gridRow: si + 2 }}
                    aria-label={`${c.name}, ${formatTime(slotStart.toISOString())} — yangi yozuv`}
                  />
                );
              }),
            )}

            {appointments.map((a) => {
              const ci = chairs.findIndex((c) => c.id === a.chairId);
              if (ci === -1) return null;
              const start = Math.max(0, slotIndexForTime(new Date(a.startAt)));
              const end = Math.min(TOTAL_SLOTS, slotIndexForTime(new Date(a.endAt)));
              if (end <= start) return null;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a)}
                  className={`m-0.5 overflow-hidden rounded border px-1.5 py-1 text-left text-xs ${STATUS_COLORS[a.status] ?? "bg-slate-100"}`}
                  style={{ gridColumn: ci + 2, gridRow: `${start + 2} / ${end + 2}` }}
                >
                  <div className="truncate font-medium">{a.patientFullName}</div>
                  <div className="truncate opacity-75">
                    {formatTime(a.startAt)}–{formatTime(a.endAt)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {modalPrefill && (
        <AppointmentModal
          day={day}
          chairs={chairs}
          doctors={doctors}
          prefill={modalPrefill}
          onClose={() => setModalPrefill(null)}
          onCreated={() => {
            setModalPrefill(null);
            reload();
          }}
        />
      )}

      {selected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{selected.patientFullName}</h2>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {formatTime(selected.startAt)}–{formatTime(selected.endAt)}
            </p>
            {selected.note && <p className="mt-2 text-sm text-slate-700">{selected.note}</p>}

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700">Holat</label>
              <select
                value={selected.status}
                disabled={!canCreate}
                onChange={async (e) => {
                  const status = e.target.value;
                  try {
                    await api.patch(`/appointments/${selected.id}`, { status });
                    setSelected(null);
                    reload();
                  } catch (err) {
                    setError(err instanceof ApiError ? err.message : "Holatni o'zgartirib bo'lmadi");
                  }
                }}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
