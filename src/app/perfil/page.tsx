import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatNumber, TZ } from "@/lib/format";
import { listInstagramAccounts } from "@/lib/instagram-account";
import { loadProfile } from "@/lib/profile";
import { PERIODS, type Period } from "../results";

export const metadata: Metadata = { title: "Perfil · Reels Autopilot" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ periodo?: string; conta?: string }>;

const segment = (active: boolean) =>
  `rounded-full px-4 py-1.5 ${active ? "bg-ground text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-muted hover:text-ink"}`;

// The connected Instagram profile as people see it, plus how it grew in the period:
// followers, engagement over reach, posts and views. Everything is read live from
// Instagram except the daily follower snapshots kept for growth.
export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const period: Period = (PERIODS as readonly string[]).includes(params.periodo ?? "") ? (params.periodo as Period) : "30";
  const { t } = await getDictionary();
  const P = t.profile;
  const accounts = await listInstagramAccounts();
  const account = accounts.find((a) => String(a.id) === params.conta) ?? accounts[0];

  if (!account) {
    return (
      <main className="mx-auto max-w-[760px] px-4 pt-6 pb-20 sm:px-8">
        <Back t={t} />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{P.title}</h1>
        <p className="mt-4 max-w-prose text-[17px] text-ink-muted">{P.empty}</p>
        <a
          href="/api/instagram/connect"
          className="mt-6 inline-block rounded-full bg-ink px-5 py-2 text-[15px] font-medium text-ground transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97]"
        >
          {t.settings.igConnect}
        </a>
      </main>
    );
  }

  const view = await loadProfile(account, account.id === accounts[0].id, period === "tudo" ? "all" : Number(period));
  const { profile: p, insights: i, growth, posts } = view;
  const n = (v: number) => formatNumber(t, v);
  const signed = (v: number) => new Intl.NumberFormat(t.intl, { signDisplay: "exceptZero" }).format(v);
  const periodWord = period === "tudo" ? P.allTime : t.results.periods[period].toLowerCase();
  const username = p?.username ?? account.label.replace(/^@/, "");
  const query = (o: { periodo?: string; conta?: number }) => {
    const q = new URLSearchParams();
    if ((o.periodo ?? period) !== "30") q.set("periodo", o.periodo ?? period);
    if (accounts.length > 1) q.set("conta", String(o.conta ?? account.id));
    return q.size ? `/perfil?${q}` : "/perfil";
  };

  const interactions = i && (i.likes ?? 0) + (i.comments ?? 0) + (i.shares ?? 0) + (i.saves ?? 0);
  const rate =
    i?.reach && interactions != null
      ? new Intl.NumberFormat(t.intl, { style: "percent", maximumFractionDigits: 1 }).format(interactions / i.reach)
      : undefined;
  const shortDay = (day: string) =>
    new Intl.DateTimeFormat(t.intl, { timeZone: TZ, day: "2-digit", month: "short" }).format(new Date(`${day}T12:00:00Z`)).replace(".", "");

  return (
    <main className="mx-auto max-w-[760px] px-4 pt-6 pb-20 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Back t={t} />
        {accounts.length > 1 && (
          <nav aria-label={P.accountLabel} className="inline-flex rounded-full bg-ground-raised p-1 text-[15px] font-medium">
            {accounts.map((a) => (
              <a key={a.id} href={query({ conta: a.id })} aria-current={a.id === account.id ? "page" : undefined} className={segment(a.id === account.id)}>
                {a.label}
              </a>
            ))}
          </nav>
        )}
      </div>

      <section aria-label={P.title} className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start">
        {p?.profile_picture_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Instagram CDN links expire; nothing to optimise or cache
          <img src={p.profile_picture_url} alt="" width={96} height={96} className="size-24 shrink-0 rounded-full bg-ground-raised object-cover" />
        ) : (
          <div aria-hidden className="size-24 shrink-0 rounded-full bg-ground-raised" />
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{p?.name || `@${username}`}</h1>
          {p?.name && <p className="text-[15px] text-ink-muted">@{username}</p>}
          {p && (
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[15px]">
              {[
                [p.media_count, P.posts],
                [p.followers_count, P.followers],
                [p.follows_count, P.following],
              ].map(([value, label]) => (
                <div key={label} className="flex gap-1.5">
                  <dt className="order-2 text-ink-muted">{label}</dt>
                  <dd className="font-semibold">{n(value as number)}</dd>
                </div>
              ))}
            </dl>
          )}
          {p?.biography && <p className="mt-3 max-w-prose text-[15px] whitespace-pre-line">{p.biography}</p>}
          {p?.website && (
            <a href={p.website} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[15px] underline decoration-rule hover:decoration-ink">
              {p.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
          <div className="mt-4">
            <a
              href={`https://www.instagram.com/${username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full bg-ground-raised px-5 py-2 text-[15px] font-medium transition-[background-color,transform] duration-150 hover:bg-rule active:scale-[0.97]"
            >
              {P.open}
            </a>
          </div>
        </div>
      </section>

      <nav aria-label={t.results.periodLabel} className="mt-10 mb-6 inline-flex rounded-full bg-ground-raised p-1 text-[15px] font-medium">
        {PERIODS.map((key) => (
          <a key={key} href={query({ periodo: key })} aria-current={key === period ? "page" : undefined} className={segment(key === period)}>
            {t.results.periods[key]}
          </a>
        ))}
      </nav>

      {view.error && (
        <p role="alert" className="mb-4 text-[15px] font-medium text-bad">
          {P.error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card
          title={P.followersCard}
          value={p ? n(p.followers_count) : undefined}
          lines={[
            growth && (growth.since ? P.growthSince(signed(growth.net), shortDay(growth.since)) : P.growthIn(signed(growth.net), periodWord)),
            i?.follows != null && i.unfollows != null ? P.followsUnfollows(n(i.follows), n(i.unfollows)) : undefined,
          ]}
          t={t}
        />
        <Card
          title={P.engagementCard}
          value={rate}
          lines={[
            i?.reach != null ? P.engagementBase(n(i.reach)) : undefined,
            i ? P.engagementSplit(n(i.likes ?? 0), n(i.comments ?? 0), n(i.shares ?? 0), n(i.saves ?? 0)) : undefined,
          ]}
          t={t}
        />
        <Card
          title={P.postedCard}
          value={view.error && !posts.total ? undefined : n(posts.total)}
          lines={[
            posts.reels && posts.feed ? P.postedSplit(posts.reels, posts.feed) : undefined,
            posts.trialReels ? P.trialReels(n(posts.trialReels)) : undefined,
          ]}
          t={t}
        />
        <Card title={P.viewsCard} value={i?.views != null ? n(i.views) : undefined} lines={[i?.reach != null ? P.reach(n(i.reach)) : undefined]} t={t} />
      </div>

      <section aria-labelledby="ultimos" className="mt-10">
        <h2 id="ultimos" className="mb-3 text-[17px] font-semibold tracking-tight">
          {P.recent}
        </h2>
        {view.recent.length === 0 ? (
          <p className="text-[15px] text-ink-muted">{P.noPosts}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-2xl">
            {view.recent.map((m) => {
              const src = m.thumbnail_url ?? m.media_url;
              const date = new Intl.DateTimeFormat(t.intl, { timeZone: TZ, dateStyle: "medium" }).format(new Date(m.timestamp));
              return (
                <li key={m.id} className="bg-ground-raised">
                  <a href={m.permalink} target="_blank" rel="noopener noreferrer" aria-label={date} className="block aspect-[3/4] transition-opacity hover:opacity-85">
                    {src && (
                      // eslint-disable-next-line @next/next/no-img-element -- Instagram CDN links expire; nothing to optimise or cache
                      <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-6 max-w-prose text-sm text-ink-muted">{P.source}</p>
    </main>
  );
}

function Back({ t }: { t: Dictionary }) {
  return (
    <Link href="/" className="text-[15px] text-ink-muted hover:text-ink">
      ← {t.settings.back}
    </Link>
  );
}

function Card({ title, value, lines, t }: { title: string; value?: string; lines: (string | undefined | false)[]; t: Dictionary }) {
  return (
    <section aria-label={title} className="rounded-2xl bg-ground-raised px-4 py-3">
      <h2 className="text-sm font-medium text-ink-muted">{title}</h2>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value ?? <span className="text-ink-muted">{t.profile.noData}</span>}</p>
      {lines.filter(Boolean).map((line, k) => (
        <p key={k} className={k === 0 ? "mt-1 text-[15px]" : "text-sm text-ink-muted"}>
          {line}
        </p>
      ))}
    </section>
  );
}
