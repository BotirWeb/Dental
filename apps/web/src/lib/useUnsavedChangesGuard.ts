import { useEffect } from "react";

/**
 * Saqlanmagan o'zgarish bor paytda sahifadan chiqishdan oldin so'raydi.
 *
 * React Router'ning `useBlocker`i faqat "data router" (`createBrowserRouter`)
 * bilan ishlaydi, `App.tsx` esa `<BrowserRouter>` — shuning uchun ikki qatlam:
 *  1. `beforeunload` — tab yopish, yangilash, boshqa manzilga o'tish.
 *  2. Ilova ichidagi havola (sidebar va h.k.) bosilishi — `document`ga
 *     CAPTURE bosqichida tinglovchi: React Router `<Link>` `defaultPrevented`
 *     bo'lsa navigatsiya qilmaydi, brauzer ham havolaga o'tmaydi.
 *
 * Qamrab olinmaydi: brauzerning "orqaga" tugmasi (popstate) — uni
 * `BrowserRouter`da to'xtatib bo'lmaydi.
 */
export function useUnsavedChangesGuard(dirty: boolean, message: string) {
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Eski brauzerlar uchun; zamonaviylari o'z standart matnini ko'rsatadi.
      e.returnValue = message;
    };

    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;
      const url = new URL((anchor as HTMLAnchorElement).href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(message)) e.preventDefault();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [dirty, message]);
}
