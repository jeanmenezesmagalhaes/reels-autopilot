// Talks to /api/report so the routines never put secrets on a command line.
//   npm run pipeline:report            -> prints learnings + post metrics as JSON
//   npm run pipeline:report -- save F  -> saves markdown file F as the new learnings
import { readFileSync } from "node:fs";

const { APP_URL, PIPELINE_SECRET } = process.env;
if (!APP_URL || !PIPELINE_SECRET) throw new Error("APP_URL and PIPELINE_SECRET must be set in .env.local");

const url = new URL("/api/report", APP_URL);
const headers = { authorization: `Bearer ${PIPELINE_SECRET}`, "content-type": "application/json" };
const [cmd, file] = process.argv.slice(2);

const res =
  cmd === "save"
    ? await fetch(url, { method: "POST", headers, body: JSON.stringify({ learnings: readFileSync(file!, "utf8") }) })
    : await fetch(url, { headers });
if (!res.ok) throw new Error(`report ${res.status}: ${await res.text()}`);
console.log(JSON.stringify(await res.json(), null, 2));
