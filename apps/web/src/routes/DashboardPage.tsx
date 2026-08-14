import { useAuth } from "../state/AuthContext";
import { SCREENS } from "./screens";

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  const visible = SCREENS.filter((s) => s.roles.includes(user.role));
  const ready = visible.filter((s) => s.status === "ready");
  const todo = visible.filter((s) => s.status === "todo");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Xush kelibsiz, {user.fullName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Bu — Faza 1 skeleton (qollanma bo'lim 7, hafta 1-2). Chap tomondagi menyu rolingizga
          ({user.role}) qarab ko'rsatiladi.
        </p>
      </div>

      {ready.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700">Tayyor</h2>
          <ul className="mt-2 space-y-1">
            {ready.map((s) => (
              <li key={s.path} className="text-sm text-slate-600">
                <span className="font-medium text-slate-900">{s.label}</span> — {s.note}
              </li>
            ))}
          </ul>
        </section>
      )}

      {todo.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700">Navbatda</h2>
          <ul className="mt-2 space-y-1">
            {todo.map((s) => (
              <li key={s.path} className="text-sm text-slate-500">
                <span className="font-medium text-slate-700">{s.label}</span>
                {s.note ? ` — ${s.note}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
