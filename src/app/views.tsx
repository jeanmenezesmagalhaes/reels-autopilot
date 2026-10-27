import type { Dictionary } from "@/i18n/dictionaries";
import type { Entry } from "@/lib/projection";

export const VIEWS = ["quadro", "lista", "calendario", "resultados"] as const;
export type View = (typeof VIEWS)[number];
export const STATUSES = ["tudo", "fila", "publicados", "falhas"] as const;
export type StatusFilter = (typeof STATUSES)[number];
export const SORTS = ["data", "views"] as const;
export type Sort = (typeof SORTS)[number];

// Everything the home keeps in its URL, so every view and filter is a plain link.
export type HomeParams = { view: View; q: string; status: StatusFilter; ordem: Sort; mes?: string; periodo?: string };

export function homeHref(p: HomeParams, change: Partial<HomeParams> = {}) {
  const next = { ...p, ...change };
  const qs = new URLSearchParams();
  if (next.view !== "quadro") qs.set("view", next.view);
  if (next.q) qs.set("q", next.q);
  if (next.status !== "tudo") qs.set("status", next.status);
  if (next.ordem !== "data") qs.set("ordem", next.ordem);
  if (next.mes) qs.set("mes", next.mes);
  if (next.periodo) qs.set("periodo", next.periodo);
  const s = qs.toString();
  return s ? `/?${s}` : "/";
}

// Accent- and case-insensitive, so "acao" finds "Ação".
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export function matches(q: string, ...fields: (string | null | undefined)[]) {
  if (!q) return true;
  const needle = fold(q.trim());
  return fields.some((f) => f && fold(f).includes(needle));
}

export function inStatus(e: Entry, s: StatusFilter) {
  const st = e.variant.status;
  if (s === "fila") return st === "queued" || st === "processing" || st === "revision";
  if (s === "publicados") return st === "published";
  if (s === "falhas") return st === "failed";
  return true;
}

const segment = (active: boolean) =>
  `rounded-full px-3.5 py-1.5 whitespace-nowrap ${active ? "bg-ground text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-muted hover:text-ink"}`;

export function Segmented({ label, items }: { label: string; items: { href: string; label: React.ReactNode; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-full [scrollbar-width:none] bg-ground-raised p-1 text-[15px] font-medium">
      {items.map((i) => (
        <a key={i.href} href={i.href} aria-current={i.active ? "page" : undefined} className={segment(i.active)}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}

// View switcher on the left, search on the right; the filters for the current view below.
export function Toolbar({ t, p, entries }: { t: Dictionary; p: HomeParams; entries: Entry[] }) {
  const f = t.filters;
  const views: { id: View; label: string }[] = [
    { id: "quadro", label: t.tabs.board },
    { id: "lista", label: t.tabs.list },
    { id: "calendario", label: t.tabs.calendar },
    { id: "resultados", label: t.tabs.results },
  ];
  const searchable = p.view !== "resultados";
  const filterable = p.view === "lista" || p.view === "calendario";
  const found = entries.filter((e) => matches(p.q, e.video.title, e.variant.label));
  const count = (s: StatusFilter) => found.filter((e) => inStatus(e, s)).length;
  const statusLabels: Record<StatusFilter, string> = { tudo: f.all, fila: f.queued, publicados: f.published, falhas: f.failed };

  return (
    <div className="mb-8 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label={t.tabs.label}
          items={views.map((v) => ({ href: homeHref(p, { view: v.id, mes: undefined }), label: v.label, active: v.id === p.view }))}
        />
        {searchable && (
          <form role="search" action="/" className="relative w-full sm:w-72">
            {p.view !== "quadro" && <input type="hidden" name="view" value={p.view} />}
            {filterable && p.status !== "tudo" && <input type="hidden" name="status" value={p.status} />}
            {p.view === "lista" && p.ordem !== "data" && <input type="hidden" name="ordem" value={p.ordem} />}
            {p.view === "calendario" && p.mes && <input type="hidden" name="mes" value={p.mes} />}
            <label htmlFor="q" className="sr-only">
              {f.search}
            </label>
            <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-ink-muted" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3 3" />
            </svg>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={p.q}
              placeholder={f.searchPh}
              className="w-full rounded-full border border-rule bg-ground py-2 pr-9 pl-9 text-[15px] placeholder:text-ink-muted focus:border-ink focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {p.q && (
              <a href={homeHref(p, { q: "" })} aria-label={f.clear} className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-ground-raised hover:text-ink">
                <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m4 4 8 8M12 4l-8 8" />
                </svg>
              </a>
            )}
          </form>
        )}
      </div>
      {filterable && (
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label={f.status}
            items={STATUSES.map((s) => ({
              href: homeHref(p, { status: s }),
              active: s === p.status,
              label: (
                <>
                  {statusLabels[s]} <span className="text-ink-muted">{count(s)}</span>
                </>
              ),
            }))}
          />
          {p.view === "lista" && (
            <Segmented
              label={t.list.sort}
              items={SORTS.map((s) => ({ href: homeHref(p, { ordem: s }), active: s === p.ordem, label: s === "data" ? t.list.byDate : t.list.byViews }))}
            />
          )}
        </div>
      )}
    </div>
  );
}
