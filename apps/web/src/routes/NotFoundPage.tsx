import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-slate-500">
      <p className="text-2xl font-semibold text-slate-800">404</p>
      <p>Bu sahifa topilmadi.</p>
      <Link to="/" className="text-sm text-slate-600 underline">
        Bosh sahifaga qaytish
      </Link>
    </div>
  );
}
