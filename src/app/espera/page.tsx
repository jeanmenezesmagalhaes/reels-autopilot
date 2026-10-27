import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Disclosure } from "@/components/disclosure";
import { db, schema } from "@/db";
import { getDictionary } from "@/i18n";
import { readSession, SESSION_COOKIE } from "@/lib/session";
import { deleteMyData, logout } from "../login/actions";

export const metadata: Metadata = { title: "Reels Autopilot" };
export const dynamic = "force-dynamic";

// Early-access screen for anyone who signs in with Google before being let in. Once an
// admin lets them in, coming back here opens their dashboard.
export default async function WaitlistPage() {
  const { t } = await getDictionary();
  const w = t.waitlist;
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  const [user] = session ? await db().select().from(schema.users).where(eq(schema.users.id, session.uid)) : [];
  if (user?.role === "member") redirect("/api/auth/refresh");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-[420px] pb-[8vh] text-center">
        <h1 className="text-[28px] font-semibold tracking-tight">{w.title(user?.name ?? "")}</h1>
        <p className="mt-3 text-[17px] text-ink-muted">{w.body}</p>
        <p className="mt-6 text-[15px] text-ink-muted">{w.signedAs(session?.email ?? "")}</p>
        <form action={logout} className="mt-4">
          <button type="submit" className="cursor-pointer rounded-full bg-ground-raised px-5 py-2 text-[15px] font-medium text-ink transition-[background-color,transform] duration-150 hover:bg-rule active:scale-[0.97]">
            {t.login.logout}
          </button>
        </form>
        <Disclosure
          className="mt-10"
          summaryClassName="cursor-pointer list-none text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline [&::-webkit-details-marker]:hidden"
          summary={w.deleteData}
        >
          <p className="mt-3 text-sm text-ink-muted">{w.deleteHint}</p>
          <form action={deleteMyData} className="mt-3">
            <button type="submit" className="cursor-pointer rounded-full px-5 py-2 text-[15px] font-medium text-bad ring-1 ring-bad/40 transition-[background-color,transform] duration-150 hover:bg-bad/10 active:scale-[0.97]">
              {w.deleteConfirm}
            </button>
          </form>
        </Disclosure>
      </div>
    </main>
  );
}
