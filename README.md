# Reels Autopilot

Vídeo cru no Mac → Claude edita 5+ versões → fila na Vercel → posta como **Trial Reel** no Instagram em horários diferentes → mede → aprende → edita melhor.

Plano e arquitetura: [PLAN.md](PLAN.md). Produto: [PRODUCT.md](PRODUCT.md).

## Uso no dia a dia

1. Larga o vídeo cru em `~/Movies/ReelsAutopilot/01-cru`.
2. Pronto. A cada hora o Claude edita (tarefa "Reels Autopilot: editar vídeos novos") e manda para a fila.
3. A fila posta só como **Trial Reel**, entre 08h e 22h, `POSTS_PER_DAY` por dia, alternando vídeos.
4. Todo dia 05:30 o Claude analisa os resultados, escreve "O que fazer a seguir" e sugere pautas.
5. Painel: https://reels-autopilot-bay.vercel.app → **Continuar com Google**. A primeira conta que entra vira a dona do painel
   (ou quem estiver em `OWNER_EMAILS`); qualquer outra conta cai na lista de espera e pode excluir os próprios dados.
   Sessão dura 30 dias; "Sair" fica no menu de idioma/tema. Enquanto o Google não estiver configurado, a tela pede a senha `DASHBOARD_PASSWORD`.
   - **Quadro:** Planejado → Em edição → Na fila → Publicado. Tu só adiciona pauta e marca quando gravou.
   - **Resultados:** o que funcionou e o que não funcionou em 7, 30, 365 dias ou tudo.
   - Idioma (pt/en/es, pelo navegador) e tema (sistema/claro/escuro) no canto de cima.

### Ajustes (no painel)

Tudo que a pessoa conecta fica em **Ajustes**, com status de cada conexão:
- **Instagram:** uma ou várias contas; escolhe em qual publicar; reconectar/desconectar.
- **IA:** "Entrar com OpenRouter" (um login, várias IAs) ou colar chave de API do Claude, ChatGPT ou Gemini.
  A chave é testada na hora e guardada criptografada. Ordem de uso com reserva automática.
  Com uma IA conectada aqui, a análise diária roda no servidor.
- **Edição no computador:** mostra se o editor do Mac está ligado e com qual IA.
- **Conta:** idioma, tema, sair.

No primeiro acesso aparecem **exemplos** (só visuais, nunca publicados) e o **Comece por aqui** com 4 passos.

### Conectar a tua IA (Claude ou ChatGPT)

A edição usa a **tua** conta e os **teus** limites, no teu Mac, com o login oficial de cada ferramenta:

```bash
npm run setup
```

O instalador abre o login do Claude no navegador (e, se quiser, o do ChatGPT como reserva), cria as pastas
e agenda a edição de hora em hora e a análise às 05:30. O painel mostra "Editor: Claude · há X min".
Se a pasta `01-cru` estiver vazia, nenhuma IA é chamada: não gasta teus limites.

### Sem o app do Claude aberto (opcional)

`npm run pipeline:run -- edit` (ou `analyze`) roda a rotina pelo Claude Code; se o Claude bater limite
ou não estiver logado, passa sozinho para o Codex (ChatGPT). Cada um usa o próprio login oficial
(`claude` e `codex login`, abrem o navegador). Para agendar sem o app, use `launchd`/`cron` chamando esse comando.

## Checklist para ligar (uma vez)

Rodar no terminal, dentro de `~/code/reels-autopilot`. Cada comando pede o valor sem mostrar na tela.

1. **Token do Instagram** (app da Meta → Instagram → API setup with Instagram login → gerar token).
   Permissões: `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`.
   ```bash
   npx vercel env add IG_USER_ID production
   ```
   ```bash
   npx vercel env add IG_ACCESS_TOKEN production --sensitive
   ```
2. **Cron de hora em hora (GitHub Actions)** — copia o `CRON_SECRET` da Vercel para o GitHub:
   ```bash
   grep '^CRON_SECRET=' .env.local | cut -d= -f2- | tr -d '"' | gh secret set CRON_SECRET
   ```
   ```bash
   gh variable set APP_URL --body "https://reels-autopilot-bay.vercel.app"
   ```
3. **Redeploy** para pegar as env vars novas:
   ```bash
   npx vercel deploy --prod
   ```
4. **Senha do painel** (guarda no teu gerenciador de senhas):
   ```bash
   grep '^DASHBOARD_PASSWORD=' .env.local
   ```
5. No painel: **Retomar postagens** (está pausado) e, para testar, **Postar próximo agora**.

### Ligar o login com Google (uma vez)

1. Google Cloud → criar projeto → **Google Auth Platform**: nome do app, e-mail de suporte, público **Externo**, e **Publicar app**.
2. **Clients → Create client → Web application**. Redirect URIs:
   `https://reels-autopilot-bay.vercel.app/api/auth/callback/google` e `http://localhost:3000/api/auth/callback/google`.
3. **Download JSON** e rodar:
   ```bash
   npm run setup:google
   ```

## Segurança

- Nenhum segredo no código nem no Git. Tudo em env vars da Vercel; local só em `.env.local` (permissão 600, gitignored).
- Login com Google (OAuth com PKCE e state, só e-mail verificado). Sessão em cookie assinado com `SESSION_SECRET` (HttpOnly, Secure, 30 dias); trocar esse segredo derruba todas as sessões. Só a conta dona vê o painel; as outras ficam na lista de espera. `/api/*` usa segredos separados (`CRON_SECRET`, `PIPELINE_SECRET`).
- Token do Instagram vai em header, nunca em URL. Renovado sozinho a cada 7 dias.
- Vídeo fica no Blob só até ser publicado; depois é apagado.
- Headers `noindex`, `no-referrer`, `X-Frame-Options: DENY`.
- Nada escuta porta no Mac: a edição roda como tarefa agendada e só fala com a Vercel por HTTPS.

## Peças

| Onde | O quê |
|---|---|
| `pipeline/EDIT_PROMPT.md` | rotina de edição (legenda, abertura, whoosh, ritmo) |
| `pipeline/ANALYZE_PROMPT.md` | rotina de análise e dicas de roteiro |
| `pipeline/sfx/` | efeitos sonoros (whoosh, hit, pop) |
| `pipeline/normalize.sh` | export final 1080x1920, 30fps, -14 LUFS |
| `pipeline/upload.mts` · `report.mts` | falam com a Vercel sem expor segredo |
| `pipeline/run.mts` | roda as rotinas com Claude, e com ChatGPT se o Claude acabar |
| `src/lib/scheduler.ts` | quando e o que postar, métricas, renovação de token |
| `src/app/api/*` | `ingest`, `report`, `ideas`, `cron/tick` |
| `src/app/page.tsx` · `board.tsx` · `results.tsx` | painel: Quadro e Resultados |
| `src/i18n/` | textos em pt, en, es |
| `docs/PLANO-PRODUTO.md` | open source, Pro, Business, cobrança, MCP |
| `.github/workflows/tick.yml` | chama o tick de hora em hora |
