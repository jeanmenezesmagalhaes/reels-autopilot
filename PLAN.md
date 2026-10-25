# Reels Autopilot — Plano

Objetivo: Jean grava vídeo cru, larga numa pasta do Mac. Claude edita, gera 5+ versões, e o sistema posta cada versão no Instagram como **Trial Reel** (só para não-seguidores), espaçado no tempo.

## Viabilidade

Dá para fazer. Pontos que validam:

- **Trial Reels via API existe.** Content Publishing API do Instagram aceita `trial_params` no endpoint de criação de mídia (`media_type=REELS`). `graduation_strategy`: `MANUAL` (fica em trial até tu graduar no app) ou `SS_PERFORMANCE` (Instagram gradua sozinho se performar). Default aqui: `MANUAL`, porque o pedido é nunca abrir para seguidores automaticamente.
- **Graduar via API não existe.** Só no app do Instagram.
- **Elegibilidade:** conta Profissional (Creator ou Business). Instagram não publica limite oficial de seguidores para Trial Reels; relatos falam em ~200+. Se a conta não tiver acesso, a API rejeita e o post fica `failed` no painel.
- **Edição não roda na Vercel.** Função serverless tem limite de tempo/CPU e não tem a skill de edição. Edição roda no Mac (Claude Code + ffmpeg + skill). Vercel fica com front, API, banco, storage e agendamento — conforme pedido.

## Arquitetura

```
MacBook                                            Vercel (sem domínio próprio, *.vercel.app)
~/Movies/ReelsAutopilot/
  01-cru/        <- tu larga vídeo aqui
  02-editando/   <- Claude move para cá enquanto edita
  03-prontos/<slug>/v1..vN.mp4 + manifest.json
  04-na-fila/    <- depois do upload
        |
        |  tarefa agendada do Claude (app desktop, ex. a cada 1h)
        |  1. pega vídeo novo em 01-cru
        |  2. edita com skill de vídeo + ffmpeg -> 5+ variantes 1080x1920
        |  3. escreve legenda/hook de cada variante
        |  4. npm run pipeline:upload  ------------------>  Vercel Blob (mp4 público, URL não adivinhável)
        |                                   POST /api/ingest  -> Postgres (Neon via Vercel Marketplace)
                                                            |
                                     Vercel Cron -> /api/cron/tick
                                       - respeita "posts por dia" e pausa
                                       - escolhe próxima variante (round-robin entre vídeos)
                                       - cria container REELS + trial_params
                                       - espera FINISHED, publica
                                       - renova token IG (60 dias) quando perto de expirar
                                                            |
                                                      Instagram (Trial Reel)

                                     Painel / (senha) -> fila, status, link do post, pausar
```

## Versões por vídeo (mínimo 5)

Cada versão precisa ser diferente de verdade — Instagram derruba alcance de conteúdo repetido.

1. **Corte curto (≤15s)** — só o melhor trecho, hook nos 2 primeiros segundos.
2. **Médio (~30s)** — legenda dinâmica (embedded captions), cortes de silêncio.
3. **Completo (≤60–90s)** — recut "talking head" com jump cuts e zoom punch-in.
4. **Hook invertido** — abre com a conclusão/frase mais forte, depois contexto.
5. **Texto na tela** — título grande fixo + legenda estilo diferente, ritmo mais rápido.
6+. Variações extras quando o material render (outra trilha, outro trecho, outro hook).

Cada variante leva legenda própria (caption) e label para comparar performance depois.

## Stack

- Next.js 15 (App Router) na Vercel — painel + API routes
- Postgres Neon (integração Vercel Marketplace, plano free) + Drizzle ORM
- Vercel Blob para os mp4
- Vercel Cron chamando `/api/cron/tick`
- Instagram API com Instagram Login (`graph.instagram.com`), sem precisar de Página do Facebook
- Local: Node + ffmpeg + Claude Code (tarefa agendada no app desktop)

### Limite do plano Hobby da Vercel

Cron no Hobby roda no máximo 1x por dia. Opções:
- Hobby: 1 post/dia (ok para começar).
- Pro: cron de hora em hora, `POSTS_PER_DAY` controla o ritmo.
- Alternativa grátis: GitHub Actions agendado batendo no `/api/cron/tick` com o `CRON_SECRET`.

## O que precisa do Jean (não dá para Claude fazer sozinho)

1. **Vercel:** `npx vercel login` (ou importar o repo em vercel.com/new). Criar Postgres (Neon) e Blob store no projeto — Storage > Create.
2. **Meta / Instagram:**
   - Conta Instagram como Profissional (Creator/Business).
   - Criar app em developers.facebook.com > produto "Instagram" > "API setup with Instagram login".
   - Gerar token com `instagram_business_basic` + `instagram_business_content_publish`.
   - Colocar `IG_USER_ID` e `IG_ACCESS_TOKEN` nas env vars da Vercel (tu mesmo cola — Claude não manuseia credenciais).
3. **Skill de edição:** confirmar qual. Já instalado: `hyperframes` (`talking-head-recut`, `embedded-captions`) — serve para isso.
4. **Mac ligado:** a tarefa agendada de edição só roda com o Mac acordado e o app Claude aberto. Postagem roda na Vercel, independente do Mac.

## Fases

- **F0 (feito):** pastas, repo privado, plano.
- **F1:** scaffold app — schema, ingest, cron tick, cliente IG, painel, script de upload, prompt de edição.
- **F2:** deploy Vercel + banco + blob + env vars (precisa F2 do Jean acima).
- **F3:** teste ponta a ponta com 1 vídeo: edição -> 5 variantes -> 1 Trial Reel publicado.
- **F4:** liga tarefa agendada do Claude (edição automática) + ritmo de postagem.
- **F5:** métricas — puxar insights de cada Trial Reel (plays, alcance) para o painel e decidir qual versão graduar.

## Env vars

| Var | Onde | Para quê |
|---|---|---|
| `DATABASE_URL` | Vercel (auto pelo Neon) + `.env.local` | Postgres |
| `BLOB_READ_WRITE_TOKEN` | Vercel (auto pelo Blob) + `.env.local` | upload do Mac |
| `IG_USER_ID` | Vercel | conta Instagram |
| `IG_ACCESS_TOKEN` | Vercel | token inicial (depois renovado no banco) |
| `IG_GRADUATION_STRATEGY` | Vercel | `MANUAL` (default) ou `SS_PERFORMANCE` |
| `POSTS_PER_DAY` | Vercel | ritmo (default 2) |
| `CRON_SECRET` | Vercel | protege `/api/cron/tick` |
| `PIPELINE_SECRET` | Vercel + `.env.local` | protege `/api/ingest` |
| `DASHBOARD_PASSWORD` | Vercel | senha do painel |
| `APP_URL` | `.env.local` | URL *.vercel.app para o script de upload |
| `REELS_DIR` | `.env.local` | default `~/Movies/ReelsAutopilot` |
