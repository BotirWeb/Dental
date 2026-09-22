import { useState, type FormEvent } from "react";
import { Navigate, useLocation, type Location } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { ApiError } from "../lib/api";

/**
 * Shu qurilmada oxirgi ishlatilgan klinika kodi — T2 (tahlil C4): "kirishdan
 * keyin shu qurilmada eslab qolinadi, keyingi safar oldindan to'ldiriladi."
 * Faqat qulaylik uchun (localStorage) — xavfsizlik chegarasi emas.
 */
const CLINIC_STORAGE_KEY = "dental.lastClinicSlug";

function rememberedClinicSlug(): string {
  try {
    return localStorage.getItem(CLINIC_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberClinicSlug(slug: string): void {
  try {
    localStorage.setItem(CLINIC_STORAGE_KEY, slug);
  } catch {
    // localStorage yo'q/bloklangan bo'lsa — jim o'tkazib yuboriladi, faqat qulaylik yo'qoladi.
  }
}

/** Ekran 1 (bo'lim 6): "klinika kodi + login + parol". Rol tanlanmaydi. */
export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const remembered = rememberedClinicSlug();
  const [clinic, setClinic] = useState(remembered);
  const [editingClinic, setEditingClinic] = useState(remembered === "");
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") {
    const from = (location.state as { from?: Location })?.from;
    return <Navigate to={from?.pathname ?? "/"} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ clinic: clinic.trim() || undefined, login: loginValue, password });
      if (clinic.trim()) rememberClinicSlug(clinic.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kutilmagan xato yuz berdi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Dental</h1>
        <p className="mt-1 text-sm text-slate-500">Klinika boshqaruv tizimiga kirish</p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="clinic" className="block text-sm font-medium text-slate-700">
                Klinika kodi
              </label>
              {!editingClinic && (
                <button
                  type="button"
                  onClick={() => setEditingClinic(true)}
                  className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
                >
                  o'zgartirish
                </button>
              )}
            </div>
            {editingClinic ? (
              <input
                id="clinic"
                type="text"
                autoComplete="off"
                placeholder="masalan: namuna-klinika"
                required
                value={clinic}
                onChange={(e) => setClinic(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            ) : (
              <p className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {clinic}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="login" className="block text-sm font-medium text-slate-700">
              Login
            </label>
            <input
              id="login"
              type="text"
              autoComplete="username"
              required
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Parol
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Tekshirilmoqda…" : "Kirish"}
          </button>
        </form>
      </div>
    </div>
  );
}
