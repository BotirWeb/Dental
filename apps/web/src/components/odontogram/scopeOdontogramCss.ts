/**
 * `react-advanced-odontogram/style.css` mustaqil ilova uchun yozilgan —
 * unda butun sahifaga ta'sir qiladigan 5 ta global qoida bor:
 *
 *   :root{--bg,--text,...}   — CSS o'zgaruvchilari butun hujjatga
 *   *{box-sizing:border-box} — Tailwind preflight allaqachon qiladi
 *   html,body{height:100%}   — bizning layout'ni buzadi
 *   body{margin;font;background:radial-gradient(...)} — BIZNING fon/shriftni almashtiradi
 *   select{...}, select:focus{...} — ilovadagi BARCHA select'lar ko'rinishini o'zgartiradi
 *
 * Bundan tashqari CSS bir marta yuklansa, SPA'da boshqa sahifaga o'tganda
 * ham qolib ketardi. Shuning uchun CSS `?inline` matn sifatida olinadi,
 * shu funksiya global qoidalarni olib tashlaydi / `scope` ichiga qamaydi,
 * natija esa faqat karta sahifasi ochiq turganda `<style>` sifatida
 * qo'yiladi (`DentalChartEditor.tsx`).
 *
 * Teskari yo'nalish ham bor: Tailwind preflight (`@layer base`) kutubxona
 * kutmagan standartlarni o'rnatadi. Hozircha bittasi zarar qiladi —
 * `img{max-width:100%}`: ikonka tugmasi kengligi o'z tarkibidan hisoblanadi,
 * natijada ikonka 0px bo'lib qolardi (grid ustidagi "tanlovni tozalash").
 * Shuning uchun oxiriga `max-width:none` qo'shiladi.
 *
 * Almashtirishlar vendored 2.5.0 minifikatsiya qilingan CSS'iga moslangan.
 * Kutubxona yangilanib naqsh topilmay qolsa — `missing` ro'yxatida qaytadi
 * (chaqiruvchi konsolga ogohlantiradi), sahifa baribir ishlaydi.
 */
export function scopeOdontogramCss(css: string, scope: string): { css: string; missing: string[] } {
  const missing: string[] = [];
  let out = css;

  const replace = (label: string, pattern: RegExp, replacement: string) => {
    if (!pattern.test(out)) {
      missing.push(label);
      return;
    }
    pattern.lastIndex = 0;
    out = out.replace(pattern, replacement);
  };

  replace("*{box-sizing}", /(^|\})\*\{box-sizing:border-box\}/g, "$1");
  replace("html,body{height}", /(^|\})html,body\{[^}]*\}/g, "$1");
  replace("body{...}", /(^|\})body\{[^}]*\}/g, "$1");
  replace(":root{...}", /(^|\})\s*:root\{/g, `$1${scope}{`);
  replace("select{...}", /(^|\})select(?=[{:])/g, `$1${scope} select`);

  out += `${scope} img{max-width:none}`;

  return { css: out, missing };
}
