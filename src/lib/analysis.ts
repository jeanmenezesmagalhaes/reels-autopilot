// Daily analysis on the server with the AIs connected in Ajustes: what worked,
// what to change in editing and script, and up to 3 ideas to record next.
// When no AI is connected here, the Mac routine (ANALYZE_PROMPT.md) does it instead.
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, getWorkspaceSetting, schema, setWorkspaceSetting } from "@/db";
import { complete, hasLlm } from "./llm";

const DAY = 86_400_000;

const SYSTEM = `Tu és o copiloto de conteúdo de um criador que publica Trial Reels no Instagram (vídeos mostrados só para quem não o segue).
Escreve em português do Brasil, curto, direto e acionável, para alguém que pode nunca ter publicado antes.
Compara primeiro versões do mesmo vídeo (mesmo conteúdo, edição diferente). Pesos: retenção (tempo assistido / duração), compartilhamentos e salvamentos por 1.000 views, views, curtidas e comentários. Considera horário (Brasília), duração e tipo de abertura (pelo nome da versão e pela legenda).
Com poucos dados, diz que é cedo e sugere o que testar; não inventa conclusão.
Responde só com JSON: {"learnings": "<markdown com as seções ## O que está funcionando, ## O que parar de fazer, ## Próxima edição, ## Próxima gravação (roteiro), ## Melhor horário; até 40 linhas>", "ideas": [{"title": "<até 140 caracteres>", "notes": "<como abrir e o que mostrar>"}]} com no máximo 3 ideias.`;

const output = z.object({
  learnings: z.string().min(1).max(20_000),
  ideas: z.array(z.object({ title: z.string().min(1).max(140), notes: z.string().max(600).optional() })).max(3),
});

export async function maybeAnalyze(workspaceId: number, log: string[]) {
  if (!(await hasLlm(workspaceId))) return;
  const last = Number((await getWorkspaceSetting(workspaceId, "analysis_at")) ?? 0);
  if (Date.now() - last < 20 * 60 * 60 * 1000) return;

  const posts = await db()
    .select({
      video: schema.videos.title,
      label: schema.variants.label,
      caption: schema.variants.caption,
      durationS: schema.variants.durationS,
      publishedAt: schema.variants.publishedAt,
      views: schema.variants.views,
      reach: schema.variants.reach,
      likes: schema.variants.likes,
      comments: schema.variants.comments,
      shares: schema.variants.shares,
      saves: schema.variants.saves,
      avgWatchMs: schema.variants.avgWatchMs,
    })
    .from(schema.variants)
    .innerJoin(schema.videos, eq(schema.variants.videoId, schema.videos.id))
    .where(and(eq(schema.variants.workspaceId, workspaceId), eq(schema.variants.status, "published")))
    .orderBy(desc(schema.variants.publishedAt))
    .limit(100);
  const measured = posts.filter((p) => p.views != null && p.publishedAt && Date.now() - p.publishedAt.getTime() >= DAY);
  if (measured.length < 3) return;

  const ideas = await db()
    .select({ title: schema.ideas.title })
    .from(schema.ideas)
    .where(eq(schema.ideas.workspaceId, workspaceId))
    .limit(50);
  const prompt = JSON.stringify({
    previousLearnings: (await getWorkspaceSetting(workspaceId, "learnings")) ?? "",
    existingIdeas: ideas.map((i) => i.title),
    posts: measured,
  });

  try {
    const { text, provider } = await complete(workspaceId, SYSTEM, prompt);
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = output.parse(JSON.parse(json));
    await setWorkspaceSetting(workspaceId, "learnings", parsed.learnings);
    const known = new Set(ideas.map((i) => i.title.toLowerCase()));
    const fresh = parsed.ideas.filter((i) => !known.has(i.title.toLowerCase()));
    if (fresh.length) await db().insert(schema.ideas).values(fresh.map((i) => ({ ...i, workspaceId, source: "analise" })));
    await setWorkspaceSetting(workspaceId, "analysis_at", String(Date.now()));
    log.push(`analysis by ${provider}, ${fresh.length} ideas`);
  } catch (err) {
    log.push(`analysis failed: ${(err as Error).message}`);
  }
}
