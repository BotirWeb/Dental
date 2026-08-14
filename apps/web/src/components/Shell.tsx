import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { SCREENS } from "../routes/screens";

const ROLE_LABELS: Record<string, string> = {
  owner: "Ega",
  admin: "Administrator",
  doctor: "Shifokor",
  cashier: "Kassir",
};

/**
 * Rol asosidagi sidebar + header. `<Outlet/>` orqali ichki sahifa
 * almashganda BUTUN SAHIFA emas, faqat shu joy qayta render bo'ladi —
 * bu React Router SPA naqshining o'zi ("refresh bo'lmasdan yangilanish").
 */
export function Shell() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const visibleScreens = SCREENS.filter((s) => s.roles.includes(user.role));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-lg font-semibold text-slate-900">Dental</p>
          <p className="text-xs text-slate-500">klinika boshqaruvi</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm font-medium ${
                isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
              }`
            }
          >
            Bosh sahifa
          </NavLink>

          {visibleScreens.map((screen) => (
            <NavLink
              key={screen.path}
              to={screen.path}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              <span>{screen.label}</span>
              {screen.status === "todo" && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-500">
                  todo
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium text-slate-900">{user.fullName}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[user.role] ?? user.role}</p>
          </div>
          <button
            onClick={() => void logout()}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Chiqish
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
