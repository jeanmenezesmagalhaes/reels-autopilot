import type { Variant } from "@/db/schema";
import type { Dictionary } from "@/i18n/dictionaries";

// Posting hours and the dashboard's clock follow the creator's timezone.
const TZ = "America/Sao_Paulo";

export function formatNumber(t: Dictionary, n: number) {
  return new Intl.NumberFormat(t.intl).format(n);
}

function dayKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

// "today 19:00", "ontem 14:05", "12 oct 09:30".
export function when(t: Dictionary, d: Date) {
  const time = new Intl.DateTimeFormat(t.intl, { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
  const k = dayKey(d);
  const day =
    k === dayKey(new Date())
      ? t.day.today
      : k === dayKey(new Date(Date.now() + 86_400_000))
        ? t.day.tomorrow
        : k === dayKey(new Date(Date.now() - 86_400_000))
          ? t.day.yesterday
          : new Intl.DateTimeFormat(t.intl, { timeZone: TZ, day: "2-digit", month: "short" }).format(d).replace(".", "");
  return { time, day, label: `${day} ${time}` };
}

export function retention(v: Variant) {
  if (v.avgWatchMs == null || !v.durationS) return null;
  return Math.round((v.avgWatchMs / (v.durationS * 1000)) * 100);
}

export const statusTone: Record<Variant["status"], string> = {
  published: "text-ok",
  processing: "text-busy",
  queued: "text-ink",
  failed: "text-bad",
  skipped: "text-off line-through",
  revision: "text-busy",
};
