import { useEffect, useImperativeHandle, useInsertionEffect, useRef, type Ref } from "react";
import {
  OdontogramChartSurface,
  OdontogramProvider,
  ToothControlsSurface,
  ToothInfoSurface,
  getStatusChart,
  importStatus,
  onStateChange,
  useOdontogramUi,
} from "react-advanced-odontogram";
import rawOdontogramCss from "react-advanced-odontogram/style.css?inline";
import type { DentalChartPayload } from "@dental/shared";
import { scopeOdontogramCss } from "./scopeOdontogramCss";

/**
 * T5 "Tish kartasi" — `react-advanced-odontogram` (vendor/, MIT) o'rami.
 *
 * Bu modul `React.lazy` bilan ALOHIDA chunk bo'lib yuklanadi (kutubxona
 * ~3 MB) — boshqa ekranlar uni hech qachon yuklamaydi (`DentalChartPage.tsx`).
 *
 * Kutubxonaning tayyor `OdontogramShell`i ishlatilmaydi — uning yuqori
 * paneli (til tanlash, GitHub havolasi, PNG/PDF/JSON/FHIR eksport-import,
 * sozlamalar) bizga kerak emas: eksport bemor ma'lumotini kompyuterda fayl
 * qilib qoldiradi, saqlash esa bizning serverga. O'rniga kutubxona
 * rasman qo'llab-quvvatlaydigan "composable" qismlar yig'iladi.
 *
 * MUHIM (kutubxona cheklovlari):
 *  - Engine holati modul darajasidagi YAGONA nusxa ("one instance per page").
 *    Bir sahifada ikkita karta chizilmaydi; bemor almashganda komponent
 *    `key` bilan to'liq qayta yaratiladi (unmount -> `destroyOdontogram`
 *    butun holatni tozalaydi).
 *  - Engine DOM'ni `#toothGrid`, `.panel` kabi global selektorlar bilan
 *    qidiradi — ilovaning boshqa joyida `.panel` klassi ishlatilmasin.
 */

export interface DentalChartEditorHandle {
  /** Joriy karta — serverga yuboriladigan shakl (`getStatusChart()`). */
  getPayload(): DentalChartPayload;
  /** Saqlangandan keyin: joriy holat yangi "saqlangan" nuqta, dirty = false. */
  markSaved(): void;
}

interface Props {
  ref?: Ref<DentalChartEditorHandle>;
  /** Serverdagi oxirgi versiya; bemorda karta hali bo'lmasa `null` (bo'sh karta). */
  initialPayload: DentalChartPayload | null;
  readOnly: boolean;
  onDirtyChange(dirty: boolean): void;
}

const SCOPE_CLASS = "odon-host";
const scoped = scopeOdontogramCss(rawOdontogramCss, `.${SCOPE_CLASS}`);
if (scoped.missing.length > 0) {
  // Kutubxona yangilangan va CSS tuzilmasi o'zgargan — global qoida
  // ilovaga "oqib" chiqishi mumkin. `scopeOdontogramCss.ts`ni yangilang.
  console.warn("odontogram CSS: kutilgan global qoidalar topilmadi:", scoped.missing.join(", "));
}

function serialize(): string {
  return JSON.stringify(getStatusChart());
}

/**
 * v1 da faqat HOLAT kartasi (status). "Reja" (plan) rejimi Faza 2
 * `treatment_plans` bilan birga — narx/bosqich bilan bog'lanadi. Kutubxonada
 * buning uchun prop yo'q, faqat o'z sozlamalar API'si bor (u shunday
 * o'chirilganda, agar reja rejimida bo'lsa, holatga qaytaradi ham).
 */
function StatusOnlyMode() {
  const { settingsState } = useOdontogramUi();
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    settingsState.onPlanModeAvailable(false);
  });
  return null;
}

export default function DentalChartEditor({ ref, initialPayload, readOnly, onDirtyChange }: Props) {
  const baselineRef = useRef<string>("");
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;

  // CSS faqat shu komponent ekranda turganda — sahifadan chiqqanda olib
  // tashlanadi (izoh: scopeOdontogramCss.ts).
  useInsertionEffect(() => {
    const style = document.createElement("style");
    style.dataset.odontogram = "";
    style.textContent = scoped.css;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // DIQQAT — effektlar tartibi: React'da ICHKI komponent effekti TASHQISIDAN
  // OLDIN ishlaydi. `OdontogramProvider` (ichki) o'z effektida
  // `initOdontogram()`ni chaqiradi, shu effekt (tashqi) esa undan KEYIN —
  // demak import init'dan keyin. init asinxron (SVG shablonlarini yuklaydi),
  // lekin u tugagach har tishni joriy holatdan chizadi, shuning uchun erta
  // import yo'qolmaydi. StrictMode (dev) effektlarni ikki marta ishlatadi:
  // destroy -> init -> shu effekt qayta import qiladi.
  useEffect(() => {
    if (initialPayload) importStatus(initialPayload);
    // "Saqlanmagan o'zgarish" — hodisalar soni emas, TARKIB solishtiriladi:
    // `importStatus` o'zi ham "o'zgardi" hodisasini chiqaradi, tanlash kabi
    // amallar ham. Asos — import QILINGANDAN KEYINGI kutubxona shakli
    // (serverdagi JSON'ning o'zi emas), aks holda kalit tartibi/default
    // qiymatlar farqi soxta "o'zgarish" ko'rsatardi.
    baselineRef.current = serialize();
    onDirtyChangeRef.current(false);
    const unsubscribe = onStateChange(() => {
      onDirtyChangeRef.current(serialize() !== baselineRef.current);
    });
    return unsubscribe;
    // initialPayload o'zgarsa komponent `key` bilan qayta yaratiladi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getPayload: () => getStatusChart() as DentalChartPayload,
      markSaved: () => {
        baselineRef.current = serialize();
        onDirtyChangeRef.current(false);
      },
    }),
    [],
  );

  return (
    <div className={SCOPE_CLASS}>
      <OdontogramProvider language="ru" numberingSystem="FDI" darkMode={false} readOnly={readOnly} enableNotes>
        <StatusOnlyMode />
        {/* Kutubxonaning standart joylashuvi (App.tsx ShellLayout) takrorlangan:
            `.layout`/`.chart-column`/`.panel` klasslari uning CSS'i va engine
            (`setReadOnly` `.panel`ni qidiradi) uchun kerak. */}
        <div className="layout">
          <div className="chart-column">
            <OdontogramChartSurface />
            <ToothInfoSurface />
          </div>
          <aside className="panel">
            <ToothControlsSurface />
          </aside>
        </div>
      </OdontogramProvider>
    </div>
  );
}
