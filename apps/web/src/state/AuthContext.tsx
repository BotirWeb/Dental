import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { LoginRequest, MeResponse } from "@dental/shared";
import { api, ApiError } from "../lib/api";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: MeResponse | null;
  status: AuthStatus;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Butun ilova shu bilan o'raladi (App.tsx). Sahifa ochilganda /auth/me
 * chaqiriladi — cookie hali ham yaroqli bo'lsa, foydalanuvchi qayta login
 * qilmasdan davom etadi (session TTL — .env SESSION_TTL_HOURS).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    api
      .get<MeResponse>("/auth/me")
      .then((me) => {
        if (!cancelled) {
          setUser(me);
          setStatus("authenticated");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setStatus("anonymous");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(input: LoginRequest) {
    const me = await api.post<MeResponse>("/auth/login", input);
    setUser(me);
    setStatus("authenticated");
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      // Server tomonda sessiya allaqachon yo'q bo'lsa ham, mahalliy holatni
      // tozalaymiz — foydalanuvchi baribir chiqib ketishi kerak.
      if (!(err instanceof ApiError)) throw err;
    }
    setUser(null);
    setStatus("anonymous");
  }

  return <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() faqat <AuthProvider> ichida ishlaydi");
  return ctx;
}
