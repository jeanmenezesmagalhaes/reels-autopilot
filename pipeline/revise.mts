// Sends a redone version back to the queue.
//   npm run pipeline:revise -- <slug> <label> <file.mp4> <caption.txt>
import { execFileSync } from "node:child_process";
import { createReadStream, readFileSync } from "node:fs";
import { put } from "@vercel/blob";

const [slug, label, file, captionFile] = process.argv.slice(2);
if (!slug || !label || !file || !captionFile) throw new Error("usage: pipeline:revise -- <slug> <label> <file.mp4> <caption.txt>");
const { APP_URL, PIPELINE_SECRET } = process.env;
if (!APP_URL || !PIPELINE_SECRET) throw new Error("APP_URL and PIPELINE_SECRET must be set in .env.local");

const blob = await put(`reels/${slug}/${label}.mp4`, createReadStream(file), {
  access: "public",
  addRandomSuffix: true,
  multipart: true,
  contentType: "video/mp4",
});
const durationS =
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim()) || undefined;
const res = await fetch(new URL("/api/revision", APP_URL), {
  method: "POST",
  headers: { authorization: `Bearer ${PIPELINE_SECRET}`, "content-type": "application/json" },
  body: JSON.stringify({ slug, label, blobUrl: blob.url, caption: readFileSync(captionFile, "utf8").trim(), durationS }),
});
if (!res.ok) throw new Error(`revision ${res.status}: ${await res.text()}`);
console.log(`✓ ${slug}/${label} back in the queue`);
