# Reels Autopilot: plano multiusuário

_Rascunho de 26 out 2026. Escopo: dados separados por pessoa, Mac pareado com token próprio e a seção "De onde vêm os vídeos" em Ajustes. A edição continua no Mac de cada pessoa. Edição na nuvem, cobrança e Business ficam fora (ver [PLANO-PRODUTO.md](PLANO-PRODUTO.md))._

## O que existe hoje e quebra com uma segunda pessoa

| Ponto | Hoje | Problema |
|---|---|---|
| Dados | `ideas`, `videos`, `variants`, `settings`, `profile_snapshots` sem dono; `connections.ownerId` existe mas fica sempre nulo | todo mundo veria e mexeria em tudo |
| Acesso no painel | middleware deixa entrar só `role = "owner"`; as server actions confiam nisso e recebem só o `id` | com várias pessoas, `setVariantStatus(42)` mexe na versão de outra pessoa (IDOR) |
| Mac → servidor | um `PIPELINE_SECRET` global em 7 rotas: `inbox`, `inbox/claim`, `ingest`, `report`, `revision`, `ideas` e `llm/editor` | qualquer Mac pareado lê e escreve os dados de todos |
| Segredos no Mac | o Mac roda `vercel env pull .env.local` e fica com **todos** os segredos (`DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, chaves); `run.mts` repassa esse ambiente inteiro ao Claude/Codex | inaceitável num Mac que não é teu |
| Upload das versões | `pipeline/upload.mts` usa `BLOB_READ_WRITE_TOKEN` direto | quem tem o token apaga ou sobrescreve o Blob inteiro |
| Postagem | `tick()` pega a primeira conta do Instagram e uma fila global; `POSTS_PER_DAY`, horário e fuso vêm de env | uma fila só, uma conta só |
| Unicidade | `videos.slug` é único no banco todo; `connections(provider, external_id)` é único no banco todo | dois usuários com a chave `anthropic` colidem; dois vídeos com o mesmo slug colidem |

## Decisões (Jean)

1. **`workspace_id` em vez de `owner_id` (recomendo).** Cria `workspaces` + `members` agora, com uma pessoa por workspace. O trabalho é o mesmo de `owner_id`, e o Business (marca + criadores) entra depois sem uma segunda migração em todas as tabelas. Com `owner_id` direto, o Business vai exigir refazer tudo.
2. **Como outras pessoas instalam a parte do Mac no beta.** Recomendo: clonar o repositório + `npm run setup` (que passa a parear em vez de pedir `.env.local`). Um pacote `npx reels-autopilot` ou um app assinado fica para quando o beta crescer.
3. **Quem entra.** Recomendo aprovação manual: a lista de espera aparece numa tela que só o admin (`ADMIN_EMAILS`) vê, com o botão "Liberar". Sem convite automático.
4. **Instagram de terceiros.** Enquanto a Meta não aprovar o App Review, só funciona com quem for adicionado como testador do app. Isso não bloqueia este plano, mas bloqueia o lançamento: o pedido precisa sair já.

## Fase 1: separar os dados por workspace

> **Status (26 out 2026): implementada, ainda não aplicada em produção.** Testada num projeto Neon de teste com cópia dos dados reais: a migração ([0001_workspaces.sql](../drizzle/0001_workspaces.sql), via `scripts/migrate-workspaces.mts`) deixa o banco idêntico ao `schema.ts` novo, e [scripts/isolation-test.mts](../scripts/isolation-test.mts) passa (20 checagens). Diferenças em relação ao texto abaixo:
> - Ritmo, horário e fuso de postagem continuam vindo das env vars, iguais para todos. Só viram coluna em `workspaces` quando alguém precisar de um valor diferente.
> - `profile_snapshots` não ganhou `workspace_id`. O histórico de seguidores sai junto quando a conta do Instagram é desconectada ou a pessoa exclui a conta.
> - O `PIPELINE_SECRET` aponta para o workspace "home" (`settings.pipeline_workspace`), gravado uma vez e nunca movido. Se esse workspace for apagado, o Mac recebe 401, e a próxima pessoa a entrar não herda nada.
> - Chamadas ao Instagram têm timeout de 30 s e as de IA de 100 s. A análise diária só começa se couber na fatia de tempo do workspace no cron.

### Esquema ([schema.ts](../src/db/schema.ts))

- `workspaces(id, name, posts_per_day, timezone, post_from, post_to, graduation, created_at)`: o que hoje vem de `POSTS_PER_DAY`, fuso e horário (as env vars viram o valor padrão).
- `members(workspace_id, user_id, role)` com PK composta. Por enquanto, `role` é sempre `"owner"`.
- `workspace_id integer not null references workspaces on delete cascade` em `ideas`, `videos`, `variants`, `connections` (substitui `owner_id`) e `profile_snapshots`.
  - Em `variants` a coluna é redundante com `videos`, de propósito: o scheduler consulta `variants` direto e assim filtra e indexa sem join. O `ingest` grava a coluna a partir do vídeo, nunca do corpo da requisição.
- Índices únicos novos:
  - `videos(workspace_id, slug)` no lugar de `slug` único.
  - `connections(workspace_id, provider, external_id)` no lugar de `(provider, external_id)`.
  - A regra "um Instagram só pode estar num workspace" fica no código, em `saveIgAccount`, com a mensagem "Essa conta já está conectada em outro painel".
- `workspace_settings(workspace_id, key, value)` para `paused`, `learnings`, `analysis_at`, `demo_dismissed` e `onboarding_hidden`. Continuam em `settings` (global) só `login_failures` e as leases.
- `users.role`: `"owner" | "waitlist"` vira `"member" | "waitlist"`. O admin é quem estiver em `ADMIN_EMAILS` (renomeia `OWNER_EMAILS`).

### Migração (num branch do Neon primeiro)

Gerar o SQL com `drizzle-kit generate` em vez de `push`, porque tem backfill:

1. Criar `workspaces`, `members` e `workspace_settings`.
2. Inserir o workspace 1 para o dono atual e o `members` dele.
3. Adicionar as colunas `workspace_id` como nulas e preencher todas com 1.
4. Copiar as chaves de `settings` que são do workspace para `workspace_settings`.
5. `set not null`, FKs, índices novos e remoção dos índices antigos.
6. Testar o app inteiro no branch e só depois aplicar em produção.

### Acesso no código

- Novo `src/lib/workspace.ts`:
  - `requireWorkspace()`: lê a sessão, confere `users.role = "member"` e a linha em `members`, e devolve `{ userId, workspaceId }`. Usa `cache()` do React, então roda uma vez por requisição.
  - `deviceFromRequest(req)`: o equivalente para o Mac (Fase 2).
- **Todas** as consultas nos 19 arquivos com `db()` (73 chamadas) passam a filtrar por `workspaceId`. Isso inclui páginas (`page.tsx`, `conteudo/[id]`, `novo`, `perfil`, `ajustes`), [actions.ts](../src/app/actions.ts) e `lib/` (`scheduler`, `analysis`, `profile`, `llm`, `instagram-account`, `status`).
- Server actions que recebem `id` fazem `where(and(eq(x.id, id), eq(x.workspaceId, ws)))` e não fazem nada se nenhuma linha bater. `conteudo/[id]` de outro workspace dá 404.
- Os getters de `lib/` recebem `workspaceId` como primeiro argumento, assim nenhum lugar esquece o filtro sem quebrar o `tsc`. Ex.: `getSetting(ws, key)`, `listInstagramAccounts(ws)`, `complete(ws, …)`.
- Login com Google: quem é aprovado ganha um workspace no primeiro login. A senha `DASHBOARD_PASSWORD` (sessão `uid: 0`) sai, porque não tem dono.
- Blob: os uploads do painel passam a usar `uploads/{workspaceId}/…` (o `onBeforeGenerateToken` checa o prefixo).

### Postagem por workspace ([scheduler.ts](../src/lib/scheduler.ts))

- `tick()` percorre os workspaces não pausados e com Instagram conectado, começando pelo que está há mais tempo sem tick, para ninguém ficar sem vez. Cada um ganha a própria lease (`tick_lock:{id}`) e a própria fila, ritmo e horário.
- O prazo de 240 s continua global. O que não couber roda no próximo tick, de hora em hora.
- Acima de ~30 workspaces, o cron passa a disparar um tick por workspace (`/api/cron/tick?w=…`). Não precisa agora.

### Excluir conta (membro)

Apaga o workspace (o cascade leva todo o resto), apaga os arquivos em `uploads/{id}/` e `reels/{id}/` no Blob e revoga os Macs. Substitui o `deleteMyData` que hoje só funciona na lista de espera.

### Teste de isolamento

Criar `scripts/isolation-test.mts`, rodando contra um branch do Neon:

1. Cria os workspaces A e B com dados.
2. Usando a sessão e o token de Mac de B, chama cada server action e cada rota com IDs de A.
3. Espera nenhuma linha alterada e nenhum dado de A na resposta.

Só abrir para outra pessoa com esse teste passando.

## Fase 2: Mac pareado com token próprio

### Fluxo (no estilo device code, RFC 8628)

1. Em Ajustes, "Conectar um Mac" abre `reelsautopilot://pair`. O link não carrega nenhum segredo.
   - Sem o helper, a pessoa roda `npm run setup`, que faz o mesmo.
2. O Mac chama `POST /api/devices/start` com o nome do Mac e recebe:
   - `device_code`: segredo, só o Mac conhece; o banco guarda só o hash.
   - `user_code`: ex. `KXRT-4M9P`, sem caracteres ambíguos.
   - Validade de 10 min.
3. O Mac abre o navegador em `/ajustes/parear?codigo=KXRT-4M9P`.
4. Já logada, a pessoa vê "Conectar o MacBook do Jean a este painel?" e clica em **Autorizar**. A server action liga o pareamento ao workspace dela.
5. O Mac consulta `POST /api/devices/token` a cada 3 s. Depois de autorizado, recebe **uma única vez** o token `ra_dev_…` (32 bytes aleatórios). O banco guarda só o `sha256`.
6. O token vai para o **Keychain** do macOS (`security add-generic-password -s "Reels Autopilot"`). O `APP_URL` vai para `~/Library/Application Support/Reels Autopilot/config.json`. No Mac de quem não é o Jean não existe `.env.local`.

### Tabelas

- `devices(id, workspace_id, name, token_hash unique, last_seen_at, revoked_at, meta jsonb, created_at)`. O `meta` guarda o que hoje vai em `settings.runner`: IA conectada, pasta e versão.
- `device_pairings(id, device_code_hash, user_code unique, workspace_id null, device_name, status, expires_at)`. Uso único; o código expira e se apaga.

### Rotas do Mac

- As 7 rotas trocam `hasBearer(req, PIPELINE_SECRET)` por `deviceFromRequest(req)`. Ela devolve `{ deviceId, workspaceId }` ou 401 para token revogado, e atualiza `last_seen_at`.
- `report` (heartbeat) passa a gravar em `devices.meta` em vez de `settings.runner`.
- `llm/editor` devolve só a chave do próprio workspace.
- `POST /api/devices/blob-token` (nova): gera um token de cliente do Blob preso ao prefixo `reels/{workspaceId}/{slug}/`, só `video/mp4`, com tamanho máximo e validade curta. O `upload.mts` usa esse token no lugar do `BLOB_READ_WRITE_TOKEN`.
- O `ingest` passa a exigir que cada `blobUrl` comece com `reels/{workspaceId}/`.
- Rate limit em `devices/start` e `devices/token` (por IP, em `settings` como o `login_failures`).

### Transição do Mac do Jean

O `PIPELINE_SECRET` continua aceito, mapeado ao workspace 1, até o Mac do Jean ser pareado. Depois sai do código e da Vercel.

### Pipeline ([pipeline/](../pipeline))

- `run.mts`, `upload.mts`, `report.mts` e `revise.mts` leem o `APP_URL` e o token do config e do Keychain, nessa ordem, com `.env.local` só como reserva para o Jean.
- `run.mts` monta o `childEnv` com uma lista do que é permitido (PATH, HOME, pasta, chave do editor), nunca com `...process.env`.
- Novo `pipeline:pair`. O helper ([install-helper.mts](../scripts/install-helper.mts)) ganha `reelsautopilot://pair`, que roda só esse comando fixo.
- O [setup-mac.mts](../scripts/setup-mac.mts) troca "Falta .env.local" pelo pareamento.

## Fase 3: Ajustes, "De onde vêm os vídeos"

É a primeira seção, antes de Instagram e IA, seguindo a ordem do fluxo: entrada → edição → publicação.

```
De onde vêm os vídeos
Envie pelo painel ou largue na pasta do Mac. Quem edita é a IA no teu Mac.

Pelo painel                                     [Novo vídeo]
Sempre ligado. Funciona no celular.

MacBook do Jean          visto há 4 min · Claude    [Desconectar]
Pasta: ~/Movies/ReelsAutopilot/01-cru

[Conectar um Mac]
Ainda não instalou? Rode npm run setup no Terminal.
```

- **Sem Mac pareado:** o card do painel avisa "Os vídeos enviados esperam até um Mac estar conectado". Esse é o aviso que importa, porque sem Mac nada é editado.
- **Mac sem sinal há mais de 2 dias** (mesmo critério de [status.ts](../src/lib/status.ts)): o status fica "sem sinal desde …" em vez de "visto há".
- **Desconectar** marca `revoked_at`, e o próximo pedido daquele Mac recebe 401.
- **Seção IA:** "Conectar meu Claude/ChatGPT" continua igual, mas o status passa a vir do Mac pareado mais recente.
- **"Comece por aqui":** o passo da IA vira "Conectar teu Mac".
- **i18n:** textos novos em pt/en/es em [dictionaries.ts](../src/i18n/dictionaries.ts).
- **Fora desta seção, de propósito:** Google Drive, Dropbox e o placeholder "em breve". Só entram quando existirem.

## Ordem e tamanho

1. **Fase 1** (grande): esquema, migração, `requireWorkspace` e filtro em todas as consultas, scheduler por workspace, exclusão de conta, teste de isolamento.
2. **Fase 2** (média): pareamento, tokens, Keychain, token do Blob, pipeline sem `.env.local`.
3. **Fase 3** (pequena): seção em Ajustes, onboarding, i18n.
4. **Liberar acesso:** tela de aprovação da lista de espera (admin) e a primeira pessoa de fora, como testadora do app da Meta.

Cada fase entra em produção sozinha, com o Jean ainda como único usuário. A Fase 1 não muda nada visível para ele. A Fase 2 troca o segredo do Mac dele.

## Riscos

- **Esquecer um filtro.** Os getters exigem `workspaceId` na assinatura, e o teste de isolamento passa por todas as rotas e actions.
- **URLs do Blob são públicas** (difíceis de adivinhar, mas sem login). Isso é aceitável para Trial Reels, que vão ser públicos de qualquer jeito. Os vídeos crus também ficam públicos até a edição; para fechar isso, apagar o cru do Blob depois do `claim`.
- **Sessão de 30 dias com papel antigo:** quem for liberado precisa entrar de novo. Como o `requireWorkspace` confere no banco a cada requisição, quem perder o acesso sai na hora.
