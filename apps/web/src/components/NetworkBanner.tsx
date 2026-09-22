import { useNetworkStatus } from "../state/NetworkContext";

/**
 * T4: "Oflayn: sahifa tepasida doimiy banner ... Saqlash tugmalari
 * o'chiriladi, formadagi ma'lumot o'chmaydi." Formalar o'zlari
 * `useNetworkStatus()` orqali saqlash tugmasini o'chiradi (masalan
 * `routes/PatientsPage.tsx`) — bu komponent faqat xabarni ko'rsatadi.
 */
export function NetworkBanner() {
  const status = useNetworkStatus();

  if (status === "online") return null;

  const message =
    status === "offline"
      ? "Internet yo'q. O'zgarishlar saqlanmaydi — ulanish tiklanishini kuting."
      : "Server javob bermayapti. Birozdan keyin qayta urinib ko'ring.";

  return (
    <div
      role="status"
      className="sticky top-0 z-50 bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white"
    >
      {message}
    </div>
  );
}
