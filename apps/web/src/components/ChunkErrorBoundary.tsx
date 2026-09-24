import { Component, type ReactNode } from "react";

/**
 * `React.lazy` bilan yuklanadigan og'ir modul (masalan tish kartasi) yuklanmay
 * qolsa — oq ekran o'rniga tuzatish yo'lini aytuvchi xabar. Eng ko'p sabab:
 * internet uzildi yoki yangi deploy'dan keyin eski chunk fayli serverda yo'q
 * (brauzerda eski ilova qobig'i qolgan) — ikkalasida ham sahifani yangilash
 * yordam beradi.
 */
export class ChunkErrorBoundary extends Component<{ what: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Maxfiylik (CLAUDE.md): xato obyekti bemor ma'lumotini o'z ichiga olmaydi.
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="font-medium">{this.props.what} yuklanmadi — internetni tekshirib, sahifani yangilang.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Sahifani yangilash
        </button>
      </div>
    );
  }
}
