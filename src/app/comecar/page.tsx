import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Chevron } from "@/components/chevron";
import { Disclosure } from "@/components/disclosure";
import { SubmitButton } from "@/components/submit-button";
import { db, schema } from "@/db";
import { getDictionary } from "@/i18n";
import { rawUploadPrefix } from "@/lib/blob-host";
import { LLM_PROVIDERS } from "@/lib/llm";
import { aiLabel, connectionStatus } from "@/lib/status";
import { requireWorkspace } from "@/lib/workspace";
import { finishOnboarding } from "../actions";
import { KeyForm } from "../ajustes/key-form";
import { NewVideoForm } from "../novo/new-video-form";

export const metadata: Metadata = { title: "Começar · Reels Autopilot" };
export const dynamic = "force-dynamic";

const STEPS = ["instagram", "ia", "video"] as const;
type Step = (typeof STEPS)[number] | "pronto";
type SearchParams = Promise<{ passo?: string; ig?: string }>;

const href = (step: Step) => `/comecar?passo=${step}`;

// First run, one thing per screen: where videos go out (Instagram), who edits them
// (AI), and the first video. Every step can be skipped; whatever is left stays in
// "Comece por aqui" on the dashboard.
export default async function StartPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const step: Step = [...STEPS, "pronto"].includes(params.passo as Step) ? (params.passo as Step) : "instagram";
  const { t } = await getDictionary();
  const o = t.start;
  const s = t.settings;
  const ws = await requireWorkspace();
  const [status, [user], videos] = await Promise.all([
    connectionStatus(ws.workspaceId),
    db().select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, ws.userId)),
    db().select({ id: schema.videos.id }).from(schema.videos).where(eq(schema.videos.workspaceId, ws.workspaceId)).limit(1),
  ]);
  const done = { instagram: Boolean(status.principalIg), ia: status.aiReady, video: videos.length > 0 };
  const index = STEPS.indexOf(step as (typeof STEPS)[number]);
  const nextStep: Step = STEPS[index + 1] ?? "pronto";
  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-4 pt-6 pb-16 sm:px-8">
      <header className="flex h-8 items-center justify-between gap-4">
        {index > 0 ? (
          <Link href={href(STEPS[index - 1])} className="text-[15px] text-ink-muted hover:text-ink">
            ← {o.back}
          </Link>
        ) : step === "pronto" ? (
          <Link href={href("video")} className="text-[15px] text-ink-muted hover:text-ink">
            ← {o.back}
          </Link>
        ) : (
          <span className="text-[15px] font-semibold tracking-tight">Reels Autopilot</span>
        )}
        {step !== "pronto" && (
          <form action={finishOnboarding}>
            <button type="submit" className="cursor-pointer text-[15px] text-ink-muted hover:text-ink">
              {o.later}
            </button>
          </form>
        )}
      </header>

      {step !== "pronto" && (
        <div className="mt-10" aria-label={o.step(index + 1, STEPS.length)}>
          <p className="text-sm font-medium text-ink-muted">{o.step(index + 1, STEPS.length)}</p>
          <div className="mt-2 flex gap-1.5" aria-hidden>
            {STEPS.map((k, i) => (
              <span key={k} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-ink" : "bg-rule"}`} />
            ))}
          </div>
        </div>
      )}

      <section className="mt-8 flex flex-col gap-6">
        {step === "instagram" && (
          <>
            <Heading title={o.instagram.title(firstName)} body={o.instagram.body} />
            {params.ig === "erro" && <Notice tone="bad">{t.header.igError}</Notice>}
            {params.ig === "em-uso" && <Notice tone="bad">{t.header.igTaken}</Notice>}
            {done.instagram ? (
              <>
                <Connected>{o.connected(status.principalIg!.label)}</Connected>
                <Actions>
                  <Link href={href(nextStep)} className={primary}>
                    {o.next}
                  </Link>
                </Actions>
              </>
            ) : (
              <>
                <Actions>
                  <a href="/api/instagram/connect?voltar=comecar" className={primary}>
                    {o.instagram.connect}
                  </a>
                  <Link href={href(nextStep)} className={quiet}>
                    {o.skip}
                  </Link>
                </Actions>
                <p className="text-sm text-ink-muted">{o.instagram.skipNote}</p>
                <Help summary={o.instagram.notPro}>
                  <p className="mt-2 text-[15px] text-ink-muted">{o.instagram.notProBody}</p>
                </Help>
              </>
            )}
          </>
        )}

        {step === "ia" && (
          <>
            <Heading title={o.ai.title} body={o.ai.body} />
            <ul className="grid gap-3 sm:grid-cols-2">
              {(["claude", "codex"] as const).map((ai) => {
                const on = status.subscriptions.has(ai);
                return (
                  <li key={ai} className="flex flex-col gap-3 rounded-2xl bg-ground-raised p-4">
                    <div>
                      <p className="font-semibold">{s.plans[ai]}</p>
                      <p className={`text-sm ${on ? "text-ok" : "text-ink-muted"}`}>{on ? s.statusOk : s.notConnected}</p>
                    </div>
                    <a href={`reelsautopilot://connect/${ai === "codex" ? "chatgpt" : "claude"}`} className={on ? card : primary}>
                      {on ? s.reconnect : s.connectMine(aiLabel(ai))}
                    </a>
                  </li>
                );
              })}
            </ul>
            {status.llms.length > 0 && <Connected>{o.ai.keyConnected(status.llms.map((l) => aiLabel(l.provider)).join(", "))}</Connected>}
            <Actions>
              {done.ia ? (
                <Link href={href(nextStep)} className={primary}>
                  {o.next}
                </Link>
              ) : (
                <Link href={href(nextStep)} className={quiet}>
                  {o.skip}
                </Link>
              )}
            </Actions>
            {!done.ia && <p className="text-sm text-ink-muted">{o.ai.skipNote}</p>}
            <div className="flex flex-col gap-3">
              <Help summary={o.ai.noLaunch}>
                <p className="mt-2 text-[15px] text-ink-muted">{s.helperFirst}</p>
                <code className="my-2 block rounded-xl bg-ground-raised px-4 py-3 text-[15px] text-ink">npm run setup</code>
                <p className="text-[15px] text-ink-muted">{s.helperAfter}</p>
              </Help>
              <Help summary={o.ai.key}>
                <p className="mt-2 mb-3 text-[15px] text-ink-muted">{s.keyBody}</p>
                <KeyForm
                  copy={{ provider: s.keyProvider, placeholder: s.keyPlaceholder, add: s.keyAdd, adding: s.keyAdding, ok: s.keyOk, bad: s.keyBad }}
                  options={(["anthropic", "openai", "google"] as const).map((id) => ({
                    id,
                    name: LLM_PROVIDERS[id].name,
                    keyUrl: LLM_PROVIDERS[id].keyUrl,
                    where: s.keyWhere(LLM_PROVIDERS[id].name),
                  }))}
                />
              </Help>
            </div>
          </>
        )}

        {step === "video" && (
          <>
            <Heading title={o.video.title} body={o.video.body} />
            {done.video ? (
              <>
                <Connected>{o.video.sent}</Connected>
                <Actions>
                  <Link href={href(nextStep)} className={primary}>
                    {o.next}
                  </Link>
                </Actions>
              </>
            ) : (
              <>
                <NewVideoForm
                  ideas={[]}
                  uploadPrefix={rawUploadPrefix(ws.workspaceId)}
                  next={href("pronto")}
                  copy={{
                    file: t.newVideo.file,
                    fileHint: t.newVideo.fileHint,
                    videoTitle: t.newVideo.videoTitle,
                    videoTitlePh: t.newVideo.videoTitlePh,
                    idea: t.newVideo.idea,
                    none: t.newVideo.none,
                    baseCaption: t.newVideo.baseCaption,
                    baseCaptionPh: t.newVideo.baseCaptionPh,
                    brief: t.newVideo.brief,
                    briefPh: t.newVideo.briefPh,
                    submit: t.newVideo.submit,
                    saving: t.newVideo.saving,
                    error: t.newVideo.error,
                    uploadingPrefix: t.newVideo.uploading(0).replace(/\s*0%$/, ""),
                  }}
                />
                <Link href={href(nextStep)} className={`${quiet} -mt-2`}>
                  {o.video.skip}
                </Link>
              </>
            )}
          </>
        )}

        {step === "pronto" && (
          <>
            <Heading
              title={done.instagram && done.ia && done.video ? o.done.titleAll : o.done.titlePart}
              body={done.instagram && done.ia && done.video ? o.done.bodyAll : o.done.bodyPart}
            />
            <ul className="divide-y divide-rule rounded-2xl bg-ground-raised">
              {STEPS.map((k) => (
                <li key={k} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex items-center gap-3">
                    <Dot done={done[k]} />
                    <span className={done[k] ? "" : "text-ink-muted"}>{o.done.items[k]}</span>
                  </span>
                  {done[k] ? (
                    <span className="text-sm text-ok">{o.done.ok}</span>
                  ) : (
                    <Link href={href(k)} className={card}>
                      {o.done.doNow}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <form action={finishOnboarding}>
              <SubmitButton pending="…" variant="primary">
                {o.done.go}
              </SubmitButton>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

const primary =
  "inline-flex w-fit justify-center rounded-full bg-ink px-5 py-2 text-[15px] font-medium text-ground transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97]";
const quiet =
  "inline-flex w-fit justify-center rounded-full bg-ground-raised px-5 py-2 text-[15px] font-medium text-ink transition-[background-color,transform] duration-150 hover:bg-rule active:scale-[0.97]";
// Secondary action on a grey card: a white pill.
const card =
  "inline-flex w-fit justify-center rounded-full bg-ground px-4 py-1.5 text-[15px] font-medium text-ink transition-[background-color,transform] duration-150 hover:bg-rule active:scale-[0.97]";

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-balance">{title}</h1>
      <p className="mt-3 text-[17px] text-ink-muted">{body}</p>
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function Notice({ tone, children }: { tone: "bad"; children: React.ReactNode }) {
  return (
    <p role="alert" className={`text-[15px] font-medium ${tone === "bad" ? "text-bad" : ""}`}>
      {children}
    </p>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

function Dot({ done }: { done: boolean }) {
  return (
    <span aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-full ${done ? "bg-ok text-ground" : "bg-ground text-ink-muted"}`}>
      {done ? <Check /> : <span className="size-1.5 rounded-full bg-current" />}
    </span>
  );
}

function Connected({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-2 text-[15px] font-medium text-ok">
      <Dot done />
      {children}
    </p>
  );
}

function Help({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <Disclosure
      className="group"
      summaryClassName="flex w-fit cursor-pointer list-none items-center gap-2 text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden"
      summary={
        <>
          <Chevron />
          {summary}
        </>
      }
    >
      {children}
    </Disclosure>
  );
}
