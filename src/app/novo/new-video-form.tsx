"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createVideo } from "../actions";

type Copy = {
  file: string;
  fileHint: string;
  videoTitle: string;
  videoTitlePh: string;
  idea: string;
  none: string;
  baseCaption: string;
  baseCaptionPh: string;
  brief: string;
  briefPh: string;
  submit: string;
  saving: string;
  error: string;
  uploadingPrefix: string;
};

const field = "w-full rounded-2xl border border-rule bg-ground px-4 py-3 text-[15px] placeholder:text-ink-muted focus:border-ink focus:outline-none";

// Uploads the raw video straight from the browser to Blob, then saves the brief.
export function NewVideoForm({
  copy,
  ideas,
  uploadPrefix,
  next = "/",
}: {
  copy: Copy;
  ideas: { id: number; title: string }[];
  uploadPrefix: string;
  // Where to go once the video is saved (the first-run flow goes on to its last step).
  next?: string;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return;
    setState("idle");
    try {
      setProgress(0);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
      const blob = await upload(`${uploadPrefix}raw.${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        multipart: true,
        onUploadProgress: (p) => setProgress(Math.round(p.percentage)),
      });
      setState("saving");
      const ideaId = Number(form.get("ideaId")) || undefined;
      await createVideo({
        title: String(form.get("title") ?? ""),
        brief: String(form.get("brief") ?? ""),
        baseCaption: String(form.get("baseCaption") ?? ""),
        rawUrl: blob.url,
        ideaId,
      });
      router.push(next);
    } catch {
      setState("error");
      setProgress(null);
    }
  }

  const busy = progress !== null && state !== "error";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className="font-semibold">{copy.file}</span>
        <input name="file" type="file" accept="video/*" required className={`${field} file:mr-3 file:rounded-full file:border-0 file:bg-ground-raised file:px-4 file:py-1.5 file:text-[15px] file:font-medium`} />
        <span className="text-sm text-ink-muted">{copy.fileHint}</span>
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold">{copy.videoTitle}</span>
        <input name="title" required minLength={2} maxLength={120} placeholder={copy.videoTitlePh} className={field} />
      </label>
      {ideas.length > 0 && (
        <label className="flex flex-col gap-2">
          <span className="font-semibold">{copy.idea}</span>
          <select name="ideaId" className={field} defaultValue="">
            <option value="">{copy.none}</option>
            {ideas.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-2">
        <span className="font-semibold">{copy.baseCaption}</span>
        <textarea name="baseCaption" rows={4} maxLength={2200} placeholder={copy.baseCaptionPh} className={field} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold">{copy.brief}</span>
        <textarea name="brief" rows={4} maxLength={2000} placeholder={copy.briefPh} className={field} />
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer rounded-full bg-ink px-6 py-2.5 text-[15px] font-medium text-ground transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97] disabled:cursor-wait disabled:opacity-50"
        >
          {state === "saving" ? copy.saving : busy ? `${copy.uploadingPrefix} ${progress}%` : copy.submit}
        </button>
        {state === "error" && (
          <p role="alert" className="text-[15px] text-bad">
            {copy.error}
          </p>
        )}
      </div>
    </form>
  );
}
