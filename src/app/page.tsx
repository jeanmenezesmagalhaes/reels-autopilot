import { and, desc, eq } from "drizzle-orm";
import { db, getWorkspaceSetting, schema } from "@/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { getDictionary } from "@/i18n";
import { when } from "@/lib/format";
import { timeline } from "@/lib/projection";
import { estimateNextPostAt, pickNext } from "@/lib/scheduler";
import { connectionStatus } from "@/lib/status";
import { requireWorkspace } from "@/lib/workspace";
import { dismissDemo, postNextNow, togglePause } from "./actions";
import { Board } from "./board";
import { Calendar, currentMonth } from "./calendar";
import { demoContent } from "./demo";
import { List } from "./list";
import { Onboarding } from "./onboarding";
import { PERIODS, Results, type Period } from "./results";
import { homeHref, inStatus, matches, SORTS, STATUSES, Toolbar, VIEWS, type HomeParams, type Sort, type StatusFilter, type View } from "./views";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SearchParams = Promise<{ view?: string; periodo?: string; q?: string; status?: string; ordem?: string; mes?: string }>;

const pick = <T extends string>(options: readonly T[], value: string | undefined, fallback: T) =>
  (options as readonly string[]).includes(value ?? "") ? (value as T) : fallback;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const view = pick<View>(VIEWS, params.view, "quadro");
  const period = pick<Period>(PERIODS, params.periodo, "30");
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes ?? "") ? params.mes! : currentMonth();
  const home: HomeParams = {
    view,
    q: (params.q ?? "").trim().slice(0, 100),
    status: pick<StatusFilter>(STATUSES, params.status, "tudo"),
    ordem: pick<Sort>(SORTS, params.ordem, "data"),
    mes: params.mes && month === params.mes ? month : undefined,
  };
  const { locale, t } = await getDictionary();
  const h = t.header;
  const { workspaceId } = await requireWorkspace();
  const setting = (key: string) => getWorkspaceSetting(workspaceId, key);
  const [videos, variants, ideas, paused, learnings, next, nextAt, status, demoDismissed, onboardingHidden] = await Promise.all([
    db().select().from(schema.videos).where(eq(schema.videos.workspaceId, workspaceId)).orderBy(desc(schema.videos.createdAt)),
    db().select().from(schema.variants).where(eq(schema.variants.workspaceId, workspaceId)),
    db()
      .select()
      .from(schema.ideas)
      .where(and(eq(schema.ideas.workspaceId, workspaceId), eq(schema.ideas.status, "planned")))
      .orderBy(desc(schema.ideas.createdAt)),
    setting("paused"),
    setting("learnings").then((l) => l || undefined),
    pickNext(workspaceId),
    estimateNextPostAt(workspaceId),
    connectionStatus(workspaceId),
    setting("demo_dismissed"),
    setting("onboarding_hidden"),
  ]);
  // Brand-new dashboard: set things up first, one step per screen (app/comecar).
  if (!status.principalIg && videos.length === 0 && ideas.length === 0 && (await setting("onboarding_done")) !== "true") {
    redirect("/comecar");
  }
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
    { key: "instagram" as const, done: igReady, href: "/comecar?passo=instagram" },
    { key: "ai" as const, done: status.aiReady, href: "/comecar?passo=ia" },
    { key: "video" as const, done: videos.length > 0, href: "/novo" },
    { key: "result" as const, done: hasResult },
  ];
  const showOnboarding = onboardingHidden !== "true" && steps.some((s) => !s.done);

  const canControl = igReady && waiting > 0 && !publishing;
  // List and Calendar share one row per version, dated by when it went or should go out.
  const shown = { ideas: demo?.ideas ?? ideas, videos: demo?.videos ?? videos, variants: demo?.variants ?? variants };
  const entries = timeline(shown.videos, shown.variants, { postsPerDay, canPost: Boolean(demo) || (igReady && !isPaused) });
  const filtered = entries.filter((e) => matches(home.q, e.video.title, e.variant.label) && inStatus(e, home.status));
  const nothing = home.q ? t.filters.nothingFor(home.q) : home.status !== "tudo" ? t.filters.nothing : t.list.empty;
  const calendarNote = demo ? undefined : !igReady ? t.calendar.noIg : isPaused ? t.calendar.paused : undefined;

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
        <Toolbar t={t} p={home} entries={entries} />
        {view === "resultados" ? (
          <Results t={t} period={period} videos={shown.videos} variants={shown.variants} learnings={demo?.learnings ?? learnings} />
        ) : view === "lista" ? (
          <List t={t} entries={filtered} sort={home.ordem} demo={Boolean(demo)} empty={nothing} />
        ) : view === "calendario" ? (
          <Calendar t={t} entries={filtered} month={month} hrefFor={(mes) => homeHref(home, { mes })} note={calendarNote} demo={Boolean(demo)} />
        ) : (
          <Board
            t={t}
            demoTag={demo && t.demo.tag}
            ideas={shown.ideas.filter((i) => matches(home.q, i.title, i.notes))}
            videos={shown.videos.filter((v) => matches(home.q, v.title) || shown.variants.some((x) => x.videoId === v.id && matches(home.q, x.label)))}
            variants={shown.variants}
            nextVariantId={demo ? undefined : next?.id}
            nextAt={demo || isPaused ? undefined : nextAt}
          />
        )}
      </main>
    </>
  );
}
