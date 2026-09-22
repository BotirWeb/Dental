import { useEffect, useState } from "react";
import type { MarginReport } from "@dental/shared";
import { api, ApiError } from "../lib/api";
import { currentMonthInputValue, monthRange } from "../lib/time";

function som(value: number): string {
  return Math.round(value).toLocaleString("uz-UZ") + " so'm";
}

/**
 * Ekran 9 "Oylik marja" — bo'lim 1: "Marja hisobi — xizmat bo'yicha...
 * Hech kim qilmaydi" — loyihaning asosiy farqlanish nuqtasi.
 */
export function MarginReportPage() {
  const [month, setMonth] = useState(currentMonthInputValue());
  const [report, setReport] = useState<MarginReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const { from, to } = monthRange(month);
    api
      .get<MarginReport>(`/reports/margin?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(setReport)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Hisobotni yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, [month]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Oylik marja</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {loading && <p className="text-sm text-slate-400">Yuklanmoqda…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {report && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Tushum</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{som(report.revenue)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Shifokor ulushi</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{som(report.doctorEarnings)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Material + lab xarajati</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{som(report.materialCost + report.labCost)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Klinika marjasi</p>
              <p className="mt-1 text-lg font-semibold text-emerald-700">{som(report.margin)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Xarajatlar (ekran 7)</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{som(report.expenses)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Sof foyda (marja − xarajat)</p>
              <p className={`mt-1 text-lg font-semibold ${report.netProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {som(report.netProfit)}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 p-4 text-sm font-medium text-slate-700">Kategoriya bo'yicha</h2>
            {report.byCategory.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">Bu oyda xizmat bajarilmagan.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="px-4 py-2 font-medium">Kategoriya</th>
                    <th className="px-4 py-2 font-medium">Tushum</th>
                    <th className="px-4 py-2 font-medium">Shifokor ulushi</th>
                    <th className="px-4 py-2 font-medium">Marja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.byCategory
                    .sort((a, b) => b.margin - a.margin)
                    .map((row) => (
                      <tr key={row.categoryId ?? "none"}>
                        <td className="px-4 py-2">{row.categoryName}</td>
                        <td className="px-4 py-2">{som(row.revenue)}</td>
                        <td className="px-4 py-2">{som(row.doctorEarnings)}</td>
                        <td className="px-4 py-2 font-medium text-emerald-700">{som(row.margin)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
