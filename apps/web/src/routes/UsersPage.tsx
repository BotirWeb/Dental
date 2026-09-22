import { useEffect, useState, type FormEvent } from "react";
import type { CreateUserInput, UserDto, UserRole } from "@dental/shared";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import { useNetworkStatus } from "../state/NetworkContext";
import { formatDate } from "../lib/time";

const ROLE_LABELS: Record<string, string> = {
  owner: "Ega",
  admin: "Administrator",
  doctor: "Shifokor",
  cashier: "Kassir",
};

const ROLES: UserRole[] = ["owner", "admin", "doctor", "cashier"];

const emptyForm: CreateUserInput = { login: "", password: "", fullName: "", role: "admin" };

/** Ekran 12 "Foydalanuvchilar" — owner-only. */
export function UsersPage() {
  const { user: me } = useAuth();
  const networkStatus = useNetworkStatus();
  const online = networkStatus === "online";

  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateUserInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createKey, setCreateKey] = useState(() => crypto.randomUUID());

  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    setError(null);
    api
      .get<UserDto[]>("/users")
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Yuklab bo'lmadi"))
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
      const created = await api.postIdempotent<UserDto>("/users", form, createKey);
      setUsers((prev) => [...prev, created]);
      setForm(emptyForm);
      setShowForm(false);
      setCreateKey(crypto.randomUUID());
    } catch (err) {
      if (err instanceof ApiError) {
        // Server javob berdi (masalan parol siyosati rad etdi) — kalit shu
        // tana bilan "band" (T4), tuzatilgan urinish yangi kalit olsin.
        setCreateKey(crypto.randomUUID());
        setFormError(err.message);
      } else {
        setFormError("Saqlab bo'lmadi");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(u: UserDto) {
    setError(null);
    try {
      const updated = await api.patch<UserDto>(`/users/${u.id}`, { isActive: !u.isActive });
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "O'zgartirib bo'lmadi");
    }
  }

  async function handleRoleChange(u: UserDto, role: UserRole) {
    setError(null);
    try {
      const updated = await api.patch<UserDto>(`/users/${u.id}`, { role });
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "O'zgartirib bo'lmadi");
    }
  }

  async function handleResetPassword(userId: string) {
    setResetError(null);
    setResetBusy(true);
    try {
      await api.post(`/users/${userId}/reset-password`, { password: resetPassword });
      setResettingId(null);
      setResetPassword("");
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : "Parolni tiklab bo'lmadi");
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Foydalanuvchilar</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "Bekor qilish" : "+ Yangi foydalanuvchi"}
        </button>
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
            <label className="block text-sm font-medium text-slate-700">Login</label>
            <input
              required
              value={form.login}
              onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Parol</label>
            <input
              type="text"
              required
              placeholder="Kamida 10 belgi"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">
              Kamida 10 belgi, login yoki klinika kodi bilan bir xil bo'lmasin, oddiy parol (12345678 kabi) emas.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Rol</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          {formError && <p className="text-sm text-red-600 sm:col-span-2">{formError}</p>}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving || !online}
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
        {!loading && !error && users.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className={`px-4 py-3 text-sm ${!u.isActive ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">
                      {u.fullName} <span className="text-slate-400">— {u.login}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Ro'yxatga olingan: {formatDate(u.createdAt)}
                      {!u.isActive ? " — faolsizlantirilgan" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={u.role}
                      disabled={u.id === me?.id}
                      onChange={(e) => void handleRoleChange(u, e.target.value as UserRole)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        setResettingId(resettingId === u.id ? null : u.id);
                        setResetPassword("");
                        setResetError(null);
                      }}
                      className="text-xs text-slate-500 underline"
                    >
                      parolni tiklash
                    </button>
                    <button
                      onClick={() => void handleToggleActive(u)}
                      disabled={u.id === me?.id && u.isActive}
                      className={`text-xs underline disabled:opacity-40 ${u.isActive ? "text-red-600" : "text-emerald-700"}`}
                    >
                      {u.isActive ? "faolsizlantirish" : "faollashtirish"}
                    </button>
                  </div>
                </div>

                {resettingId === u.id && (
                  <div className="mt-2 flex items-end gap-2 rounded-md bg-slate-50 p-2">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500">Yangi parol (kamida 10 belgi)</label>
                      <input
                        type="text"
                        autoFocus
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={resetBusy || resetPassword.length < 1 || !online}
                      onClick={() => void handleResetPassword(u.id)}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {resetBusy ? "Saqlanmoqda…" : "Tasdiqlash"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setResettingId(null)}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                    >
                      Yopish
                    </button>
                  </div>
                )}
                {resettingId === u.id && resetError && <p className="mt-1 text-xs text-red-600">{resetError}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
