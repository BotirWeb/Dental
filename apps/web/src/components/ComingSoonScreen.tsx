interface Props {
  title: string;
  screenNumber: number;
  note?: string;
}

/** Hali qurilmagan ekranlar uchun placeholder — bo'lim 7 fazalash rejasiga
 * halol havola bilan (foydalanuvchi "nega bo'sh" deb ajablanmasin). */
export function ComingSoonScreen({ title, screenNumber, note }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Ekran #{screenNumber} — qollanma bo'lim 6
      </p>
      <h1 className="mt-1 text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">Bu ekran hali qurilmagan.</p>
      {note && <p className="mt-1 text-sm text-slate-400">{note}</p>}
    </div>
  );
}
