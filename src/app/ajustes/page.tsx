import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Chevron } from "@/components/chevron";
import { SubmitButton } from "@/components/submit-button";
import { dictionaries, getDictionary, LOCALES } from "@/i18n";
import { LLM_PROVIDERS } from "@/lib/llm";
import { readSession, SESSION_COOKIE } from "@/lib/session";
import { aiLabel, connectionStatus } from "@/lib/status";
import { disconnectInstagram, moveLlmConnection, removeLlmConnection, setPreference, setPrincipalInstagram } from "../actions";
import { logout } from "../login/actions";
import { KeyForm } from "./key-form";

export const metadata: Metadata = { title: "Ajustes · Reels Autopilot" };
export const dynamic = "force-dynamic";

const THEMES = ["system", "light", "dark"] as const;
type SearchParams = Promise<{ ig?: string }>;

// Everything a creator connects, in plain language: where videos are published
// (Instagram), who edits and analyses them (AI), and the account itself.
export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { locale, t } = await getDictionary();
  const s = t.settings;
  const jar = await cookies();
  const theme = jar.get("theme")?.value ?? "system";
  const session = await readSession(jar.get(SESSION_COOKIE)?.value);
  const { instagram, llms, subscriptions, lastSeen } = await connectionStatus();
  const ago = (ms: number) => new Intl.RelativeTimeFormat(t.intl, { numeric: "auto" }).format(-Math.round((Date.now() - ms) / 60000), "minute");

  return (
    <main className="mx-auto max-w-[760px] px-4 pt-6 pb-20 sm:px-8">
      <Link href="/" className="text-[15px] text-ink-muted hover:text-ink">
        ← {s.back}
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{s.title}</h1>

      <Section id="instagram" title={s.igTitle} intro={s.igIntro}>
        {params.ig === "ok" && <Notice tone="ok">{t.header.igOk}</Notice>}
        {params.ig === "erro" && <Notice tone="bad">{t.header.igError}</Notice>}
        {instagram.length === 0 ? (
          <p className="text-[15px] text-ink-muted">{s.igEmpty}</p>
        ) : (
          <ul className="divide-y divide-rule rounded-2xl bg-ground-raised">
            {instagram.map((a, i) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold">{a.label}</p>
                  <Status ok={a.status === "ok"} copy={s} />
                </div>
                <div className="flex items-center gap-2">
                  {i === 0 ? (
                    <span className="text-sm text-ink-muted">{s.principal}</span>
                  ) : (
                    <form action={setPrincipalInstagram.bind(null, a.id)}>
                      <SubmitButton pending="…" variant="card">
                        {s.makePrincipal}
                      </SubmitButton>
                    </form>
                  )}
                  <form action={disconnectInstagram.bind(null, a.id)}>
                    <SubmitButton pending="…" variant="card">
                      {s.disconnect}
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <a href="/api/instagram/connect" className={instagram.length ? secondaryLink : primaryLink}>
          {instagram.length ? s.igConnectAnother : s.igConnect}
        </a>
      </Section>

      <Section id="ia" title={s.aiTitle} intro={s.aiIntro}>
        <div>
          <p className="font-semibold">{s.subTitle}</p>
          <p className="mt-1 max-w-prose text-[15px] text-ink-muted">{s.subBody}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(["claude", "codex"] as const).map((ai) => {
            const on = subscriptions.has(ai);
            const name = aiLabel(ai);
            return (
              <li key={ai} className="flex flex-col gap-3 rounded-2xl bg-ground-raised p-4">
                <div>
                  <p className="font-semibold">{s.plans[ai]}</p>
                  <p className={`text-sm ${on ? "text-ok" : "text-ink-muted"}`}>
                    {on && lastSeen ? s.connectedMine(ago(lastSeen)) : s.notConnected}
                  </p>
                </div>
                <a href={`reelsautopilot://connect/${ai === "codex" ? "chatgpt" : "claude"}`} className={on ? cardLink : primaryLink}>
                  {on ? s.reconnect : s.connectMine(name)}
                </a>
              </li>
            );
          })}
        </ul>
        <div className="text-[15px] text-ink-muted">
          <p>{s.helperFirst}</p>
          <code className="my-2 block rounded-xl bg-ground-raised px-4 py-3 text-ink">npm run setup</code>
          <p>{s.helperAfter}</p>
        </div>

        <details className="group rounded-2xl border border-rule p-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
            <Chevron />
            {s.advanced}
          </summary>
          {llms.length > 0 && (
            <ul className="mt-4 divide-y divide-rule rounded-2xl bg-ground-raised">
              {llms.map((c, i) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-semibold">
                      {aiLabel(c.provider)} <span className="font-normal text-ink-muted">{c.label}</span>
                    </p>
                    <p className="text-sm text-ink-muted">
                      {s.order(i + 1)} · <StatusText ok={c.status === "ok"} copy={s} />
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {i > 0 && (
                      <form action={moveLlmConnection.bind(null, c.id, "up")}>
                        <SubmitButton pending="…" variant="card">
                          {s.up}
                        </SubmitButton>
                      </form>
                    )}
                    {i < llms.length - 1 && (
                      <form action={moveLlmConnection.bind(null, c.id, "down")}>
                        <SubmitButton pending="…" variant="card">
                          {s.down}
                        </SubmitButton>
                      </form>
                    )}
                    <form action={removeLlmConnection.bind(null, c.id)}>
                      <SubmitButton pending="…" variant="card">
                        {s.remove}
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 mb-3 text-[15px] text-ink-muted">{s.keyBody}</p>
          <KeyForm
            copy={{ provider: s.keyProvider, placeholder: s.keyPlaceholder, add: s.keyAdd, adding: s.keyAdding, ok: s.keyOk, bad: s.keyBad }}
            options={(["anthropic", "openai", "google"] as const).map((id) => ({
              id,
              name: LLM_PROVIDERS[id].name,
              keyUrl: LLM_PROVIDERS[id].keyUrl,
              where: s.keyWhere(LLM_PROVIDERS[id].name),
            }))}
          />
        </details>
      </Section>

      <Section title={s.accountTitle}>
        {session && session.email !== "owner" && <p className="text-[15px]">{s.signedAs(session.email)}</p>}
        <div className="flex flex-wrap gap-3">
          <Segmented label={t.language}>
            {LOCALES.map((l) => (
              <form key={l} action={setPreference.bind(null, "lang", l)}>
                <SegButton active={l === locale}>{dictionaries[l].langName}</SegButton>
              </form>
            ))}
          </Segmented>
          <Segmented label={t.theme}>
            {THEMES.map((th) => (
              <form key={th} action={setPreference.bind(null, "theme", th)}>
                <SegButton active={th === theme}>{t.themes[th]}</SegButton>
              </form>
            ))}
          </Segmented>
        </div>
        <form action={logout}>
          <SubmitButton pending="…" variant="quiet">
            {t.login.logout}
          </SubmitButton>
        </form>
      </Section>
    </main>
  );
}

const primaryLink =
  "inline-flex w-fit rounded-full bg-ink px-5 py-2 text-[15px] font-medium text-ground transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97]";
// Secondary action sitting on a grey card: a white pill, as on the board cards.
const cardLink =
  "inline-flex w-fit rounded-full bg-ground px-5 py-2 text-[15px] font-medium text-ink transition-[background-color,transform] duration-150 hover:bg-rule active:scale-[0.97]";
const secondaryLink =
  "inline-flex w-fit rounded-full bg-ground-raised px-5 py-2 text-[15px] font-medium text-ink transition-[background-color,transform] duration-150 hover:bg-rule active:scale-[0.97]";

function Section({ id, title, intro, children }: { id?: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 flex scroll-mt-6 flex-col gap-4">
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        {intro && <p className="mt-1 max-w-prose text-[15px] text-ink-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

function Notice({ tone, children }: { tone: "ok" | "bad"; children: React.ReactNode }) {
  return (
    <p role="status" className={`text-[15px] font-medium ${tone === "ok" ? "text-ok" : "text-bad"}`}>
      {children}
    </p>
  );
}

type StatusCopy = { statusOk: string; statusError: string };
function StatusText({ ok, copy }: { ok: boolean; copy: StatusCopy }) {
  return <span className={ok ? "text-ok" : "text-bad"}>{ok ? copy.statusOk : copy.statusError}</span>;
}
function Status({ ok, copy }: { ok: boolean; copy: StatusCopy }) {
  return (
    <p className="text-sm">
      <StatusText ok={ok} copy={copy} />
    </p>
  );
}

function Segmented({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex rounded-full bg-ground-raised p-1" role="group" aria-label={label}>
      {children}
    </div>
  );
}

function SegButton({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      aria-pressed={active}
      className={`cursor-pointer rounded-full px-3 py-1 text-sm font-medium ${active ? "bg-ground text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-muted hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
