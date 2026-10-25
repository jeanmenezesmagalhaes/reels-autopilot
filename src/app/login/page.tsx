import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Reels Autopilot" };

export default async function LoginPage() {
  const { t } = await getDictionary();
  const c = t.login;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-[360px] pb-[8vh]">
        <h1 className="text-center text-[28px] font-semibold tracking-tight">Reels Autopilot</h1>
        <p className="mt-2 mb-8 text-center text-[17px] text-ink-muted">{c.subtitle}</p>
        <LoginForm copy={{ password: c.password, submit: c.submit, submitting: c.submitting, wrong: c.wrong, locked: c.locked }} />
      </div>
    </main>
  );
}
