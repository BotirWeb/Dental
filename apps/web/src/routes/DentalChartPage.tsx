import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  DENTAL_CHART_EDIT_ROLES,
  type DentalChart,
  type DentalChartResponse,
  type Patient,
  type SavedDentalChart,
} from "@dental/shared";
import { api, ApiError } from "../lib/api";
import { formatDateTime } from "../lib/time";
import { useUnsavedChangesGuard } from "../lib/useUnsavedChangesGuard";
import { useAuth } from "../state/AuthContext";
import { useNetworkStatus } from "../state/NetworkContext";
import { ChunkErrorBoundary } from "../components/ChunkErrorBoundary";
import type { DentalChartEditorHandle } from "../components/odontogram/DentalChartEditor";

// Kutubxona ~3 MB — faqat shu sahifa ochilganda yuklanadi (alohida chunk).
const DentalChartEditor = lazy(() => import("../components/odontogram/DentalChartEditor"));

const LEAVE_MESSAGE = "Tish kartasida saqlanmagan o'zgarishlar bor. Sahifadan chiqsangiz, ular yo'qoladi. Chiqasizmi?";

interface LastSaved {
  at: string;
  by: string;
}

/**
 * T5 "Tish kartasi" — `/patients/:id/chart` (ekran 4 "Bemor kartasi"dan
 * o'tiladi). `docs/tasks/2026-09-24-odontogram.md`.
 *
 * `key={id}` — MUHIM: kutubxona engine'i sahifada yagona nusxa. Bemor A
 * kartasidan to'g'ridan-to'g'ri bemor B kartasiga o'tilsa (URL o'zgaradi,
 * route o'sha), React komponentni qayta ishlatib, A ning tishlari B da
 * qolib ketardi. `key` bilan har bemor uchun to'liq unmount/mount bo'ladi.
 */
export function DentalChartPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [reloadCount, setReloadCount] = useState(0);

  if (!id || !user) return null;

  if (!user.features.odontogram) {
    return (
      <div className="space-y-4">
        <Link to={`/patients/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← Bemor kartasiga
        </Link>
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Tish kartasi moduli bu klinikada yoqilmagan. Yoqish uchun klinika egasi tizim administratoriga murojaat qilsin.
        </div>
      </div>
    );
  }

  return (
    <DentalChartScreen
      key={`${id}:${reloadCount}`}
      patientId={id}
      canEdit={DENTAL_CHART_EDIT_ROLES.includes(user.role)}
      onReload={() => setReloadCount((n) => n + 1)}
    />
  );
}

function DentalChartScreen({ patientId, canEdit, onReload }: { patientId: string; canEdit: boolean; onReload(): void }) {
  const networkStatus = useNetworkStatus();
  const editorRef = useRef<DentalChartEditorHandle>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [chart, setChart] = useState<DentalChart | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [baseChartId, setBaseChartId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<LastSaved | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [saveKey, setSaveKey] = useState(() => crypto.randomUUID());

  useUnsavedChangesGuard(dirty, LEAVE_MESSAGE);

  useEffect(() => {
    // Sahifa tark etilgandan keyin kelgan javob boshqa bemor holatiga
    // yozilmasin (komponent `key` bilan almashadi, eski effekt bekor bo'ladi).
    let cancelled = false;
    Promise.all([
      api.get<Patient>(`/patients/${patientId}`),
      api.get<DentalChartResponse>(`/patients/${patientId}/dental-chart`),
    ])
      .then(([p, res]) => {
        if (cancelled) return;
        setPatient(p);
        setChart(res.chart);
        setBaseChartId(res.chart?.id ?? null);
        setLastSaved(res.chart ? { at: res.chart.createdAt, by: res.chart.createdByName } : null);
        setLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : "Tish kartasini yuklab bo'lmadi — internetni tekshirib, sahifani yangilang");
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [justSaved]);

  async function handleSave() {
    const editor = editorRef.current;
    if (!editor) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await api.postIdempotent<SavedDentalChart>(
        `/patients/${patientId}/dental-chart`,
        { payload: editor.getPayload(), baseChartId },
        saveKey,
      );
      setBaseChartId(saved.id);
      setLastSaved({ at: saved.createdAt, by: saved.createdByName });
      editor.markSaved();
      setJustSaved(true);
      setSaveKey(crypto.randomUUID());
    } catch (err) {
      if (err instanceof ApiError) {
        // Server javob berdi — keyingi urinish yangi so'rov (PatientsPage naqshi).
        setSaveKey(crypto.randomUUID());
        if (err.status === 409) setConflict(err.message);
        else setSaveError(err.message);
      } else {
        // Javob kelmadi: server yozib ulgurgan bo'lishi mumkin — kalit
        // SAQLANADI, qayta bosilganda server takror yozmaydi (T4).
        setSaveError("Internet yo'q yoki server javob bermadi — karta saqlanmadi. Ulanish tiklangach «Saqlash»ni qayta bosing");
      }
    } finally {
      setSaving(false);
    }
  }

  const online = networkStatus === "online";

  return (
    <div className="space-y-4">
      {!loaded && (
        <Link to={`/patients/${patientId}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← Bemor kartasiga
        </Link>
      )}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {!loaded && !loadError && <p className="text-sm text-slate-400">Yuklanmoqda…</p>}

      {loaded && patient && (
        <>
          {/* Sticky: uzun kartani pastga aylantirganda ham «Saqlash» ko'rinib tursin. */}
          <div className="sticky top-0 z-20 -mx-6 border-b border-slate-200 bg-slate-50/95 px-6 py-3 backdrop-blur">
            <Link to={`/patients/${patientId}`} className="text-sm text-slate-500 hover:text-slate-700">
              ← Bemor kartasiga
            </Link>
            <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-slate-900">Tish kartasi — {patient.fullName}</h1>
                <p className="text-sm text-slate-500">
                  {lastSaved
                    ? `Oxirgi saqlangan: ${formatDateTime(lastSaved.at)} · ${lastSaved.by}`
                    : canEdit
                      ? "Bu bemorda hali tish kartasi yo'q. Tishni bosing, o'ngdagi paneldan holatini belgilang va «Saqlash»ni bosing."
                      : "Bu bemorda hali tish kartasi yo'q — uni shifokor to'ldiradi."}
                </p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-3">
                  {dirty && <span className="text-sm font-medium text-amber-700">Saqlanmagan o'zgarishlar bor</span>}
                  {justSaved && !dirty && <span className="text-sm font-medium text-emerald-700">Saqlandi</span>}
                  <button
                    onClick={() => void handleSave()}
                    disabled={!dirty || saving || !online || conflict !== null}
                    title={!online ? "Internet yo'q — ulanish tiklangach saqlang" : undefined}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? "Saqlanmoqda…" : "Saqlash"}
                  </button>
                </div>
              )}
            </div>

            {!canEdit && (
              <p className="mt-2 text-sm text-slate-500">
                Siz kartani faqat ko'rasiz — o'zgartirish shifokor yoki klinika egasi uchun.
              </p>
            )}
            {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
            {conflict && (
              <div className="mt-2 flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <span>{conflict}. Yangilasangiz, shu sahifadagi saqlanmagan o'zgarishlar yo'qoladi.</span>
                <button
                  onClick={onReload}
                  className="rounded-md border border-red-300 bg-white px-3 py-1 font-medium text-red-800 hover:bg-red-100"
                >
                  Kartani yangilash
                </button>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">
              Karta ichidagi yozuvlar hozircha rus tilida — o'zbekcha tarjima tayyorlanmoqda. Tishlar FDI tizimida
              raqamlangan (11–48).
            </p>
          </div>

          <ChunkErrorBoundary what="Tish kartasi">
            <Suspense fallback={<p className="text-sm text-slate-400">Tish kartasi yuklanmoqda…</p>}>
              <DentalChartEditor
                ref={editorRef}
                initialPayload={chart?.payload ?? null}
                readOnly={!canEdit}
                onDirtyChange={setDirty}
              />
            </Suspense>
          </ChunkErrorBoundary>
        </>
      )}
    </div>
  );
}
