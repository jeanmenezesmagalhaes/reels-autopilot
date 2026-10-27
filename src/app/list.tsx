import type { Dictionary } from "@/i18n/dictionaries";
import { formatNumber, retention, statusTone, when } from "@/lib/format";
import type { Entry } from "@/lib/projection";
import type { Sort } from "./views";

// What's next on top (publishing, then the queue in posting order), then what went out
// newest first, then versions without a date (redoing, failed, canceled).
function rank(e: Entry) {
  const s = e.variant.status;
  if (s === "processing") return 0;
  if (s === "queued") return e.at ? 1 : 2;
  if (s === "revision") return 2;
  if (s === "published") return 3;
  return s === "failed" ? 4 : 5;
}

function byDate(a: Entry, b: Entry) {
  const r = rank(a) - rank(b);
  if (r) return r;
  const ta = a.at?.getTime() ?? 0;
  const tb = b.at?.getTime() ?? 0;
  return rank(a) === 1 ? ta - tb : tb - ta || b.variant.id - a.variant.id;
}

const byViews = (a: Entry, b: Entry) => (b.variant.views ?? -1) - (a.variant.views ?? -1) || byDate(a, b);

const cols = "md:grid md:grid-cols-[150px_minmax(0,1fr)_110px_90px_90px] md:items-baseline md:gap-4";

export function List({ t, entries, sort, demo, empty }: { t: Dictionary; entries: Entry[]; sort: Sort; demo: boolean; empty: string }) {
  const L = t.list;
  if (entries.length === 0) return <p className="max-w-prose text-[17px] text-ink-muted">{empty}</p>;
  const rows = [...entries].sort(sort === "views" ? byViews : byDate);

  return (
    <div className="rounded-2xl bg-ground-raised">
      <div aria-hidden className={`hidden px-4 pt-3 pb-2 text-sm font-medium text-ink-muted ${cols}`}>
        <span>{L.date}</span>
        <span>{L.content}</span>
        <span>{L.status}</span>
        <span className="text-right">{L.views}</span>
        <span className="text-right">{L.watched}</span>
      </div>
      <ul className="divide-y divide-rule">
        {rows.map((e) => {
          const v = e.variant;
          const r = retention(v);
          const w = e.at && when(t, e.at);
          return (
            <li key={v.id} className={`flex flex-col gap-0.5 px-4 py-3 text-[15px] ${cols}`}>
              <span className={`text-sm md:text-[15px] ${e.projected || !w ? "text-ink-muted" : ""}`}>
                {w ? w.label : L.noDate}
                {e.projected && <span className="text-sm"> · {L.projected}</span>}
              </span>
              <span className="min-w-0">
                {demo ? (
                  <span className="block truncate font-semibold">{e.video.title}</span>
                ) : (
                  <a href={`/conteudo/${e.video.id}`} className="block truncate font-semibold underline-offset-4 hover:underline">
                    {e.video.title}
                  </a>
                )}
                {v.permalink ? (
                  <a href={v.permalink} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-ink-muted underline decoration-rule hover:decoration-ink">
                    {v.label}
                  </a>
                ) : (
                  <span className="block truncate text-sm text-ink-muted">{v.label}</span>
                )}
                {v.status === "failed" && v.error && <span className="block truncate text-sm text-bad">{v.error}</span>}
              </span>
              <span className={`text-sm font-semibold ${statusTone[v.status]}`}>{t.status[v.status]}</span>
              <span className="text-sm text-ink-muted md:text-right md:text-[15px] md:text-ink">
                {v.views != null ? (
                  <>
                    {formatNumber(t, v.views)}
                    <span className="md:hidden"> {L.views.toLowerCase()}</span>
                  </>
                ) : (
                  <span className="hidden text-ink-muted md:inline">—</span>
                )}
              </span>
              <span className="text-sm text-ink-muted md:text-right md:text-[15px] md:text-ink">
                {r != null ? (
                  <>
                    {r}%<span className="md:hidden"> {L.watched.toLowerCase()}</span>
                  </>
                ) : (
                  <span className="hidden text-ink-muted md:inline">—</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
