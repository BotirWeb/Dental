import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { CreatePatientInput, Patient } from "@dental/shared";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import { formatDate } from "../lib/time";

const emptyForm: CreatePatientInput = {
  fullName: "",
  phone: "",
  consentMessaging: false,
  consentData: false,
};

/**
 * Ekran 3 (Bemor qidirish) — NAMUNA SLICE, backend bilan to'liq ulangan.
 * Bu sahifa butun skeletning "refresh bo'lmasdan yangilanadi" talabini
 * ko'rsatadi: qidiruv ham, yangi bemor qo'shish ham sahifani qayta
 * yuklamasdan, faqat React holatini yangilab ishlaydi.
 */
export function PatientsPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreatePatientInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canCreate = user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const timeout = setTimeout(() => {
      const search = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      api
        .get<Patient[]>(`/patients${search}`)
        .then((rows) => {
          if (!controller.signal.aborted) setPatients(rows);
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            setError(err instanceof ApiError ? err.message : "Bemorlarni yuklab bo'lmadi");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250); // debounce — har harfda emas, yozish to'xtaganda so'raladi

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const created = await api.post<Patient>("/patients", form);
      setPatients((prev) => [created, ...prev]);
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Bemorlar</h1>
          <p className="text-sm text-slate-500">Telefon yoki ism bo'yicha qidiring.</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {showForm ? "Bekor qilish" : "+ Yangi bemor"}
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">F.I.Sh</label>
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Telefon</label>
            <input
              required
              placeholder="+998 90 123 45 67"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.consentData}
                onChange={(e) => setForm((f) => ({ ...f, consentData: e.target.checked }))}
              />
              PD ishlov berishga rozilik (bo'lim 8)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.consentMessaging}
                onChange={(e) => setForm((f) => ({ ...f, consentMessaging: e.target.checked }))}
              />
              Xabar yuborishga rozilik
            </label>
          </div>

          {formError && <p className="text-sm text-red-600 sm:col-span-2">{formError}</p>}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Qidirish: ism yoki telefon…"
          className="w-full border-b border-slate-200 px-4 py-3 text-sm focus:outline-none"
        />

        {loading && <p className="p-4 text-sm text-slate-400">Yuklanmoqda…</p>}
        {error && <p className="p-4 text-sm text-red-600">{error}</p>}

        {!loading && !error && patients.length === 0 && (
          <p className="p-4 text-sm text-slate-400">Hech narsa topilmadi.</p>
        )}

        {!loading && !error && patients.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {patients.map((p) => (
              <li key={p.id}>
                <Link to={`/patients/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{p.fullName}</p>
                    <p className="text-xs text-slate-500">{p.phone}</p>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(p.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
