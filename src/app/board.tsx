import Link from "next/link";
import type { Idea, Variant, Video } from "@/db/schema";
import { Chevron } from "@/components/chevron";
import { SubmitButton } from "@/components/submit-button";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatNumber, retention, statusTone, when } from "@/lib/format";
import { addIdea, setIdeaStatus, setVariantStatus } from "./actions";

const DAY = 86_400_000;

type Props = { t: Dictionary; demoTag?: string; ideas: Idea[]; videos: Video[]; variants: Variant[]; nextVariantId?: number; nextAt?: Date };

// Content lifecycle as a Kanban: Planejado → Em edição → Na fila → Publicado.
// The system moves cards on its own; Jean only adds ideas and marks them recorded.
export function Board({ t, demoTag, ideas, videos, variants, nextVariantId, nextAt }: Props) {
  const b = t.board;
  const byVideo = new Map<number, Variant[]>();
  for (const v of [...variants].sort((a, b) => a.id - b.id)) {
    byVideo.set(v.videoId, [...(byVideo.get(v.videoId) ?? []), v]);
  }
  const editing = videos.filter((v) => !byVideo.get(v.id)?.length);
  const queued = videos.filter((v) => byVideo.get(v.id)?.some((x) => x.status === "queued" || x.status === "processing"));
  const done = videos.filter((v) => {
    const rows = byVideo.get(v.id) ?? [];
    return rows.length > 0 && !rows.some((x) => x.status === "queued" || x.status === "processing");
  });

  return (
    <div className="grid gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-4">
      <Column title={b.planned} hint={b.plannedHint} count={ideas.length}>
        {!demoTag && (
        <form action={addIdea} className="flex gap-2">
          <label htmlFor="idea" className="sr-only">
            {b.newIdea}
          </label>
          <input
            id="idea"
            name="title"
            required
            minLength={2}
            maxLength={140}
            placeholder={b.newIdeaPlaceholder}
            className="min-w-0 flex-1 rounded-full border border-rule bg-ground px-4 py-2 text-[15px] placeholder:text-ink-muted focus:border-ink focus:outline-none"
          />
          <SubmitButton pending="…" variant="ink">
            {b.add}
          </SubmitButton>
        </form>
        )}
        {ideas.length === 0 && <Empty>{b.noIdeas}</Empty>}
        {ideas.map((idea) => (
          <Card key={idea.id} tag={demoTag}>
            <p className="font-semibold">{idea.title}</p>
            {idea.notes && <p className="mt-1 text-ink-muted">{idea.notes}</p>}
            <p className="mt-1 text-sm text-ink-muted">{idea.source === "analise" ? b.fromAnalysis : b.fromYou}</p>
            {!demoTag && (
            <div className="mt-3 flex justify-end">
              <span className="flex gap-2">
                <form action={setIdeaStatus.bind(null, idea.id, "dropped")}>
                  <SubmitButton pending="…" variant="card">
                    {b.drop}
                  </SubmitButton>
                </form>
                <form action={setIdeaStatus.bind(null, idea.id, "recorded")}>
                  <SubmitButton pending="…" variant="card">
                    {b.recorded}
                  </SubmitButton>
                </form>
              </span>
            </div>
            )}
          </Card>
        ))}
      </Column>

      <Column title={b.editing} hint={b.editingHint} count={editing.length}>
        {editing.length === 0 && <Empty>{b.editingEmpty}</Empty>}
        {editing.map((video) => (
          <Card key={video.id} tag={demoTag}>
            <VideoTitle video={video} demo={Boolean(demoTag)} />
            <p className="mt-1 text-ink-muted">
              {video.stage === "uploaded" ? t.content.uploadedWait : b.editingSince(when(t, video.createdAt).label)}
            </p>
          </Card>
        ))}
      </Column>

      <Column title={b.queued} hint={b.queuedHint} count={queued.length}>
        {queued.length === 0 && <Empty>{b.queueEmpty}</Empty>}
        {queued.map((video) => {
          const rows = byVideo.get(video.id)!;
          const waiting = rows.filter((v) => v.status === "queued").length;
          const next = rows.find((v) => v.id === nextVariantId);
          return (
            <Card key={video.id} tag={demoTag}>
              <VideoTitle video={video} demo={Boolean(demoTag)} />
              <p className="mt-1 text-ink-muted">
                {rows.some((v) => v.status === "processing")
                  ? b.publishingNow
                  : next && nextAt
                    ? b.nextVariant(next.label, when(t, nextAt).label)
                    : b.waitingOf(waiting, rows.length)}
              </p>
              <Variants t={t} rows={rows} readOnly={Boolean(demoTag)} />
            </Card>
          );
        })}
      </Column>

      <Column title={b.published} hint={b.publishedHint} count={done.length}>
        {done.length === 0 && <Empty>{b.publishedEmpty}</Empty>}
        {done.map((video) => {
          const rows = byVideo.get(video.id)!;
          const published = rows.filter((v) => v.status === "published");
          const best = published.reduce<Variant | undefined>((a, b) => ((b.views ?? 0) > (a?.views ?? -1) ? b : a), undefined);
          const measuring = published.every((v) => v.publishedAt && Date.now() - v.publishedAt.getTime() < DAY);
          return (
            <Card key={video.id} tag={demoTag}>
              <VideoTitle video={video} demo={Boolean(demoTag)} />
              <p className="mt-1 text-ink-muted">
                {published.length === 0
                  ? b.noneOut
                  : measuring
                    ? b.measuring
                    : best?.views != null
                      ? b.best(best.label, formatNumber(t, best.views))
                      : b.nPublished(published.length)}
              </p>
              <Variants t={t} rows={rows} readOnly={Boolean(demoTag)} />
            </Card>
          );
        })}
      </Column>
    </div>
  );
}

// Real content opens its page (instructions, versions, actions); examples don't.
function VideoTitle({ video, demo }: { video: Video; demo: boolean }) {
  if (demo) return <p className="font-semibold">{video.title}</p>;
  return (
    <Link href={`/conteudo/${video.id}`} className="font-semibold underline-offset-4 hover:underline">
      {video.title}
    </Link>
  );
}

function Column({ title, hint, count, children }: { title: string; hint: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-3">
      <h2 className="flex items-baseline justify-between pb-1 text-[17px] font-semibold tracking-tight">
        {title}
        <span className="text-base font-medium text-ink-muted">{count}</span>
      </h2>
      <p className="-mt-2 text-sm text-ink-muted">{hint}</p>
      {children}
    </section>
  );
}

function Card({ children, tag }: { children: React.ReactNode; tag?: string }) {
  return (
    <article className="rounded-2xl bg-ground-raised px-4 py-3 text-[15px]">
      {tag && <p className="mb-1 text-xs font-semibold tracking-wide text-ink-muted">{tag}</p>}
      {children}
    </article>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-base text-ink-muted">{children}</p>;
}

function Variants({ t, rows, readOnly = false }: { t: Dictionary; rows: Variant[]; readOnly?: boolean }) {
  const b = t.board;
  return (
    <details className="group mt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <Chevron />
        {b.versions(rows.length)}
      </summary>
      <ul className="mt-2 divide-y divide-rule">
        {rows.map((v) => {
          const r = retention(v);
          return (
            <li key={v.id} className="py-2">
              <div className="flex items-baseline justify-between gap-3">
                {v.permalink ? (
                  <a href={v.permalink} target="_blank" rel="noopener noreferrer" className="truncate underline decoration-rule hover:decoration-ink">
                    {v.label}
                  </a>
                ) : (
                  <span className="truncate">{v.label}</span>
                )}
                <span className={`shrink-0 text-sm font-semibold ${statusTone[v.status]}`}>{t.status[v.status]}</span>
              </div>
              {v.status === "published" && (
                <p className="text-sm text-ink-muted">
                  {v.views != null ? b.views(formatNumber(t, v.views)) : b.noMetrics}
                  {r != null && ` · ${b.retention(r)}`}
                  {v.shares != null && ` · ${b.shares(formatNumber(t, v.shares))}`}
                  {v.saves != null && ` · ${b.saves(formatNumber(t, v.saves))}`}
                </p>
              )}
              {v.status === "failed" && v.error && <p className="text-sm text-bad">{v.error}</p>}
              {!readOnly && (v.status === "queued" || v.status === "failed") && (
                <form action={setVariantStatus.bind(null, v.id, v.status === "failed" ? "queued" : "skipped")} className="mt-1">
                  <SubmitButton pending="…" variant="card">
                    {v.status === "failed" ? b.retry : b.skip}
                  </SubmitButton>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
