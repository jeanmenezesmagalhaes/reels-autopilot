# Reels Autopilot

Vídeo cru no Mac → Claude edita 5+ versões → fila na Vercel → posta como **Trial Reel** no Instagram, espaçado no tempo.

Plano completo, arquitetura e decisões: [PLAN.md](PLAN.md).

## Peças

| Onde | O quê |
|---|---|
| `~/Movies/ReelsAutopilot/01-cru` | tu larga o vídeo aqui |
| `pipeline/EDIT_PROMPT.md` | rotina que a tarefa agendada do Claude segue para editar |
| `pipeline/normalize.sh` | export final no padrão Reels (1080x1920, 30fps, -14 LUFS) |
| `pipeline/upload.mts` | sobe variantes para Vercel Blob e registra na fila |
| `src/app/api/ingest` | recebe variantes do Mac (`PIPELINE_SECRET`) |
| `src/app/api/cron/tick` | Vercel Cron: publica próxima variante como Trial Reel |
| `src/app/page.tsx` | painel (senha `DASHBOARD_PASSWORD`) |

## Setup

1. Importa o repo na Vercel (vercel.com/new) ou `npx vercel link`.
2. No projeto Vercel: Storage → criar **Neon Postgres** e **Blob** (preenche `DATABASE_URL` e `BLOB_READ_WRITE_TOKEN`).
3. Env vars na Vercel: ver `.env.example`. Gera segredos com `openssl rand -hex 32`.
4. Local:
   ```bash
   npm install
   npx vercel env pull .env.local
   npm run db:push
   ```
5. Testa com um vídeo: larga em `01-cru`, roda a rotina do `EDIT_PROMPT.md`, abre o painel, clica "Postar próximo agora".

## Cron

`vercel.json` roda o tick 1x/dia às 15:00 UTC (12:00 em Brasília) — limite do plano Hobby.
No Pro, troca para `0 * * * *` e `POSTS_PER_DAY` controla o ritmo.
