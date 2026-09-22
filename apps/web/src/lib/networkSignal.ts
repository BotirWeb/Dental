/**
 * `lib/api.ts` React komponenti emas, shuning uchun tarmoq xatosini to'g'ridan
 * to'g'ri Context'ga yoza olmaydi — T4: "Manba: navigator.onLine + /api/health
 * + fetch tarmoq xatosi". Bu kichik pub/sub shu uchinchi manbani
 * `state/NetworkContext.tsx`ga ulaydi (React'dan mustaqil, sinovi oson).
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/** `fetch()`ning o'zi (HTTP status emas, tarmoq darajasida) muvaffaqiyatsiz bo'lganda chaqiriladi. */
export function reportNetworkError(): void {
  listeners.forEach((l) => l());
}

export function onNetworkError(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
