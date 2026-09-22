import { useEffect, useState, type FormEvent } from "react";
import type { CreateServiceCategoryInput, CreateServiceInput, Service, ServiceCategory } from "@dental/shared";
import { api, ApiError } from "../lib/api";
import { useNetworkStatus } from "../state/NetworkContext";

function som(value: string | number): string {
  return Math.round(Number(value)).toLocaleString("uz-UZ") + " so'm";
}

const emptyServiceForm: CreateServiceInput = { name: "", price: 0, materialCost: 0 };
const emptyCategoryForm: CreateServiceCategoryInput = { name: "", defaultDoctorPct: 0 };

/** Ekran 11 "Xizmat va narxlar" — owner-only. Narx tahrirlangani o'tgan vizitlarga ta'sir qilmaydi (bo'lim 5.1, Tamoyil #2). */
export function ServicesPage() {
  const networkStatus = useNetworkStatus();
  const online = networkStatus === "online";

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState<CreateServiceInput>(emptyServiceForm);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CreateServiceCategoryInput>(emptyCategoryForm);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  function reload() {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<ServiceCategory[]>("/service-categories"),
      api.get<Service[]>("/services?includeInactive=true"),
    ])
      .then(([cats, svcs]) => {
        setCategories(cats);
        setServices(svcs);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  function categoryName(id: string | null): string {
    if (!id) return "—";
    return categories.find((c) => c.id === id)?.name ?? "—";
  }

  async function handleCreateService(e: FormEvent) {
    e.preventDefault();
    setServiceError(null);
    setServiceSaving(true);
    try {
      const created = await api.post<Service>("/services", serviceForm);
      setServices((prev) => [...prev, created]);
      setServiceForm(emptyServiceForm);
      setShowServiceForm(false);
    } catch (err) {
      setServiceError(err instanceof ApiError ? err.message : "Saqlab bo'lmadi");
    } finally {
      setServiceSaving(false);
    }
  }

  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault();
    setCategoryError(null);
    setCategorySaving(true);
    try {
      const created = await api.post<ServiceCategory>("/service-categories", categoryForm);
      setCategories((prev) => [...prev, created]);
      setCategoryForm(emptyCategoryForm);
      setShowCategoryForm(false);
    } catch (err) {
      setCategoryError(err instanceof ApiError ? err.message : "Saqlab bo'lmadi");
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleToggleActive(service: Service) {
    try {
      const updated = await api.patch<Service>(`/services/${service.id}`, { isActive: !service.isActive });
      setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "O'zgartirib bo'lmadi");
    }
  }

  async function handleSavePrice(service: Service) {
    setEditBusy(true);
    try {
      const updated = await api.patch<Service>(`/services/${service.id}`, { price: Number(editPrice) });
      setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Narxni o'zgartirib bo'lmadi");
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Xizmat va narxlar</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCategoryForm((v) => !v)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            {showCategoryForm ? "Bekor qilish" : "+ Kategoriya"}
          </button>
          <button
            onClick={() => setShowServiceForm((v) => !v)}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {showServiceForm ? "Bekor qilish" : "+ Yangi xizmat"}
          </button>
        </div>
      </div>

      {showCategoryForm && (
        <form
          onSubmit={(e) => void handleCreateCategory(e)}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">Kategoriya nomi</label>
            <input
              required
              value={categoryForm.name}
              onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-48 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Standart shifokor foizi (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={categoryForm.defaultDoctorPct}
              onChange={(e) => setCategoryForm((f) => ({ ...f, defaultDoctorPct: Number(e.target.value) }))}
              className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={categorySaving || !online}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {categorySaving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
          {categoryError && <p className="text-sm text-red-600">{categoryError}</p>}
        </form>
      )}

      {showServiceForm && (
        <form
          onSubmit={(e) => void handleCreateService(e)}
          className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">Nomi</label>
            <input
              required
              value={serviceForm.name}
              onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Kategoriya (ixtiyoriy)</label>
            <select
              value={serviceForm.categoryId ?? ""}
              onChange={(e) => setServiceForm((f) => ({ ...f, categoryId: e.target.value || undefined }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— yo'q —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Narx (so'm)</label>
            <input
              type="number"
              required
              min={0}
              value={serviceForm.price || ""}
              onChange={(e) => setServiceForm((f) => ({ ...f, price: Number(e.target.value) }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Material narxi (so'm)</label>
            <input
              type="number"
              min={0}
              value={serviceForm.materialCost || ""}
              onChange={(e) => setServiceForm((f) => ({ ...f, materialCost: Number(e.target.value) }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Davomiyligi (daqiqa, ixtiyoriy)</label>
            <input
              type="number"
              min={1}
              value={serviceForm.durationMin ?? ""}
              onChange={(e) => setServiceForm((f) => ({ ...f, durationMin: Number(e.target.value) || undefined }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {serviceError && <p className="text-sm text-red-600 sm:col-span-2">{serviceError}</p>}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={serviceSaving || !online}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {serviceSaving ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading && <p className="p-4 text-sm text-slate-400">Yuklanmoqda…</p>}
        {error && <p className="p-4 text-sm text-red-600">{error}</p>}
        {!loading && !error && services.length === 0 && (
          <p className="p-4 text-sm text-slate-400">Hali xizmat qo'shilmagan.</p>
        )}
        {!loading && !error && services.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {services.map((s) => (
              <li key={s.id} className={`flex items-center justify-between px-4 py-3 text-sm ${!s.isActive ? "opacity-50" : ""}`}>
                <div>
                  <p className="font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    {categoryName(s.categoryId)}
                    {s.durationMin ? ` — ${s.durationMin} daqiqa` : ""}
                    {!s.isActive ? " — faolsizlantirilgan" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {editingId === s.id ? (
                    <>
                      <input
                        type="number"
                        min={0}
                        autoFocus
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() => void handleSavePrice(s)}
                        disabled={editBusy || !online}
                        className="text-xs font-medium text-emerald-700 underline disabled:opacity-50"
                      >
                        saqlash
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-slate-500 underline">
                        bekor
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-slate-900">{som(s.price)}</span>
                      <button
                        onClick={() => {
                          setEditingId(s.id);
                          setEditPrice(s.price);
                        }}
                        className="text-xs text-slate-500 underline"
                      >
                        narxni o'zgartirish
                      </button>
                      <button
                        onClick={() => void handleToggleActive(s)}
                        className={`text-xs underline ${s.isActive ? "text-red-600" : "text-emerald-700"}`}
                      >
                        {s.isActive ? "faolsizlantirish" : "faollashtirish"}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
