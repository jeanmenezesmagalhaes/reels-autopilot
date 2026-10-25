import type { Metadata } from "next";
import { GoogleButton } from "@/components/google-button";
import { getDictionary } from "@/i18n";
import { googleConfigured } from "@/lib/google";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Reels Autopilot" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ erro?: string; excluido?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { t } = await getDictionary();
  const c = t.login;
  const notice = params.erro === "google" ? c.googleError : params.excluido ? c.deleted : undefined;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-[360px] pb-[8vh]">
        <h1 className="text-center text-[28px] font-semibold tracking-tight">Reels Autopilot</h1>
        <p className="mt-2 mb-8 text-center text-[17px] text-ink-muted">{c.subtitle}</p>
        {googleConfigured() ? (
          <GoogleButton label={c.google} />
        ) : (
          <LoginForm copy={{ password: c.password, submit: c.submit, submitting: c.submitting, wrong: c.wrong, locked: c.locked }} />
        )}
        {notice && (
          <p role="status" className={`mt-4 text-center text-[15px] ${params.erro ? "text-bad" : "text-ink-muted"}`}>
            {notice}
          </p>
        )}
      </div>
    </main>
  );
}
