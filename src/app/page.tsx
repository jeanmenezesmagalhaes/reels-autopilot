import { desc } from "drizzle-orm";
import { db, getSetting, schema } from "@/db";
import { postNextNow, setVariantStatus, togglePause } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const statusStyle: Record<string, string> = {
  queued: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  processing: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  skipped: "bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-800",
};

const statusLabel: Record<string, string> = {
  queued: "na fila",
  processing: "processando",
  published: "publicado",
  failed: "falhou",
  skipped: "pulado",
};

export default async function Home() {
  const [videos, variants, paused] = await Promise.all([
    db().select().from(schema.videos).orderBy(desc(schema.videos.createdAt)),
    db().select().from(schema.variants),
    getSetting("paused"),
  ]);
  const isPaused = paused === "true";
  const count = (s: string) => variants.filter((v) => v.status === s).length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reels Autopilot</h1>
          <p className="text-sm text-zinc-500">
            {count("queued")} na fila · {count("processing")} processando · {count("published")} publicados ·{" "}
            {count("failed")} falharam
          </p>
        </div>
        <div className="flex gap-2">
          <form action={togglePause}>
            <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
              {isPaused ? "Retomar postagens" : "Pausar postagens"}
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await postNextNow();
            }}
          >
            <button className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
              Postar próximo agora
            </button>
          </form>
        </div>
      </header>

      {isPaused && (
        <p className="mb-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Postagens pausadas. O cron não publica nada até retomar.
        </p>
      )}

      {videos.length === 0 && (
        <p className="text-zinc-500">
          Nenhum vídeo ainda. Larga um vídeo cru em <code>~/Movies/ReelsAutopilot/01-cru</code>.
        </p>
      )}

      <div className="space-y-8">
        {videos.map((video) => (
          <section key={video.id}>
            <h2 className="mb-2 font-medium">
              {video.title} <span className="text-sm font-normal text-zinc-400">{video.slug}</span>
            </h2>
            <ul className="divide-y rounded-lg border">
              {variants
                .filter((v) => v.videoId === video.id)
                .sort((a, b) => a.id - b.id)
                .map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <span className={`rounded px-2 py-0.5 text-xs ${statusStyle[v.status]}`}>
                      {statusLabel[v.status]}
                    </span>
                    <a href={v.blobUrl} target="_blank" className="font-medium hover:underline">
                      {v.label}
                    </a>
                    <span className="min-w-0 flex-1 truncate text-zinc-500" title={v.caption}>
                      {v.caption}
                    </span>
                    {v.error && (
                      <span className="w-full text-xs text-red-600" title={v.error}>
                        {v.error}
                      </span>
                    )}
                    {v.permalink && (
                      <a href={v.permalink} target="_blank" className="text-blue-600 hover:underline">
                        ver post
                      </a>
                    )}
                    {(v.status === "queued" || v.status === "failed") && (
                      <form action={setVariantStatus.bind(null, v.id, v.status === "failed" ? "queued" : "skipped")}>
                        <button className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                          {v.status === "failed" ? "tentar de novo" : "pular"}
                        </button>
                      </form>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
