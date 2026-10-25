import { desc, eq } from "drizzle-orm";
import { db, getSetting, schema } from "@/db";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { getDictionary } from "@/i18n";
import { when } from "@/lib/format";
import { estimateNextPostAt, pickNext } from "@/lib/scheduler";
import { connectionStatus } from "@/lib/status";
import { dismissDemo, postNextNow, togglePause } from "./actions";
import { Board } from "./board";
import { demoContent } from "./demo";
import { Onboarding } from "./onboarding";
import { PERIODS, Results, type Period } from "./results";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SearchParams = Promise<{ view?: string; periodo?: string }>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const view = params.view === "resultados" ? "resultados" : "quadro";
  const period: Period = (PERIODS as readonly string[]).includes(params.periodo ?? "") ? (params.periodo as Period) : "30";
  const { locale, t } = await getDictionary();
  const h = t.header;
  const [videos, variants, ideas, paused, learnings, next, nextAt, status, demoDismissed, onboardingHidden] = await Promise.all([
    db().select().from(schema.videos).orderBy(desc(schema.videos.createdAt)),
    db().select().from(schema.variants),
    db().select().from(schema.ideas).where(eq(schema.ideas.status, "planned")).orderBy(desc(schema.ideas.createdAt)),
    getSetting("paused"),
    getSetting("learnings").then((l) => l || undefined),
    pickNext(),
    estimateNextPostAt(),
    connectionStatus(),
    getSetting("demo_dismissed"),
    getSetting("onboarding_hidden"),
  ]);
  const ig = status.principalIg;
  const tokenAlert = ig?.status === "error";
  const isPaused = paused === "true";
  const publishing = variants.find((v) => v.status === "processing");
  const nextVideo = next && videos.find((v) => v.id === next.videoId);
  const postsPerDay = Number(process.env.POSTS_PER_DAY ?? 2);

  // The hero answers "what happens next?" in priority order: publishing now, nothing
  // queued, Instagram not connected, paused, or the next post time. Pause/resume and
  // "post now" only appear when there is something they would act on.
  const igReady = Boolean(ig);
  const waiting = variants.filter((v) => v.status === "queued").length;
  const hasQueue = waiting > 0 || Boolean(publishing);
  let bigTime: string;
  let bigTone = "text-ink";
  let headline: string;
  let detail: string;
  let note: string | undefined;
  if (publishing) {
    bigTime = h.now;
    bigTone = "text-ok";
    headline = videos.find((v) => v.id === publishing.videoId)?.title ?? "";
    detail = h.publishing(publishing.label);
  } else if (!hasQueue) {
    bigTime = h.emptyWord;
    bigTone = "text-ink-muted";
    headline = h.emptyHeadline;
    detail = h.dropHint;
    if (!igReady) note = h.igMissing;
  } else if (!igReady) {
    bigTime = h.waitingWord;
    bigTone = "text-busy";
    headline = nextVideo?.title ?? h.waiting(waiting);
    detail = h.waiting(waiting);
    note = h.igMissing;
  } else if (isPaused) {
    bigTime = h.pausedWord;
    bigTone = "text-busy";
    headline = nextVideo?.title ?? h.waiting(waiting);
    detail = h.waiting(waiting);
  } else {
    const w = nextAt && when(t, nextAt);
    bigTime = w ? w.time : "—";
    headline = nextVideo?.title ?? "";
    detail = next ? h.next(next.label, w ? w.day : undefined) : h.waiting(waiting);
  }
  // First visit: example cards in every column until the creator has content of
  // their own or removes them. Examples are rendered only, never stored or posted.
  const hasOwnContent = videos.length > 0 || ideas.length > 0;
  const showDemo = !hasOwnContent && demoDismissed !== "true";
  const demo = showDemo ? demoContent(locale) : undefined;
  const hasResult = variants.some((v) => v.status === "published" && v.views != null);
  const steps = [
    { key: "instagram" as const, done: igReady, href: "/api/instagram/connect" },
    { key: "ai" as const, done: status.aiReady, href: "/ajustes#ia" },
    { key: "video" as const, done: videos.length > 0, href: "/novo" },
    { key: "result" as const, done: hasResult },
  ];
  const showOnboarding = onboardingHidden !== "true" && steps.some((s) => !s.done);

  const canControl = igReady && waiting > 0 && !publishing;
  const navStatus = !igReady ? h.igMissingShort : `${ig.label} · ${isPaused ? h.paused : h.running(postsPerDay)}`;

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-rule bg-ground/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-12 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-8">
          <h1 className="text-[17px] font-semibold tracking-tight">Reels Autopilot</h1>
          <div className="flex items-center gap-5">
            <p className="hidden text-sm text-ink-muted sm:block">{navStatus}</p>
            <div className="flex items-center">
              <a href="/perfil" className="rounded-full px-3 py-1 text-sm font-medium text-ink hover:bg-ground-raised">
                {t.profile.link}
              </a>
              <a href="/ajustes" className="rounded-full px-3 py-1 text-sm font-medium text-ink hover:bg-ground-raised">
                {t.settings.link}
              </a>
            </div>
          </div>
        </div>
      </header>

      {tokenAlert && (
        <p role="alert" className="mx-auto mt-4 max-w-[1200px] px-4 text-[15px] font-medium text-bad sm:px-8">
          {h.tokenAlert}
        </p>
      )}

      <section className="mx-auto max-w-[1200px] px-4 pt-10 pb-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-0 flex-wrap items-end gap-x-8 gap-y-3">
            <p className={`text-6xl leading-none font-semibold tracking-tight tabular-nums sm:text-7xl ${bigTone}`}>{bigTime}</p>
            <div className="min-w-0 pb-1">
              <p className="text-2xl font-semibold tracking-tight text-balance">{headline}</p>
              <p className="mt-1 text-[15px] text-ink-muted">{detail}</p>
              {note && <p className="mt-1 text-[15px] text-busy">{note}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/novo"
              className="rounded-full bg-ink px-5 py-2 text-[15px] font-medium text-ground transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97]"
            >
              {t.newVideo.button}
            </Link>
          {canControl && (
            <div className="flex gap-2.5">
              <form action={togglePause}>
                <SubmitButton pending={isPaused ? h.resuming : h.pausing} variant={isPaused ? "primary" : "quiet"}>
                  {isPaused ? h.resume : h.pause}
                </SubmitButton>
              </form>
              {!isPaused && (
                <form action={postNextNow}>
                  <SubmitButton pending={h.posting} variant="quiet">
                    {h.postNow}
                  </SubmitButton>
                </form>
              )}
            </div>
          )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-8">
        {showOnboarding && <Onboarding t={t} steps={steps} />}
        <nav aria-label={t.tabs.label} className="mb-8 inline-flex rounded-full bg-ground-raised p-1 text-[15px] font-medium">
          {[
            { id: "quadro", label: t.tabs.board },
            { id: "resultados", label: t.tabs.results },
          ].map((tab) => (
            <a
              key={tab.id}
              href={tab.id === "quadro" ? "/" : "/?view=resultados"}
              aria-current={tab.id === view ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 ${tab.id === view ? "bg-ground text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-muted hover:text-ink"}`}
            >
              {tab.label}
            </a>
          ))}
        </nav>
        {demo && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-rule px-4 py-3">
            <p className="text-[15px] text-ink-muted">{t.demo.banner}</p>
            <form action={dismissDemo}>
              <SubmitButton pending="…" variant="quiet">
                {t.demo.remove}
              </SubmitButton>
            </form>
          </div>
        )}
        {view === "resultados" ? (
          <Results
            t={t}
            period={period}
            videos={demo?.videos ?? videos}
            variants={demo?.variants ?? variants}
            learnings={demo?.learnings ?? learnings}
          />
        ) : demo ? (
          <Board t={t} demoTag={t.demo.tag} ideas={demo.ideas} videos={demo.videos} variants={demo.variants} />
        ) : (
          <Board t={t} ideas={ideas} videos={videos} variants={variants} nextVariantId={next?.id} nextAt={isPaused ? undefined : nextAt} />
        )}
      </main>
    </>
  );
}
