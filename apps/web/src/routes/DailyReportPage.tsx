import { useEffect, useState } from "react";
import type { DailyReport } from "@dental/shared";
import { api, ApiError } from "../lib/api";
import { formatDateTime } from "../lib/time";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Naqd",
  card: "Karta",
  payme: "Payme",
  click: "Click",
  transfer: "O'tkazma",
};

function som(value: number): string {
  return Math.round(value).toLocaleString("uz-UZ") + " so'm";
}

function todayInputValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Ekran 8 "Kunlik hisobot" — owner. */
export function DailyReportPage() {
  const [date, setDate] = useState(todayInputValue());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get<DailyReport>(`/reports/daily?date=${date}`)
      .then(setReport)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Hisobotni yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Kunlik hisobot</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {loading && <p className="text-sm text-slate-400">Yuklanmoqda…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {report && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Tushum</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{som(report.revenue)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Shifokor ulushi</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{som(report.doctorEarnings)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Material xarajati</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{som(report.materialCost)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Marja</p>
              <p className="mt-1 text-lg font-semibold text-emerald-700">{som(report.margin)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-medium text-slate-700">To'lovlar — jami {som(report.totalPayments)}</h2>
            {Object.keys(report.paymentsByMethod).length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Bu kun to'lov bo'lmagan.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {Object.entries(report.paymentsByMethod).map(([method, amount]) => (
                  <li key={method} className="flex justify-between">
                    <span className="text-slate-600">{PAYMENT_METHOD_LABELS[method] ?? method}</span>
                    <span className="font-medium text-slate-900">{som(amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Xarajatlar</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{som(report.expenses)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Vizitlar soni</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{report.visitsCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Kassa smenasi</p>
              {report.cashSession ? (
                <div className="mt-1 text-sm">
                  <p>Ochilgan: {formatDateTime(report.cashSession.openedAt)}</p>
                  {report.cashSession.closedAt ? (
                    <p className={Number(report.cashSession.diff) === 0 ? "text-slate-700" : "text-red-600 font-medium"}>
                      Farq: {som(Number(report.cashSession.diff ?? 0))}
                    </p>
                  ) : (
                    <p className="text-amber-600">Hali ochiq</p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-400">Bu kun smena ochilmagan</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
