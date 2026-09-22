import { useEffect, useState, type FormEvent } from "react";
import type {
  CashSession,
  Doctor,
  Patient,
  PatientBalanceDto,
  Payment,
  PerformedService,
  Service,
  Visit,
} from "@dental/shared";
import { api, ApiError } from "../lib/api";
import { useNetworkStatus } from "../state/NetworkContext";
import { formatDateTime } from "../lib/time";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Naqd",
  card: "Karta",
  payme: "Payme",
  click: "Click",
  transfer: "O'tkazma",
};

function som(value: string | number): string {
  return Math.round(Number(value)).toLocaleString("uz-UZ") + " so'm";
}

/**
 * Ekran 6 "Kassa / vizit yakuni" — MVPning eng muhim ekrani (qollanma
 * bo'lim 7). Uch bosqich: (1) kassa smenasi, (2) bemor tanlab vizit
 * boshlash, (3) vizitda xizmat qo'shish + to'lov qabul qilish.
 *
 * Hisob-kitobning o'zi bu yerda YO'Q — hammasi backend'dagi sof
 * funksiyalarga tayanadi (`src/domain/{discount,doctorEarnings,
 * patientBalance,cashSession,payments}.ts`), bu yerda faqat ko'rsatiladi.
 */
export function CashierPage() {
  const networkStatus = useNetworkStatus();
  const online = networkStatus === "online";

  const [session, setSession] = useState<CashSession | null | undefined>(undefined);
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingForm, setClosingForm] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [visitDoctorId, setVisitDoctorId] = useState("");
  const [visitKey, setVisitKey] = useState(() => crypto.randomUUID());
  const [visit, setVisit] = useState<Visit | null>(null);
  const [visitBusy, setVisitBusy] = useState(false);
  const [visitError, setVisitError] = useState<string | null>(null);

  const [performed, setPerformed] = useState<PerformedService[]>([]);
  const [visitPayments, setVisitPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState<PatientBalanceDto | null>(null);

  const [svcServiceId, setSvcServiceId] = useState("");
  const [svcTooth, setSvcTooth] = useState("");
  const [svcDiscountType, setSvcDiscountType] = useState<"amount" | "percent">("amount");
  const [svcDiscountValue, setSvcDiscountValue] = useState("0");
  const [svcWarranty, setSvcWarranty] = useState(false);
  const [svcKey, setSvcKey] = useState(() => crypto.randomUUID());
  const [svcBusy, setSvcBusy] = useState(false);
  const [svcError, setSvcError] = useState<string | null>(null);

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "payme" | "click" | "transfer">("cash");
  const [payKey, setPayKey] = useState(() => crypto.randomUUID());
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidBusy, setVoidBusy] = useState(false);

  function loadSession() {
    api
      .get<CashSession | null>("/cash-sessions/current")
      .then(setSession)
      .catch(() => setSession(null));
  }

  useEffect(() => {
    loadSession();
    api.get<Doctor[]>("/doctors").then(setDoctors).catch(() => setDoctors([]));
    api.get<Service[]>("/services").then(setServices).catch(() => setServices([]));
  }, []);

  useEffect(() => {
    if (!patientQuery.trim()) {
      setPatientResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      api
        .get<Patient[]>(`/patients?q=${encodeURIComponent(patientQuery.trim())}`)
        .then(setPatientResults)
        .catch(() => setPatientResults([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [patientQuery]);

  async function refreshVisit(visitId: string, patientId: string) {
    const [v, bal] = await Promise.all([
      api.get<Visit & { performedServices: PerformedService[]; payments: Payment[] }>(`/visits/${visitId}`),
      api.get<PatientBalanceDto>(`/patients/${patientId}/balance`),
    ]);
    setVisit(v);
    setPerformed(v.performedServices);
    setVisitPayments(v.payments);
    setBalance(bal);
  }

  async function handleOpenSession(e: FormEvent) {
    e.preventDefault();
    setSessionError(null);
    setSessionBusy(true);
    try {
      const created = await api.post<CashSession>("/cash-sessions", { openingFloat: Number(openingFloat) || 0 });
      setSession(created);
    } catch (err) {
      setSessionError(err instanceof ApiError ? err.message : "Smenani ochib bo'lmadi");
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleCloseSession(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSessionError(null);
    setSessionBusy(true);
    try {
      const closed = await api.patch<CashSession>(`/cash-sessions/${session.id}/close`, {
        countedCash: Number(countedCash) || 0,
        note: closeNote.trim() || undefined,
      });
      setSession(closed);
      setClosingForm(false);
    } catch (err) {
      setSessionError(err instanceof ApiError ? err.message : "Smenani yopib bo'lmadi");
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleStartVisit(e: FormEvent) {
    e.preventDefault();
    if (!selectedPatient || !visitDoctorId) return;
    setVisitError(null);
    setVisitBusy(true);
    try {
      const created = await api.postIdempotent<Visit>(
        "/visits",
        { patientId: selectedPatient.id, doctorId: visitDoctorId },
        visitKey,
      );
      await refreshVisit(created.id, selectedPatient.id);
    } catch (err) {
      setVisitError(err instanceof ApiError ? err.message : "Vizitni boshlab bo'lmadi");
    } finally {
      setVisitBusy(false);
    }
  }

  function resetVisit() {
    setSelectedPatient(null);
    setPatientQuery("");
    setVisit(null);
    setPerformed([]);
    setVisitPayments([]);
    setBalance(null);
    setVisitDoctorId("");
    setVisitKey(crypto.randomUUID());
  }

  async function handleAddService(e: FormEvent) {
    e.preventDefault();
    if (!visit || !selectedPatient || !svcServiceId) return;
    setSvcError(null);
    setSvcBusy(true);
    try {
      await api.postIdempotent(
        `/visits/${visit.id}/performed-services`,
        {
          serviceId: svcServiceId,
          tooth: svcTooth ? Number(svcTooth) : undefined,
          discountType: svcDiscountType,
          discountValue: Number(svcDiscountValue) || 0,
          isWarranty: svcWarranty,
        },
        svcKey,
      );
      setSvcServiceId("");
      setSvcTooth("");
      setSvcDiscountType("amount");
      setSvcDiscountValue("0");
      setSvcWarranty(false);
      setSvcKey(crypto.randomUUID());
      await refreshVisit(visit.id, selectedPatient.id);
    } catch (err) {
      setSvcError(err instanceof ApiError ? err.message : "Xizmatni qo'shib bo'lmadi");
    } finally {
      setSvcBusy(false);
    }
  }

  async function handleRecordPayment(e: FormEvent) {
    e.preventDefault();
    if (!visit || !selectedPatient || !payAmount) return;
    setPayError(null);
    setPayBusy(true);
    try {
      await api.postIdempotent(
        "/payments",
        { patientId: selectedPatient.id, visitId: visit.id, amount: Number(payAmount), method: payMethod },
        payKey,
      );
      setPayAmount("");
      setPayKey(crypto.randomUUID());
      await refreshVisit(visit.id, selectedPatient.id);
      loadSession();
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : "To'lovni saqlab bo'lmadi");
    } finally {
      setPayBusy(false);
    }
  }

  async function handleFinishVisit() {
    if (!visit) return;
    try {
      await api.patch<Visit>(`/visits/${visit.id}`, {});
      resetVisit();
    } catch (err) {
      setVisitError(err instanceof ApiError ? err.message : "Vizitni yakunlab bo'lmadi");
    }
  }

  /** Noto'g'ri to'lovni tuzatish — tahlil A3 (`POST /payments/:id/void`, `buildReversal`). */
  async function handleVoidPayment(paymentId: string) {
    if (!visit || !selectedPatient || voidReason.trim().length < 3) return;
    setPayError(null);
    setVoidBusy(true);
    try {
      await api.post(`/payments/${paymentId}/void`, { reason: voidReason.trim() });
      setVoidingId(null);
      setVoidReason("");
      await refreshVisit(visit.id, selectedPatient.id);
      loadSession();
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : "To'lovni bekor qilib bo'lmadi");
    } finally {
      setVoidBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Kassa / vizit yakuni</h1>

      {/* 1-bosqich: kassa smenasi */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-slate-700">Kassa smenasi</h2>
        {session === undefined && <p className="mt-2 text-sm text-slate-400">Yuklanmoqda…</p>}

        {session === null && (
          <form onSubmit={(e) => void handleOpenSession(e)} className="mt-2 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-500">Boshlang'ich qoldiq (so'm)</label>
              <input
                type="number"
                min={0}
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                className="mt-1 w-40 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={sessionBusy || !online}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {sessionBusy ? "Ochilmoqda…" : "Smenani ochish"}
            </button>
          </form>
        )}

        {session && !session.closedAt && (
          <div className="mt-2">
            <p className="text-sm text-slate-600">
              Ochiq — {formatDateTime(session.openedAt)}, boshlang'ich qoldiq {som(session.openingFloat)}
            </p>
            {!closingForm ? (
              <button
                onClick={() => setClosingForm(true)}
                className="mt-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Smenani yopish
              </button>
            ) : (
              <form onSubmit={(e) => void handleCloseSession(e)} className="mt-2 flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-slate-500">Qo'lda sanalgan naqd (so'm)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    className="mt-1 w-40 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Izoh (ixtiyoriy)</label>
                  <input
                    type="text"
                    value={closeNote}
                    onChange={(e) => setCloseNote(e.target.value)}
                    className="mt-1 w-48 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sessionBusy || !online}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {sessionBusy ? "Yopilmoqda…" : "Tasdiqlash"}
                </button>
              </form>
            )}
          </div>
        )}

        {session && session.closedAt && (
          <p className="mt-2 text-sm text-slate-500">
            Yopilgan — {formatDateTime(session.closedAt)}. Kutilgan {som(session.expectedCash ?? "0")}, sanalgan{" "}
            {som(session.countedCash ?? "0")}, farq{" "}
            <span className={Number(session.diff) === 0 ? "text-slate-700" : "text-red-600 font-medium"}>
              {som(session.diff ?? "0")}
            </span>
            . Yangi smena ochish uchun sahifani yangilang.
          </p>
        )}

        {sessionError && <p className="mt-2 text-sm text-red-600">{sessionError}</p>}
      </div>

      {/* 2-bosqich: bemor tanlash / vizit boshlash */}
      {!visit && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-medium text-slate-700">Vizit boshlash</h2>
          {!selectedPatient ? (
            <div className="relative mt-2 max-w-sm">
              <input
                type="text"
                placeholder="Bemorni qidiring: ism yoki telefon…"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              {patientResults.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                  {patientResults.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatientResults([]);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        {p.fullName} — {p.phone}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <form onSubmit={(e) => void handleStartVisit(e)} className="mt-2 flex flex-wrap items-end gap-3">
              <div className="text-sm">
                <span className="text-slate-500">Bemor: </span>
                <span className="font-medium text-slate-800">{selectedPatient.fullName}</span>{" "}
                <button type="button" onClick={resetVisit} className="text-xs text-slate-500 underline">
                  o'zgartirish
                </button>
              </div>
              <div>
                <label className="block text-xs text-slate-500">Shifokor</label>
                <select
                  required
                  value={visitDoctorId}
                  onChange={(e) => setVisitDoctorId(e.target.value)}
                  className="mt-1 w-48 rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— tanlang —</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={visitBusy || !online}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {visitBusy ? "Boshlanmoqda…" : "Vizitni boshlash"}
              </button>
            </form>
          )}
          {visitError && <p className="mt-2 text-sm text-red-600">{visitError}</p>}
        </div>
      )}

      {/* 3-bosqich: faol vizit */}
      {visit && selectedPatient && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-medium text-slate-800">{selectedPatient.fullName}</p>
              <p className="text-xs text-slate-500">Vizit boshlandi: {formatDateTime(visit.startedAt)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={resetVisit} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                Boshqa bemor
              </button>
              <button
                onClick={() => void handleFinishVisit()}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Vizitni yakunlash
              </button>
            </div>
          </div>

          {balance && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <span className="text-slate-500">Hisoblandi: </span>
              <span className="font-medium">{som(balance.charged)}</span>
              <span className="mx-2 text-slate-300">|</span>
              <span className="text-slate-500">To'landi: </span>
              <span className="font-medium">{som(balance.paid)}</span>
              <span className="mx-2 text-slate-300">|</span>
              {balance.debt > 0 ? (
                <span className="font-medium text-red-600">Qarz: {som(balance.debt)}</span>
              ) : balance.advance > 0 ? (
                <span className="font-medium text-emerald-600">Avans: {som(balance.advance)}</span>
              ) : (
                <span className="font-medium text-slate-600">Hisob yopiq</span>
              )}
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-medium text-slate-700">Bajarilgan xizmatlar</h2>
            {performed.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Hali xizmat qo'shilmagan.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100">
                {performed.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {p.serviceName}
                      {p.tooth ? ` — tish ${p.tooth}` : ""}
                      {p.isWarranty ? " (kafolat)" : ""}
                    </span>
                    <span className="font-medium">
                      {som(Number(p.priceSnapshot) * p.qty - Number(p.discountAmount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={(e) => void handleAddService(e)} className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
              <div>
                <label className="block text-xs text-slate-500">Xizmat</label>
                <select
                  required
                  value={svcServiceId}
                  onChange={(e) => setSvcServiceId(e.target.value)}
                  className="mt-1 w-56 rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— tanlang —</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {som(s.price)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500">Tish (ixtiyoriy)</label>
                <input
                  type="number"
                  value={svcTooth}
                  onChange={(e) => setSvcTooth(e.target.value)}
                  className="mt-1 w-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500">Chegirma</label>
                <div className="mt-1 flex gap-1">
                  <select
                    value={svcDiscountType}
                    onChange={(e) => setSvcDiscountType(e.target.value as "amount" | "percent")}
                    className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="amount">so'm</option>
                    <option value="percent">%</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={svcDiscountValue}
                    onChange={(e) => setSvcDiscountValue(e.target.value)}
                    className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-1.5 pb-2 text-sm text-slate-600">
                <input type="checkbox" checked={svcWarranty} onChange={(e) => setSvcWarranty(e.target.checked)} />
                Kafolat
              </label>
              <button
                type="submit"
                disabled={svcBusy || !online}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {svcBusy ? "Qo'shilmoqda…" : "Qo'shish"}
              </button>
            </form>
            {svcError && <p className="mt-2 text-sm text-red-600">{svcError}</p>}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-medium text-slate-700">To'lovlar</h2>
            {visitPayments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Hali to'lov yo'q.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100">
                {visitPayments.map((p) => {
                  const canVoid = !p.voidedAt && !p.reversalOfId;
                  return (
                    <li key={p.id} className="py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className={p.voidedAt ? "text-slate-400 line-through" : ""}>
                          {PAYMENT_METHOD_LABELS[p.method] ?? p.method} — {formatDateTime(p.paidAt)}
                          {p.reversalOfId ? " (tuzatuvchi yozuv)" : ""}
                          {p.voidedAt ? " — bekor qilingan" : ""}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${Number(p.amount) < 0 ? "text-red-600" : ""}`}>{som(p.amount)}</span>
                          {canVoid && voidingId !== p.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidingId(p.id);
                                setVoidReason("");
                              }}
                              className="text-xs text-red-600 underline"
                            >
                              bekor qilish
                            </button>
                          )}
                        </div>
                      </div>
                      {voidingId === p.id && (
                        <div className="mt-2 flex items-end gap-2 rounded-md bg-red-50 p-2">
                          <div className="flex-1">
                            <label className="block text-xs text-slate-500">Bekor qilish sababi (kamida 3 belgi)</label>
                            <input
                              type="text"
                              autoFocus
                              value={voidReason}
                              onChange={(e) => setVoidReason(e.target.value)}
                              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={voidBusy || voidReason.trim().length < 3 || !online}
                            onClick={() => void handleVoidPayment(p.id)}
                            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {voidBusy ? "Bekor qilinmoqda…" : "Tasdiqlash"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setVoidingId(null)}
                            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                          >
                            Yopish
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <form onSubmit={(e) => void handleRecordPayment(e)} className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
              <div>
                <label className="block text-xs text-slate-500">Summa (so'm)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500">Usul</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                  className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={payBusy || !online}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {payBusy ? "Saqlanmoqda…" : "To'lovni qabul qilish"}
              </button>
            </form>
            {payError && <p className="mt-2 text-sm text-red-600">{payError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
