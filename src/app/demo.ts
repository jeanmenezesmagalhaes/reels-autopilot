// Example content for the first visit: a few cards in every column and some
// results, so a new creator sees how it works. Rendered only; never stored, never posted.
import type { Idea, Variant, Video } from "@/db/schema";
import type { Locale } from "@/i18n/dictionaries";

const H = 3_600_000;
const D = 24 * H;

const copy = {
  pt: {
    ideas: [
      ["3 erros que eu cometi no meu primeiro negócio", "Abre direto no erro mais caro"],
      ["Um dia comigo em 60 segundos", "Mostra a rotina em cortes rápidos"],
    ],
    videos: ["Como eu organizo minha semana", "O conselho que mudou minha carreira", "Bastidores do meu trabalho"],
    learnings: `_Exemplo de análise_

## O que está funcionando
- Abrir com a conclusão: 2× mais views que começar com contexto
- Vídeos de até 30s foram assistidos até o fim

## Próxima gravação (roteiro)
- Comece pela frase mais forte, depois explique

## Melhor horário
- Entre 19h e 21h`,
  },
  en: {
    ideas: [
      ["3 mistakes I made in my first business", "Open straight on the most expensive one"],
      ["A day with me in 60 seconds", "Show the routine in quick cuts"],
    ],
    videos: ["How I plan my week", "The advice that changed my career", "Behind the scenes of my work"],
    learnings: `_Example analysis_

## What's working
- Opening with the conclusion: 2× the views of starting with context
- Videos up to 30s were watched to the end

## Next recording (script)
- Lead with your strongest line, then explain

## Best time
- Between 7pm and 9pm`,
  },
  es: {
    ideas: [
      ["3 errores que cometí en mi primer negocio", "Abre directo con el error más caro"],
      ["Un día conmigo en 60 segundos", "Muestra la rutina en cortes rápidos"],
    ],
    videos: ["Cómo organizo mi semana", "El consejo que cambió mi carrera", "Detrás de escena de mi trabajo"],
    learnings: `_Ejemplo de análisis_

## Qué está funcionando
- Abrir con la conclusión: 2× más vistas que empezar con contexto
- Los videos de hasta 30s se vieron hasta el final

## Próxima grabación (guion)
- Empieza por tu frase más fuerte y luego explica

## Mejor horario
- Entre las 19h y las 21h`,
  },
};

const base = { caption: "", containerId: null, mediaId: null, permalink: null, error: null, attempts: 0, reach: null, likes: null, comments: null, metricsAt: null };

export function demoContent(locale: Locale, now = Date.now()) {
  const c = copy[locale];
  const ideas: Idea[] = c.ideas.map(([title, notes], i) => ({
    id: -(i + 1), title, notes, source: i === 0 ? "analise" : "jean", status: "planned", createdAt: new Date(now - i * H),
  }));
  const videos: Video[] = c.videos.map((title, i) => ({
    id: -(i + 1), slug: `exemplo-${i + 1}`, title, sourceFile: null, createdAt: new Date(now - (i === 2 ? 1 : 3 - i) * D),
  }));
  const v = (id: number, videoId: number, label: string, extra: Partial<Variant>): Variant => ({
    ...base, id: -id, videoId: -videoId, label, blobUrl: "", durationS: 30, status: "queued", createdAt: new Date(now - 2 * D), publishedAt: null,
    views: null, shares: null, saves: null, avgWatchMs: null, ...extra,
  });
  const published = (views: number, watchedPct: number, shares: number, saves: number, daysAgo: number) => ({
    status: "published" as const, views, shares, saves, avgWatchMs: watchedPct * 300, publishedAt: new Date(now - daysAgo * D),
  });
  const variants: Variant[] = [
    v(1, 1, "v1-curto", published(4812, 71, 38, 22, 2)),
    v(2, 1, "v2-legendado", published(2310, 58, 9, 6, 2.5)),
    v(3, 1, "v3-completo", published(1204, 34, 3, 2, 3)),
    v(4, 1, "v4-hook-invertido", published(9204, 64, 112, 47, 1.5)),
    v(5, 1, "v5-texto-tela", { status: "skipped" }),
    v(6, 2, "v1-curto", published(3120, 66, 21, 14, 1.2)),
    v(7, 2, "v2-legendado", {}),
    v(8, 2, "v3-completo", {}),
  ];
  return { ideas, videos, variants, learnings: c.learnings };
}
