import { and, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db, schema } from "@/db";
import { getDictionary } from "@/i18n";
import { rawUploadPrefix } from "@/lib/blob-host";
import { requireWorkspace } from "@/lib/workspace";
import { NewVideoForm } from "./new-video-form";

export const metadata: Metadata = { title: "Novo vídeo · Reels Autopilot" };
export const dynamic = "force-dynamic";

export default async function NewVideoPage() {
  const { t } = await getDictionary();
  const n = t.newVideo;
  const { workspaceId } = await requireWorkspace();
  const ideas = await db()
    .select({ id: schema.ideas.id, title: schema.ideas.title })
    .from(schema.ideas)
    .where(and(eq(schema.ideas.workspaceId, workspaceId), eq(schema.ideas.status, "planned")))
    .orderBy(desc(schema.ideas.createdAt));
  return (
    <main className="mx-auto max-w-[640px] px-4 pt-6 pb-20 sm:px-8">
      <Link href="/" className="text-[15px] text-ink-muted hover:text-ink">
        ← {t.content.back}
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{n.title}</h1>
      <p className="mt-2 mb-8 text-[15px] text-ink-muted">{n.intro}</p>
      <NewVideoForm
        ideas={ideas}
        uploadPrefix={rawUploadPrefix(workspaceId)}
        copy={{
          file: n.file,
          fileHint: n.fileHint,
          videoTitle: n.videoTitle,
          videoTitlePh: n.videoTitlePh,
          idea: n.idea,
          none: n.none,
          baseCaption: n.baseCaption,
          baseCaptionPh: n.baseCaptionPh,
          brief: n.brief,
          briefPh: n.briefPh,
          submit: n.submit,
          saving: n.saving,
          error: n.error,
          uploadingPrefix: n.uploading(0).replace(/\s*0%$/, ""),
        }}
      />
    </main>
  );
}
