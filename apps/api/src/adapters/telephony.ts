/**
 * Telefoniya adapter interfeysi — qollanma bo'lim 4, so'zma-so'z.
 * ADAPTER QOIDASI: har bir tashqi xizmat interfeys ortida bo'lsin.
 * Provayder almashsa, bitta fayl o'zgaradi (bu interfeys emas).
 *
 * Hozircha FAQAT interfeys — real implementatsiya Faza 3 ishi
 * (qollanma bo'lim 7: "Bot, eslatma, telefoniya adapter").
 * Birinchi haftada (bo'lim 12) klinikaning telefoniya provayderi va
 * uning API imkoniyati aniqlanadi — shundan keyin bitta concrete
 * implementatsiya (masalan `mango-office.ts`) shu interfeys ortida yoziladi.
 */

export interface Call {
  externalId: string;
  direction: "inbound" | "outbound";
  fromNumber: string;
  toNumber: string;
  startedAt: Date;
  durationSec: number;
}

export interface Recording {
  externalId: string;
  callExternalId: string;
  url: string;
}

export interface TelephonyAdapter {
  onIncomingCall(h: (c: Call) => void): void;
  onMissedCall(h: (c: Call) => void): void;
  onRecordingReady(h: (r: Recording) => void): void;
}
