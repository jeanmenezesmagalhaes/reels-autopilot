// Uploads every finished folder in 03-prontos to Vercel Blob, registers it
// in the app via /api/ingest, then moves the folder to 04-na-fila.
//
// Folder layout: 03-prontos/<slug>/manifest.json + the mp4 files it lists.
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { put } from "@vercel/blob";
import { z } from "zod";

const manifestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  sourceFile: z.string().optional(),
  variants: z
    .array(z.object({ file: z.string(), label: z.string().min(1), caption: z.string().max(2200) }))
    .min(5, "need at least 5 variants"),
});

const root = process.env.REELS_DIR ?? join(homedir(), "Movies", "ReelsAutopilot");
const ready = join(root, "03-prontos");
const queued = join(root, "04-na-fila");

for (const name of ["APP_URL", "PIPELINE_SECRET", "BLOB_READ_WRITE_TOKEN"]) {
  if (!process.env[name]) throw new Error(`${name} is not set (see .env.example)`);
}

function duration(file: string) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number(out.toString().trim()) || undefined;
}

async function uploadFolder(dir: string) {
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")));

  const variants = [];
  for (const v of manifest.variants) {
    const file = join(dir, v.file);
    if (!existsSync(file)) throw new Error(`${manifest.slug}: missing ${v.file}`);
    const blob = await put(`reels/${manifest.slug}/${v.file}`, createReadStream(file), {
      access: "public",
      addRandomSuffix: true,
      multipart: true,
      contentType: "video/mp4",
    });
    console.log(`  uploaded ${v.file}`);
    variants.push({ label: v.label, caption: v.caption, blobUrl: blob.url, durationS: duration(file) });
  }

  const res = await fetch(new URL("/api/ingest", process.env.APP_URL), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.PIPELINE_SECRET}` },
    body: JSON.stringify({ slug: manifest.slug, title: manifest.title, sourceFile: manifest.sourceFile, variants }),
  });
  if (!res.ok) throw new Error(`${manifest.slug}: ingest failed ${res.status} ${await res.text()}`);
  console.log(`  queued ${variants.length} variants`);

  renameSync(dir, join(queued, manifest.slug));
}

const folders = readdirSync(ready, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(ready, d.name, "manifest.json")))
  .map((d) => join(ready, d.name));

if (folders.length === 0) console.log("nothing to upload");
let failed = false;
for (const dir of folders) {
  console.log(dir);
  try {
    await uploadFolder(dir);
  } catch (err) {
    failed = true;
    console.error(`  ${(err as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
