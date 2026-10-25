import { desc, eq } from "drizzle-orm";
import { db, getSetting, schema } from "@/db";
import { Chevron } from "@/components/chevron";
import { SubmitButton } from "@/components/submit-button";
import { getDictionary, LOCALES, dictionaries } from "@/i18n";
import { when } from "@/lib/format";
import { cookies } from "next/headers";
import { estimateNextPostAt, pickNext } from "@/lib/scheduler";
import { disconnectInstagram, postNextNow, setPreference, togglePause } from "./actions";
import { Board } from "./board";
import { logout } from "./login/actions";
import { PERIODS, Results, type Period } from "./results";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SearchParams = Promise<{ view?: string; periodo?: string; ig?: string }>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const view = params.view === "resultados" ? "resultados" : "quadro";
  const period: Period = (PERIODS as readonly string[]).includes(params.periodo ?? "") ? (params.periodo as Period) : "30";
  const { locale, t } = await getDictionary();
  const theme = (await cookies()).get("theme")?.value ?? "system";
  const h = t.header;
  const [videos, variants, ideas, paused, learnings, next, nextAt, tokenFailingSince, storedToken, igUserId, igUsername] = await Promise.all([
    db().select().from(schema.videos).orderBy(desc(schema.videos.createdAt)),
    db().select().from(schema.variants),
    db().select().from(schema.ideas).where(eq(schema.ideas.status, "planned")).orderBy(desc(schema.ideas.createdAt)),
    getSetting("paused"),
    getSetting("learnings").then((l) => l || undefined),
    pickNext(),
    estimateNextPostAt(),
    getSetting("ig_token_failing_since"),
    getSetting("ig_access_token"),
    getSetting("ig_user_id"),
    getSetting("ig_username"),
  ]);
  const tokenAlert = Number(tokenFailingSince) > 0 && Date.now() - Number(tokenFailingSince) > 3 * 86_400_000;
  const isPaused = paused === "true";
  const publishing = variants.find((v) => v.status === "processing");
  const nextVideo = next && videos.find((v) => v.id === next.videoId);
  const postsPerDay = Number(process.env.POSTS_PER_DAY ?? 2);

  // The hero answers "what happens next?" in priority order: publishing now, nothing
  // queued, Instagram not connected, paused, or the next post time. Pause/resume and
  // "post now" only appear when there is something they would act on.
  const igReady = Boolean(storedToken && igUserId);
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
  const canControl = igReady && waiting > 0 && !publishing;
  const navStatus = !igReady ? h.igMissingShort : `@${igUsername} · ${isPaused ? h.paused : h.running(postsPerDay)}`;

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-rule bg-ground/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-12 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-8">
          <h1 className="text-[17px] font-semibold tracking-tight">Reels Autopilot</h1>
          <div className="flex items-center gap-5">
            <p className="hidden text-sm text-ink-muted sm:block">{navStatus}</p>
            <Settings locale={locale} theme={theme} igConnected={igReady} />
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
              {params.ig === "ok" && igReady && <p className="mt-1 text-[15px] text-ok">{h.igOk}</p>}
              {params.ig === "erro" && <p className="mt-1 text-[15px] text-bad">{h.igError}</p>}
            </div>
          </div>
          {!igReady && (
            <a
              href="/api/instagram/connect"
              className="rounded-full bg-ink px-5 py-2 text-[15px] font-medium text-ground transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97]"
            >
              {h.connectIg}
            </a>
          )}
          {canControl && (
            <div className="flex gap-2.5">
              <form action={togglePause}>
                <SubmitButton pending={isPaused ? h.resuming : h.pausing} variant={isPaused ? "primary" : "quiet"}>
                  {isPaused ? h.resume : h.pause}
                </SubmitButton>
              </form>
              {!isPaused && (
                <form action={postNextNow}>
                  <SubmitButton pending={h.posting} variant="primary">
                    {h.postNow}
                  </SubmitButton>
                </form>
              )}
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-8">
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
        {view === "resultados" ? (
          <Results t={t} period={period} videos={videos} variants={variants} learnings={learnings} />
        ) : (
          <Board t={t} ideas={ideas} videos={videos} variants={variants} nextVariantId={next?.id} nextAt={isPaused ? undefined : nextAt} />
        )}
      </main>
    </>
  );
}

const THEMES = ["system", "light", "dark"] as const;

// Language and theme: two segmented controls behind one disclosure, no settings page.
function Settings({ locale, theme, igConnected }: { locale: keyof typeof dictionaries; theme: string; igConnected: boolean }) {
  const t = dictionaries[locale];
  const current = (THEMES as readonly string[]).includes(theme) ? (theme as (typeof THEMES)[number]) : "system";
  const group = "flex rounded-full bg-ground-raised p-1";
  const item = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium cursor-pointer ${active ? "bg-ground text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-muted hover:text-ink"}`;
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full px-3 py-1 text-sm text-ink-muted hover:bg-ground-raised hover:text-ink [&::-webkit-details-marker]:hidden">
        {t.langName} · {t.themes[current]}
        <span className="rotate-90">
          <Chevron />
        </span>
      </summary>
      <div className="absolute right-0 z-10 mt-2 flex flex-col gap-2 rounded-2xl border border-rule bg-ground p-2 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
        <div className={group} role="group" aria-label={t.language}>
          {LOCALES.map((l) => (
            <form key={l} action={setPreference.bind(null, "lang", l)}>
              <button type="submit" aria-pressed={l === locale} className={item(l === locale)}>
                {dictionaries[l].langName}
              </button>
            </form>
          ))}
        </div>
        <div className={group} role="group" aria-label={t.theme}>
          {THEMES.map((th) => (
            <form key={th} action={setPreference.bind(null, "theme", th)}>
              <button type="submit" aria-pressed={th === current} className={item(th === current)}>
                {t.themes[th]}
              </button>
            </form>
          ))}
        </div>
        {igConnected && (
          <form action={disconnectInstagram}>
            <button type="submit" className="w-full cursor-pointer rounded-full px-3 py-1.5 text-left text-sm font-medium text-ink-muted hover:bg-ground-raised hover:text-ink">
              {t.header.disconnectIg}
            </button>
          </form>
        )}
        <form action={logout}>
          <button type="submit" className="w-full cursor-pointer rounded-full px-3 py-1.5 text-left text-sm font-medium text-ink-muted hover:bg-ground-raised hover:text-ink">
            {t.login.logout}
          </button>
        </form>
      </div>
    </details>
  );
}
