import { useEffect, useState } from "react";
import type { DoctorReportRow } from "@dental/shared";
import { api, ApiError } from "../lib/api";
import { currentMonthInputValue, monthRange } from "../lib/time";

function som(value: number): string {
  return Math.round(value).toLocaleString("uz-UZ") + " so'm";
}

/** Ekran 10 "Shifokor hisobi" — owner. */
export function DoctorReportPage() {
  const [month, setMonth] = useState(currentMonthInputValue());
  const [rows, setRows] = useState<DoctorReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const { from, to } = monthRange(month);
    api
      .get<DoctorReportRow[]>(`/reports/doctors?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Hisobotni yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, [month]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Shifokor hisobi</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {loading && <p className="text-sm text-slate-400">Yuklanmoqda…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Bu oyda shifokor xizmati yozilmagan.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">Shifokor</th>
                  <th className="px-4 py-2 font-medium">Xizmatlar soni</th>
                  <th className="px-4 py-2 font-medium">Tushum</th>
                  <th className="px-4 py-2 font-medium">Ulushi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows
                  .sort((a, b) => b.doctorEarnings - a.doctorEarnings)
                  .map((row) => (
                    <tr key={row.doctorId}>
                      <td className="px-4 py-2 font-medium text-slate-900">{row.doctorName}</td>
                      <td className="px-4 py-2">{row.servicesCount}</td>
                      <td className="px-4 py-2">{som(row.revenue)}</td>
                      <td className="px-4 py-2 font-medium text-emerald-700">{som(row.doctorEarnings)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
