import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./state/AuthContext";
import { NetworkStatusProvider } from "./state/NetworkContext";
import { RequireAuth } from "./components/RequireAuth";
import { RequireRole } from "./components/RequireRole";
import { Shell } from "./components/Shell";
import { ComingSoonScreen } from "./components/ComingSoonScreen";
import { NetworkBanner } from "./components/NetworkBanner";
import { LoginPage } from "./routes/LoginPage";
import { DashboardPage } from "./routes/DashboardPage";
import { PatientsPage } from "./routes/PatientsPage";
import { PatientDetailPage } from "./routes/PatientDetailPage";
import { SchedulePage } from "./routes/SchedulePage";
import { CashierPage } from "./routes/CashierPage";
import { NotFoundPage } from "./routes/NotFoundPage";
import { SCREENS } from "./routes/screens";

/**
 * Butun navigatsiya shu yerda. React Router = SPA: sahifalar orasida
 * o'tishda brauzer HECH QACHON to'liq refresh qilmaydi, faqat kerakli
 * komponent almashadi (foydalanuvchi so'ragan talab — "refresh bo'lmasdan
 * yangilanish").
 *
 * "todo" ekranlar (status: "todo" — screens.ts) avtomatik ComingSoonScreen
 * bilan render qilinadi, shuning uchun yangi ekran qo'shilganda bu fayl
 * o'zgarmaydi — faqat screens.ts'ga bitta qator qo'shiladi.
 */
export default function App() {
  return (
    <BrowserRouter>
      <NetworkStatusProvider>
        <NetworkBanner />
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RequireAuth />}>
              <Route element={<Shell />}>
                <Route index element={<DashboardPage />} />

                <Route element={<RequireRole roles={["owner", "admin", "doctor"]} />}>
                  <Route path="patients" element={<PatientsPage />} />
                  <Route path="patients/:id" element={<PatientDetailPage />} />
                  <Route path="schedule" element={<SchedulePage />} />
                </Route>

                <Route element={<RequireRole roles={["owner", "admin", "cashier"]} />}>
                  <Route path="cashier" element={<CashierPage />} />
                </Route>

                {SCREENS.filter((s) => s.status === "todo").map((screen) => (
                  <Route key={screen.path} element={<RequireRole roles={screen.roles} />}>
                    <Route
                      path={screen.path.replace(/^\//, "")}
                      element={
                        <ComingSoonScreen title={screen.label} screenNumber={screen.screenNumber} note={screen.note} />
                      }
                    />
                  </Route>
                ))}
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </NetworkStatusProvider>
    </BrowserRouter>
  );
}
