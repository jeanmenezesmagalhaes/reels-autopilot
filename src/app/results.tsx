import type { Variant, Video } from "@/db/schema";
import { Learnings } from "@/components/learnings";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatNumber, retention, when } from "@/lib/format";

const DAY = 86_400_000;
export const PERIODS = ["7", "30", "365", "tudo"] as const;
export type Period = (typeof PERIODS)[number];

type Props = { t: Dictionary; period: Period; videos: Video[]; variants: Variant[]; learnings?: string };

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Post-content view: which Trial Reels worked in the period, measured against the
// period's own median views. Posts under 24h are still measuring and stay out.
export function Results({ t, period, videos, variants, learnings }: Props) {
  const R = t.results;
  const since = period === "tudo" ? 0 : Date.now() - Number(period) * DAY;
  const published = variants.filter((v) => v.status === "published" && v.publishedAt && v.publishedAt.getTime() >= since);
  const measured = published.filter((v) => v.views != null && Date.now() - v.publishedAt!.getTime() >= DAY);
  const measuring = published.length - measured.length;
  const mid = median(measured.map((v) => v.views!));
  const ranked = [...measured].sort((a, b) => b.views! - a.views!);
  const worked = ranked.filter((v) => v.views! >= mid);
  const didnt = ranked.filter((v) => v.views! < mid);
  const title = (v: Variant) => videos.find((x) => x.id === v.videoId)?.title ?? "";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <nav aria-label={R.periodLabel} className="mb-6 inline-flex rounded-full bg-ground-raised p-1 text-[15px] font-medium">
          {PERIODS.map((p) => (
            <a
              key={p}
              href={`/?view=resultados&periodo=${p}`}
              aria-current={p === period ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 ${p === period ? "bg-ground text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-muted hover:text-ink"}`}
            >
              {R.periods[p]}
            </a>
          ))}
        </nav>

        {measured.length < 2 ? (
          <p className="max-w-prose text-[17px] text-ink-muted">
            {published.length === 0
              ? period === "tudo"
                ? R.noneEver
                : R.noneInPeriod(R.periods[period].toLowerCase())
              : R.measuringOnly(measuring)}
          </p>
        ) : (
          <>
            <p className="mb-6 text-[17px]">
              {R.summary(measured.length, formatNumber(t, mid))}
              {measuring > 0 && <span className="text-ink-muted"> · {R.stillMeasuring(measuring)}</span>}
            </p>
            <div className="grid gap-x-6 gap-y-10 md:grid-cols-2">
              <Lane t={t} title={R.worked} hint={R.workedHint} rows={worked} title2={title} tone="text-ok" />
              <Lane t={t} title={R.didnt} hint={R.didntHint} rows={didnt} title2={title} tone="text-bad" />
            </div>
          </>
        )}
      </div>

      <aside aria-labelledby="aprendizados">
        <h2 id="aprendizados" className="mb-3 pb-1 text-[17px] font-semibold tracking-tight">
          {R.nextSteps}
        </h2>
        {learnings ? (
          <Learnings markdown={learnings} />
        ) : (
          <p className="text-[17px] text-ink-muted">{R.learningsEmpty}</p>
        )}
      </aside>
    </div>
  );
}

function Lane({ t, title, hint, rows, title2, tone }: { t: Dictionary; title: string; hint: string; rows: Variant[]; title2: (v: Variant) => string; tone: string }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 flex items-baseline justify-between pb-1 text-[17px] font-semibold tracking-tight">
        <span className={tone}>{title}</span>
        <span className="text-base font-medium text-ink-muted">{hint}</span>
      </h2>
      {rows.length === 0 && <p className="text-ink-muted">{t.results.noPosts}</p>}
      <ol className="flex flex-col gap-3">
        {rows.map((v) => {
          const r = retention(v);
          return (
            <li key={v.id} className="rounded-2xl bg-ground-raised px-4 py-3 text-[15px]">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate font-semibold">{title2(v)}</p>
                <p className="shrink-0 text-lg font-semibold">{formatNumber(t, v.views!)}</p>
              </div>
              <p className="text-ink-muted">
                {v.permalink ? (
                  <a href={v.permalink} target="_blank" rel="noopener noreferrer" className="underline decoration-rule hover:text-ink">
                    {v.label}
                  </a>
                ) : (
                  v.label
                )}{" "}
                · {when(t, v.publishedAt!).label}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {r != null ? t.board.retention(r) : t.results.retentionNA} · {t.board.shares(formatNumber(t, v.shares ?? 0))} ·{" "}
                {t.board.saves(formatNumber(t, v.saves ?? 0))}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
