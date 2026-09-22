import { useEffect, useState, type FormEvent } from "react";
import type { CreateExpenseInput, Expense } from "@dental/shared";
import { api, ApiError } from "../lib/api";
import { useNetworkStatus } from "../state/NetworkContext";
import { formatDate } from "../lib/time";

const COMMON_CATEGORIES = ["Materiallar", "Ijara", "Kommunal", "Ish haqi", "Reklama", "Boshqa"];

function som(value: string | number): string {
  return Math.round(Number(value)).toLocaleString("uz-UZ") + " so'm";
}

function todayInputValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyForm: CreateExpenseInput = {
  category: "",
  amount: 0,
  spentAt: todayInputValue(),
  isRecurring: false,
};

/** Ekran 7 "Xarajatlar". Kategoriya — erkin matn (bo'lim 5), tezlashtirish uchun taklif ro'yxati bilan. */
export function ExpensesPage() {
  const networkStatus = useNetworkStatus();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateExpenseInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createKey, setCreateKey] = useState(() => crypto.randomUUID());

  function reload() {
    setLoading(true);
    setError(null);
    api
      .get<Expense[]>("/expenses")
      .then(setExpenses)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Xarajatlarni yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);
  useEffect(() => {
    if (showForm) setCreateKey(crypto.randomUUID());
  }, [showForm]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const created = await api.postIdempotent<Expense>(
        "/expenses",
        { ...form, spentAt: new Date(form.spentAt).toISOString() },
        createKey,
      );
      setExpenses((prev) => [created, ...prev]);
      setForm(emptyForm);
      setShowForm(false);
      setCreateKey(crypto.randomUUID());
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  const total = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Xarajatlar</h1>
          <p className="text-sm text-slate-500">Jami: {som(total)}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "Bekor qilish" : "+ Yangi xarajat"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">Kategoriya</label>
            <input
              required
              list="expense-categories"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <datalist id="expense-categories">
              {COMMON_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Summa (so'm)</label>
            <input
              type="number"
              required
              min={1}
              value={form.amount || ""}
              onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Sana</label>
            <input
              type="date"
              required
              value={form.spentAt}
              onChange={(e) => setForm((f) => ({ ...f, spentAt: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Izoh (ixtiyoriy)</label>
            <input
              value={form.note ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={(e) => setForm((f) => ({ ...f, isRecurring: e.target.checked }))}
            />
            Doimiy (har oy takrorlanadigan) xarajat
          </label>

          {formError && <p className="text-sm text-red-600 sm:col-span-2">{formError}</p>}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving || networkStatus !== "online"}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading && <p className="p-4 text-sm text-slate-400">Yuklanmoqda…</p>}
        {error && <p className="p-4 text-sm text-red-600">{error}</p>}
        {!loading && !error && expenses.length === 0 && (
          <p className="p-4 text-sm text-slate-400">Hali xarajat yozilmagan.</p>
        )}
        {!loading && !error && expenses.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">
                    {e.category}
                    {e.isRecurring ? " (doimiy)" : ""}
                  </p>
                  {e.note && <p className="text-xs text-slate-500">{e.note}</p>}
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-900">{som(e.amount)}</p>
                  <p className="text-xs text-slate-400">{formatDate(e.spentAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
