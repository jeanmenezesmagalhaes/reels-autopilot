// Renders the analysis routine's markdown subset (## headings, - bullets,
// _italic_ meta line, paragraphs) as plain React text. No HTML injection.
export function Learnings({ markdown }: { markdown: string }) {
  const blocks: React.ReactNode[] = [];
  let items: string[] = [];
  const flush = () => {
    if (items.length) {
      blocks.push(
        <ul key={blocks.length} className="mb-4 list-disc space-y-1 pl-5 marker:text-ink-muted">
          {items.map((t, i) => (
            <li key={i}>{strip(t)}</li>
          ))}
        </ul>,
      );
      items = [];
    }
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("- ") || line.startsWith("* ")) {
      items.push(line.slice(2));
      continue;
    }
    flush();
    if (!line) continue;
    if (line.startsWith("#")) {
      blocks.push(
        <h3 key={blocks.length} className="mt-5 mb-1.5 text-base font-semibold first:mt-0">
          {strip(line.replace(/^#+\s*/, ""))}
        </h3>,
      );
    } else if (/^_.*_$/.test(line)) {
      blocks.push(
        <p key={blocks.length} className="mb-3 text-sm text-ink-muted">
          {line.slice(1, -1)}
        </p>,
      );
    } else {
      blocks.push(
        <p key={blocks.length} className="mb-3">
          {strip(line)}
        </p>,
      );
    }
  }
  flush();
  return <div className="text-[17px] leading-snug">{blocks}</div>;
}

function strip(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`(.+?)`/g, "$1");
}
