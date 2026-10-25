import type { Dictionary } from "@/i18n/dictionaries";
import { SubmitButton } from "@/components/submit-button";
import { hideOnboarding } from "./actions";

type Step = { key: keyof Dictionary["onboarding"]["steps"]; done: boolean; href?: string };

// First-run checklist: the four things between signing up and the first result.
// Each step links straight to where it gets done; it disappears once all are done.
export function Onboarding({ t, steps }: { t: Dictionary; steps: Step[] }) {
  const o = t.onboarding;
  const doneCount = steps.filter((s) => s.done).length;
  const current = steps.find((s) => !s.done)?.key;
  return (
    <section aria-labelledby="comece" className="mb-10 rounded-2xl bg-ground-raised p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id="comece" className="text-[17px] font-semibold tracking-tight">
          {o.title} <span className="ml-2 text-[15px] font-normal text-ink-muted">{o.progress(doneCount, steps.length)}</span>
        </h2>
        <form action={hideOnboarding}>
          <SubmitButton pending="…" variant="card">
            {o.hide}
          </SubmitButton>
        </form>
      </div>
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => {
          const copy = o.steps[s.key] as { title: string; body: string; action?: string };
          const active = s.key === current;
          return (
            <li key={s.key} className={`flex gap-3 rounded-xl bg-ground p-4 ${active ? "ring-2 ring-ink" : ""}`}>
              <span
                aria-hidden
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${s.done ? "bg-ok text-ground" : active ? "bg-ink text-ground" : "bg-ground-raised text-ink-muted"}`}
              >
                {s.done ? (
                  <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <div className="min-w-0">
                <p className={`font-semibold ${s.done ? "text-ink-muted line-through decoration-rule" : ""}`}>
                  {copy.title}
                  {s.done && <span className="sr-only"> · {o.done}</span>}
                </p>
                <p className="mt-1 text-[15px] text-ink-muted">{copy.body}</p>
                {!s.done && s.href && copy.action && (
                  <a
                    href={s.href}
                    className={`mt-3 inline-flex rounded-full px-4 py-1.5 text-[15px] font-medium transition-[opacity,transform] duration-150 active:scale-[0.97] ${active ? "bg-ink text-ground hover:opacity-85" : "bg-ground-raised text-ink hover:bg-rule"}`}
                  >
                    {copy.action}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
