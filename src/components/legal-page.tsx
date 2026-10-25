// Plain reading page for legal text, in the dashboard's type and colours.
export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: [string, string][] }) {
  return (
    <main className="mx-auto max-w-[680px] px-4 py-16 sm:px-8">
      <a href="/login" className="text-[15px] font-semibold tracking-tight">
        Reels Autopilot
      </a>
      <h1 className="mt-8 text-[28px] font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-[15px] text-ink-muted">{updated}</p>
      {sections.map(([heading, body]) => (
        <section key={heading} className="mt-8">
          <h2 className="text-[17px] font-semibold">{heading}</h2>
          <p className="mt-2 text-[17px] leading-relaxed">{body}</p>
        </section>
      ))}
    </main>
  );
}
