import { Outlet } from "react-router-dom";
import type { UserRole } from "@dental/shared";
import { useAuth } from "../state/AuthContext";

/**
 * Ekran darajasidagi rol tekshiruvi (bo'lim 6 "Rollar" jadvali).
 * RequireAuth'dan KEYIN ishlatiladi — user allaqachon mavjud deb faraz
 * qilinadi.
 */
export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { user } = useAuth();

  if (!user) return null;

  if (!roles.includes(user.role)) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="font-medium">Bu ekran uchun ruxsatingiz yo'q.</p>
        <p className="mt-1 text-sm text-amber-700">
          Rolingiz: <span className="font-mono">{user.role}</span>
        </p>
      </div>
    );
  }

  return <Outlet />;
}
