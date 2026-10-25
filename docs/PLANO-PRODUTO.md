# Reels Autopilot: plano de produto

_Rascunho de 25 out 2026. O que está marcado **Decisão do Jean** precisa de resposta antes de construir._

Norte do produto: **só o essencial, o máximo automático.** Se uma tela, um botão ou uma configuração não é necessária no dia a dia, ela não existe.

## 1. Três edições

| | Creator (open source) | Pro (hospedado) | Business (empresas) |
|---|---|---|---|
| Para quem | criador individual que instala sozinho | criador individual que não quer instalar nada | empresa com perfil da marca + criadores internos |
| Preço | grátis, com doação opcional | US$ 20/mês por conta, 7 dias grátis | pago, por criador (ver §4) |
| Código | aberto | fechado | fechado, nunca open source |
| Onde roda a edição | no Mac do criador | na nossa nuvem | na nossa nuvem |
| IA | Claude/ChatGPT do próprio criador, com o login oficial | a nossa (Claude, com ChatGPT de reserva), com o nosso ajuste fino | a nossa |
| Hospedagem do painel | Vercel do próprio criador (plano grátis) | nossa | nossa |

O que separa Creator de Pro: o **nosso agente ajustado** (prompts, aprendizados agregados de todas as contas, modelos de edição testados), zero instalação, edição na nuvem e suporte.

O que separa Pro de Business: **vários criadores sob uma marca**, papéis e o Kanban por criador.

### Licença (Decisão do Jean)

O pedido é "aberto para criador individual, pago para empresa". Duas formas:

1. **Open-core (recomendo).** O repositório Creator sai como **AGPL-3.0**. Tudo que é de empresa (vários criadores, perfil da marca, papéis, cobrança) fica num repositório privado com licença comercial. Uma empresa até pode rodar a Creator, mas ela só serve para uma pessoa; para várias, precisa do Business. É OSI open source de verdade, e a AGPL impede alguém de pegar o código e vender como serviço fechado.
2. **Source-available** (PolyForm Small Business ou Fair Source). O código fica visível, de graça para pessoa e empresa pequena, e empresa grande paga. Isso cobre "empresa paga" no próprio texto da licença, mas não é OSI open source, e parte da comunidade torce o nariz.

Nos dois casos, registra a marca "Reels Autopilot" (ou o nome final) para ninguém usar o nome.

### Doações (Creator)

GitHub Sponsors (bom para público americano) + link Buy Me a Coffee. Para o Brasil, um link de Pix via AbacatePay. Arquivo `.github/FUNDING.yml` aponta para eles. **Decisão do Jean:** quais contas abrir.

## 2. IA: Claude primeiro, ChatGPT de reserva

**O que pode e o que não pode (verificado em out 2026):**

- **Claude:** a Anthropic proíbe apps de terceiros oferecerem "login com Claude" e usarem a assinatura Pro/Max da pessoa. Assinatura vale só no Claude Code e no claude.ai. Produto de terceiro precisa de **API key**.
- **ChatGPT:** a OpenAI lançou "Sign in with ChatGPT" para apps de terceiros em set 2026, usando a cota do plano da pessoa, por enquanto com parceiros selecionados.

**Como fica em cada edição:**

- **Creator:** quem roda a IA é o próprio Claude Code / Codex da pessoa, no Mac dela, com o login oficial (abre aba no navegador, loga, pronto). O projeto só entrega as instruções. Isso é uso normal da assinatura dela, não é revenda. Já está pronto: `npm run pipeline:run -- edit` tenta o Claude e, se der limite de uso ou não estiver logado, passa sozinho para o Codex (ChatGPT).
- **Pro e Business:** a IA é nossa, paga por API (Anthropic principal, OpenAI de reserva) com roteamento automático: se um provedor falha ou bate limite, o próximo assume. O custo entra nos US$ 20. Precisa de **limite de uso por conta** (ex.: 30 vídeos/mês) para a conta fechar no azul.
- **Futuro:** quando "Sign in with ChatGPT" abrir para todos, dá para oferecer no Pro como opção "use a tua cota".

## 3. Pro hospedado: o que construir

### Conta e acesso
- **Login sem senha:** link mágico por e-mail (Resend) + "Entrar com Google". Sem senha para guardar ou vazar.
- **Sair** em todos os dispositivos (revoga as sessões).
- **Excluir conta** (obrigatório, e a Meta exige também): apaga dados, vídeos no Blob, revoga o token do Instagram, cancela a assinatura no Stripe. Notas fiscais ficam no Stripe pelo prazo legal. Confirmação por e-mail. Exportar dados antes de excluir (JSON).
- **Idioma e tema:** já prontos no painel (pt/en/es pelo navegador, sistema/claro/escuro), vão para a conta.

### Cobrança: Stripe
Público americano: **Stripe** (cartão, Apple Pay, Google Pay, em USD). AbacatePay só se tiver muito cliente pagando em reais por Pix.
- Stripe Checkout para assinar, Customer Portal para trocar cartão e cancelar (zero tela nossa de cobrança).
- **Trial de 7 dias** no próprio Stripe (`trial_period_days: 7`). **Decisão do Jean:** pedir cartão no início do trial (converte mais, menos gente testa) ou não pedir.
- Webhooks: `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`. Sem assinatura ativa, a postagem pausa e o painel avisa.

### E-mail: Resend
Precisa de um **domínio próprio** verificado para enviar de verdade (o subdomínio da Vercel não serve para e-mail). **Decisão do Jean:** qual domínio.
E-mails, só os essenciais: link de login · boas-vindas · trial acaba em 2 dias · pagamento falhou · resumo semanal dos resultados (o que funcionou) · conta excluída.

### Instagram de outras pessoas
Para postar na conta de clientes, o app da Meta precisa de **App Review** (acesso avançado a `instagram_business_content_publish` e `instagram_business_manage_insights`) e **verificação de empresa**, além de URL de política de privacidade e de exclusão de dados. Leva semanas. **Começar já**, é o maior prazo do projeto.

### Edição na nuvem
A Vercel não edita vídeo (limite de tempo e CPU). Opções: workers com ffmpeg (Fly.io Machines ou Modal), ou agentes gerenciados da Anthropic com sandbox. Pagos por minuto, só quando tem vídeo. Medir o custo por vídeo no beta antes de fixar o limite do plano.

## 4. Business (empresas)

Não é ferramenta de analytics nem social listening. É **gestão de criação de conteúdo**: ajudar a empresa a ter criadores internos que comunicam a marca e o dia a dia.

- **Organização** com o **perfil da marca** (Instagram da empresa) e **criadores** (funcionários, cada um com o próprio Instagram).
- Papéis: dono, gestor (aprova, vê tudo), criador (vê o próprio quadro).
- Kanban por criador e da marca toda: Planejado → Gravado → Em edição → Na fila → Publicado → Resultado.
- Pautas criadas pelo gestor e atribuídas a um criador; a análise sugere pautas por criador.
- **Aprovação opcional** antes de postar (o gestor aprova a versão).
- Guia da marca (tom, palavras proibidas, cores das legendas) aplicado na edição.
- Preço sugerido: US$ 20 por criador/mês, com mínimo de 3 criadores. **Decisão do Jean.**

Modelo de dados: `organizations`, `members(role)`, `social_accounts` (marca e criadores), e `org_id` + `creator_id` em pautas, vídeos e versões. Toda consulta filtra por organização; teste automático de isolamento entre empresas antes de lançar.

## 5. Integrações

Por ordem de valor:

1. **MCP do Reels Autopilot.** Qualquer assistente (Claude, ChatGPT, Cursor) passa a operar o sistema conversando: "o que funcionou essa semana?", "cria pauta X para a Ana", "pausa as postagens". Ferramentas: `ver_quadro`, `criar_pauta`, `resultados(periodo)`, `pausar` / `retomar`, `postar_agora`. Endpoint `/api/mcp` na Vercel, com OAuth no Pro/Business e token no Creator.
2. **TikTok e YouTube Shorts:** as mesmas versões 9:16. O TikTok exige auditoria do app; sem ela, só posta como privado.
3. **Entrada de vídeo:** pasta do Google Drive / Dropbox / iCloud no lugar da pasta do Mac (essencial para o Pro, que não tem Mac).
4. **Avisos:** e-mail primeiro; WhatsApp ou Slack no Business ("versão aguardando aprovação").
5. **Webhooks** de saída (post publicado, resultado medido) para Zapier/Make.

Fora: CRM, analytics de concorrentes, social listening.

## 6. Ordem de construção

1. **Agora:** versão pessoal rodando com o Jean (pronta) e o que ela ensinar.
2. **Creator open source:** limpar o que é do Jean (pastas e fuso viram configuração), instalador de um comando, README em inglês, licença, FUNDING.yml, repo público.
3. **Pedido de App Review na Meta**, em paralelo desde já.
4. **Pro beta:** login, Stripe com trial, Resend, edição na nuvem, IA com roteamento, exclusão de conta. Repositório privado separado.
5. **MCP.**
6. **Business:** organizações, criadores, aprovação.
7. TikTok / Shorts.

## 7. Decisões do Jean

1. Nome e domínio do produto (o domínio é necessário para o Resend).
2. Licença: open-core AGPL (recomendo) ou source-available.
3. Trial com ou sem cartão.
4. Preço do Business.
5. Contas: Stripe (entidade nos EUA? Stripe Atlas se for vender lá), Resend, GitHub Sponsors.
6. Verificação de empresa na Meta: qual CNPJ/empresa.
