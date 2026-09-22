import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { onNetworkError } from "../lib/networkSignal";

/**
 * TARMOQ HOLATI INDIKATORI — T4 (tahlil M1, birinchi qism).
 *
 * Uch holat (qollanma bo'lim 11 "internet uzilishi — yuqori xavf"):
 *   - "online"      — hammasi joyida.
 *   - "offline"     — `navigator.onLine === false` (qurilma tarmoqdan uzilgan).
 *   - "server-down" — internet bor, lekin `/api/health` javob bermayapti
 *                     (5xx/timeout) yoki fetch tarmoq xatosi bilan tugadi.
 *
 * Manba uchtasi birga: `navigator.onLine` hodisalari, `/api/health` har 30s
 * (faqat tab ko'rinib turganda), va istalgan boshqa so'rovdagi tarmoq xatosi
 * (`lib/networkSignal.ts` orqali `lib/api.ts`dan keladi).
 */
export type NetworkStatus = "online" | "offline" | "server-down";

const NetworkStatusContext = createContext<NetworkStatus>("online");

const HEALTH_CHECK_INTERVAL_MS = 30_000;
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<NetworkStatus>(() => (navigator.onLine ? "online" : "offline"));
  const checkingRef = useRef(false);

  useEffect(() => {
    async function checkServer() {
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      if (checkingRef.current) return; // bir vaqtda faqat bitta tekshiruv
      checkingRef.current = true;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
        try {
          const res = await fetch("/api/health", { signal: controller.signal });
          setStatus(res.ok ? "online" : "server-down");
        } finally {
          clearTimeout(timeout);
        }
      } catch {
        setStatus(navigator.onLine ? "server-down" : "offline");
      } finally {
        checkingRef.current = false;
      }
    }

    function handleOffline() {
      setStatus("offline");
    }
    function handleOnline() {
      void checkServer();
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") void checkServer();
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    const unsubscribeNetworkError = onNetworkError(() => void checkServer());

    void checkServer();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void checkServer();
    }, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubscribeNetworkError();
      clearInterval(interval);
    };
  }, []);

  return <NetworkStatusContext.Provider value={status}>{children}</NetworkStatusContext.Provider>;
}

export function useNetworkStatus(): NetworkStatus {
  return useContext(NetworkStatusContext);
}
