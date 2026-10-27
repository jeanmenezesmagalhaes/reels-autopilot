import type { Dictionary } from "@/i18n/dictionaries";
import { dayKey, statusTone, when } from "@/lib/format";
import type { Entry } from "@/lib/projection";

const DAY = 86_400_000;
const MAX_PER_DAY = 3;

export function currentMonth() {
  return dayKey(new Date()).slice(0, 7);
}

const monthKey = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 7);

type Props = { t: Dictionary; entries: Entry[]; month: string; hrefFor: (month: string) => string; note?: string; demo: boolean };

// Month grid (Monday first) with what went out on its real day and what's queued on
// the day the scheduler expects to post it. Below `md` it turns into an agenda.
export function Calendar({ t, entries, month, hrefFor, note, demo }: Props) {
  const C = t.calendar;
  const [y, m] = month.split("-").map(Number);
  const first = Date.UTC(y, m - 1, 1, 12);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (new Date(first).getUTCDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => new Date(first + (i - offset) * DAY).toISOString().slice(0, 10));
  const today = dayKey(new Date());

  const byDay = new Map<string, Entry[]>();
  for (const e of entries) {
    if (!e.at) continue;
    const k = dayKey(e.at);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.at!.getTime() - b.at!.getTime());
  const inMonth = entries.filter((e) => e.at && dayKey(e.at).startsWith(month));
  const projected = inMonth.filter((e) => e.projected).length;
  const undated = entries.filter((e) => !e.at && e.variant.status === "queued").length;

  const title = new Intl.DateTimeFormat(t.intl, { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(t.intl, { weekday: "short", timeZone: "UTC" }).format(Date.UTC(2024, 0, 1 + i, 12)).replace(".", ""),
  );
  const agendaDay = (k: string) =>
    new Intl.DateTimeFormat(t.intl, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
      .format(new Date(`${k}T12:00:00Z`))
      .replaceAll(".", "");
  const agenda = cells.filter((k) => k.startsWith(month) && byDay.has(k));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight first-letter:uppercase">{title}</h2>
          <p className="mt-1 text-[15px] text-ink-muted">
            {C.summary(inMonth.length - projected, projected)}
            {undated > 0 && ` · ${C.undated(undated)}`}
          </p>
          {note && <p className="mt-1 text-[15px] text-busy">{note}</p>}
        </div>
        <div className="flex items-center gap-2">
          <a href={hrefFor(monthKey(y, m - 1))} aria-label={C.prev} className="grid size-9 place-items-center rounded-full bg-ground-raised text-ink hover:bg-rule">
            <Arrow back />
          </a>
          {month !== currentMonth() && (
            <a href={hrefFor(currentMonth())} className="rounded-full bg-ground-raised px-4 py-1.5 text-[15px] font-medium text-ink hover:bg-rule">
              {C.today}
            </a>
          )}
          <a href={hrefFor(monthKey(y, m + 1))} aria-label={C.next} className="grid size-9 place-items-center rounded-full bg-ground-raised text-ink hover:bg-rule">
            <Arrow />
          </a>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-2xl bg-rule md:block">
        <div className="grid grid-cols-7 gap-px">
          {weekdays.map((d) => (
            <div key={d} className="bg-ground-raised px-3 py-2 text-sm font-medium text-ink-muted first-letter:uppercase">
              {d}
            </div>
          ))}
          {cells.map((k) => {
            const list = byDay.get(k) ?? [];
            const outside = !k.startsWith(month);
            return (
              <div key={k} className={`min-h-28 min-w-0 bg-ground p-2 ${outside ? "text-ink-muted" : ""}`}>
                <p className="mb-1 flex">
                  <span
                    className={`grid size-7 place-items-center rounded-full text-sm font-semibold ${k === today ? "bg-ink text-ground" : outside ? "text-ink-muted" : ""}`}
                  >
                    {Number(k.slice(8))}
                  </span>
                </p>
                <ul className="flex flex-col gap-1.5">
                  {list.slice(0, MAX_PER_DAY).map((e) => (
                    <li key={e.variant.id}>
                      <Item t={t} e={e} demo={demo} compact />
                    </li>
                  ))}
                </ul>
                {list.length > MAX_PER_DAY && <p className="mt-1 px-1.5 text-xs font-medium text-ink-muted">{C.more(list.length - MAX_PER_DAY)}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="md:hidden">
        {agenda.length === 0 ? (
          <p className="text-[17px] text-ink-muted">{C.emptyMonth}</p>
        ) : (
          <ol className="flex flex-col gap-6">
            {agenda.map((k) => (
              <li key={k}>
                <h3 className={`mb-2 text-sm font-semibold first-letter:uppercase ${k === today ? "text-ink" : "text-ink-muted"}`}>
                  {k === today ? `${t.day.today} · ` : ""}
                  {agendaDay(k)}
                </h3>
                <ul className="divide-y divide-rule rounded-2xl bg-ground-raised">
                  {byDay.get(k)!.map((e) => (
                    <li key={e.variant.id} className="px-4 py-3">
                      <Item t={t} e={e} demo={demo} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Item({ t, e, demo, compact = false }: { t: Dictionary; e: Entry; demo: boolean; compact?: boolean }) {
  const status = e.projected ? (
    <span className="font-semibold text-ink-muted">{t.calendar.projected}</span>
  ) : (
    <span className={`font-semibold ${statusTone[e.variant.status]}`}>{t.status[e.variant.status]}</span>
  );
  const body = (
    <>
      <span className={`block ${compact ? "text-xs" : "text-sm"} text-ink-muted`}>
        {when(t, e.at!).time} · {status}
      </span>
      <span className={`block truncate font-medium ${compact ? "text-[13px]" : "text-[15px]"}`}>{e.video.title}</span>
      <span className={`block truncate text-ink-muted ${compact ? "text-xs" : "text-sm"}`}>{e.variant.label}</span>
    </>
  );
  const box = compact ? "block rounded-lg px-1.5 py-1" : "block";
  if (demo) return <div className={box}>{body}</div>;
  return (
    <a href={`/conteudo/${e.video.id}`} className={`${box} ${compact ? "hover:bg-ground-raised" : "hover:underline"}`}>
      {body}
    </a>
  );
}

function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`size-3.5 ${back ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}
