// Talks to the app so the routines never put secrets on a command line.
//   npm run pipeline:report                          -> learnings + post metrics as JSON
//   npm run pipeline:report -- save <file.md>        -> saves the markdown file as the new learnings
//   npm run pipeline:report -- ideas <file.json>     -> adds suggested ideas ([{ "title", "notes" }]) to "Planejado"
//   npm run pipeline:report -- editing <slug> <title> -> shows the video in "Em edição"
import { readFileSync } from "node:fs";

const { APP_URL, PIPELINE_SECRET } = process.env;
if (!APP_URL || !PIPELINE_SECRET) throw new Error("APP_URL and PIPELINE_SECRET must be set in .env.local");

const headers = { authorization: `Bearer ${PIPELINE_SECRET}`, "content-type": "application/json" };
const [cmd, a, b] = process.argv.slice(2);

async function call(path: string, body?: unknown) {
  const res = await fetch(new URL(path, APP_URL), body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

const out =
  cmd === "save"
    ? await call("/api/report", { learnings: readFileSync(a!, "utf8") })
    : cmd === "ideas"
      ? await call("/api/ideas", { ideas: JSON.parse(readFileSync(a!, "utf8")) })
      : cmd === "editing"
        ? await call("/api/ingest", { slug: a, title: b, variants: [] })
        : await call("/api/report");
console.log(JSON.stringify(out, null, 2));
