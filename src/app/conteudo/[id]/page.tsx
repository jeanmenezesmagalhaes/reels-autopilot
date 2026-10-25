import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { SubmitButton } from "@/components/submit-button";
import { getDictionary } from "@/i18n";
import { formatNumber, retention, statusTone, when } from "@/lib/format";
import { cancelPendingVersions, cancelVersion, requestRevision, updateCaption } from "../../actions";

export const metadata: Metadata = { title: "Conteúdo · Reels Autopilot" };
export const dynamic = "force-dynamic";

const field = "w-full rounded-2xl border border-rule bg-ground px-4 py-3 text-[15px] placeholder:text-ink-muted focus:border-ink focus:outline-none";

// One piece of content: what the creator asked for, and every version with its own
// actions (edit caption, redo with instructions, cancel) until it is published.
export default async function ContentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const { t } = await getDictionary();
  const c = t.content;
  const [video] = await db().select().from(schema.videos).where(eq(schema.videos.id, id));
  if (!video) notFound();
  const versions = await db().select().from(schema.variants).where(eq(schema.variants.videoId, id)).orderBy(asc(schema.variants.id));
  const pending = versions.some((v) => v.status === "queued" || v.status === "failed" || v.status === "revision");

  return (
    <main className="mx-auto max-w-[900px] px-4 pt-6 pb-20 sm:px-8">
      <Link href="/" className="text-[15px] text-ink-muted hover:text-ink">
        ← {c.back}
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance">{video.title}</h1>
      {versions.length === 0 && (
        <p className="mt-2 text-[15px] text-busy">{video.stage === "uploaded" ? c.uploadedWait : c.editingWait}</p>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-ground-raised p-4">
          <h2 className="font-semibold">{c.instructions}</h2>
          <p className="mt-1 text-[15px] whitespace-pre-line text-ink-muted">{video.brief || c.noInstructions}</p>
        </div>
        <div className="rounded-2xl bg-ground-raised p-4">
          <h2 className="font-semibold">{c.baseCaption}</h2>
          <p className="mt-1 text-[15px] whitespace-pre-line text-ink-muted">{video.baseCaption || "—"}</p>
        </div>
      </section>

      {versions.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[17px] font-semibold tracking-tight">{c.versions}</h2>
            {pending && (
              <form action={cancelPendingVersions.bind(null, video.id)}>
                <SubmitButton pending="…" variant="quiet">
                  {c.cancelAll}
                </SubmitButton>
              </form>
            )}
          </div>
          <ul className="flex flex-col gap-4">
            {versions.map((v) => {
              const editable = v.status === "queued" || v.status === "failed" || v.status === "revision";
              const r = retention(v);
              return (
                <li key={v.id} className="grid gap-4 rounded-2xl bg-ground-raised p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                  {v.status !== "published" && v.blobUrl ? (
                    <video src={v.blobUrl} controls preload="metadata" playsInline className="aspect-[9/16] w-full rounded-xl bg-ink object-cover" />
                  ) : (
                    <div className="flex aspect-[9/16] w-full items-center justify-center rounded-xl bg-ground text-sm text-ink-muted">
                      {v.permalink ? (
                        <a href={v.permalink} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-ink">
                          {c.seePost}
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-semibold">{v.label}</p>
                      <p className={`text-sm font-semibold ${statusTone[v.status]}`}>{t.status[v.status]}</p>
                    </div>
                    {v.status === "published" && (
                      <p className="text-sm text-ink-muted">
                        {v.publishedAt && when(t, v.publishedAt).label}
                        {v.views != null && ` · ${t.board.views(formatNumber(t, v.views))}`}
                        {r != null && ` · ${t.board.retention(r)}`}
                      </p>
                    )}
                    {v.status === "failed" && v.error && <p className="text-sm text-bad">{v.error}</p>}
                    {v.status === "revision" && v.revisionNote && <p className="text-[15px] text-busy">{c.redoPending(v.revisionNote)}</p>}

                    {editable ? (
                      <form action={updateCaption.bind(null, v.id)} className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-ink-muted" htmlFor={`caption-${v.id}`}>
                          {c.caption}
                        </label>
                        <textarea id={`caption-${v.id}`} name="caption" rows={4} maxLength={2200} defaultValue={v.caption} className={field} />
                        <div>
                          <SubmitButton pending="…" variant="card">
                            {c.saveCaption}
                          </SubmitButton>
                        </div>
                      </form>
                    ) : (
                      v.caption && <p className="text-[15px] whitespace-pre-line text-ink-muted">{v.caption}</p>
                    )}

                    {editable && (
                      <details className="group">
                        <summary className="cursor-pointer list-none text-[15px] font-medium underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
                          {c.redo}
                        </summary>
                        <form action={requestRevision.bind(null, v.id)} className="mt-2 flex flex-col gap-2">
                          <textarea name="note" rows={3} minLength={3} maxLength={1000} required placeholder={c.redoPh} className={field} />
                          <div>
                            <SubmitButton pending="…" variant="ink">
                              {c.redoSend}
                            </SubmitButton>
                          </div>
                        </form>
                      </details>
                    )}

                    {editable && (
                      <form action={cancelVersion.bind(null, v.id)}>
                        <SubmitButton pending="…" variant="card">
                          {c.cancel}
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
