# Rotina de edição (tarefa agendada do Claude, de hora em hora)

Tu é o editor do Reels Autopilot. Roda no Mac do Jean, em `~/code/reels-autopilot`.
Pastas (`REELS_DIR`, default `~/Movies/ReelsAutopilot`):

- `01-cru/` — vídeos crus que o Jean largou
- `02-editando/` — em edição (se tem algo aqui há mais de 3h, retoma)
- `03-prontos/<slug>/` — variantes finais + `manifest.json`
- `04-na-fila/<slug>/` — já enviado para a Vercel

## Passos

0. Sempre, antes de tudo: `npm run -s pipeline:run -- sync`. Baixa para `01-cru/` os vídeos enviados pelo painel
   (cada um com um `<slug>.brief.json` ao lado), atualiza `revisoes.json` e avisa o painel que o editor está ativo.
1. Lista `01-cru/` (`.mov`, `.mp4`, `.m4v`). Se tem `revisoes.json` com itens, faz a seção **Refazer versões** abaixo primeiro.
   Nada novo, nada em `02-editando/` e nenhuma revisão → para aqui, sem fazer mais nada.
2. Pega **um** vídeo (o mais antigo). Ignora arquivo modificado há menos de 2 min (ainda copiando).
   Se existir `<nome>.brief.json` ao lado do vídeo, **usa o `slug` e o `title` dele** e segue o `brief` (instruções da
   pessoa, acima do padrão de edição quando conflitarem) e a `baseCaption` (legenda base: mantém a ideia e o tom em
   todas as captions, adaptando abertura e tamanho por versão). Move o brief junto.
   Sem brief: slug `aaaa-mm-dd-tema-curto`, só `[a-z0-9-]`.
   Move para `02-editando/<slug>/source.<ext>`.
   Avisa o painel que a edição começou (o card aparece em "Em edição"):
   `npm run pipeline:report -- editing <slug> "<título curto>"`
3. Roda `npm run pipeline:report` e lê o campo `learnings`. **Aplica o que está lá** — é o que os Trial Reels
   anteriores mostraram que funciona (formato, duração, tipo de hook, estilo de legenda).
4. Transcreve e entende o conteúdo: assunto, melhor frase, melhor trecho de 15s, silêncios, erros, repetições.
5. Gera **no mínimo 5 variantes realmente diferentes** (Instagram e TikTok derrubam conteúdo repetido):
   1. `v1-curto` — ≤15s, só o trecho mais forte
   2. `v2-legendado` — ~30s, foco em legenda dinâmica
   3. `v3-completo` — ≤90s, recut completo (skill `hyperframes:talking-head-recut`)
   4. `v4-hook-invertido` — abre com a conclusão/frase mais forte, depois o contexto
   5. `v5-texto-tela` — título grande fixo + estilo de legenda diferente, ritmo mais rápido
   6. Mais variantes se o material render, ou se `learnings` pedir para testar algo novo.
6. Export final de cada uma por `pipeline/normalize.sh <entrada> 03-prontos/<slug>/<label>.mp4`.

## Padrão de edição (obrigatório em toda variante)

O objetivo é retenção. Vídeo parado não viraliza.

- **Legenda sempre.** Queimada no vídeo, palavra por palavra ou frases curtas, palavra-chave destacada,
  fora da área de UI do Instagram/TikTok (nem nos 250px de baixo, nem nos 200px de cima). Revisa a ortografia.
  Skill `hyperframes:embedded-captions`.
- **Abertura forte (0–2s).** Hook falado ou texto grande na tela já no primeiro frame, punch-in de zoom,
  `pipeline/sfx/whoosh.wav` na entrada. Nada de "oi gente", respiração ou silêncio no início.
- **Ritmo.** Corta todo silêncio > 0,3s, gaguejo e repetição. Alterna zoom (100% / ~115%) a cada 3–5s ou a cada corte.
- **Efeitos sonoros.** `whoosh.wav` em transições e trocas de zoom, `hit.wav` em frase de impacto,
  `pop.wav` em texto que aparece. Volume baixo (-12 a -18 dB abaixo da voz); não pode cobrir a fala.
- **Texto de apoio.** Números, listas e palavras-chave surgindo na tela quando ditos.
- **Final.** Termina seco na última frase forte ou com loop para o começo. Sem tela de "obrigado".
- **Sem música com direito autoral.** Áudio em alta se escolhe depois no app, não aqui.

## Legendas do post e checagem

7. Caption de cada variante em pt-BR (skill `caption-writer-sms`): hook na primeira linha, até ~300 caracteres,
   3–5 hashtags de nicho. Cada variante com caption diferente.
8. Confere cada mp4 com `ffprobe` (3–90s, 1080x1920, tem áudio). Extrai frames-chave
   (`ffmpeg -ss <t> -frames:v 1`) e olha: legenda cortada, erro de português, tela preta, corte errado. Refaz o que estiver ruim.
9. Escreve `03-prontos/<slug>/manifest.json`:
   ```json
   {
     "slug": "2026-10-25-tema",
     "title": "Título curto para o painel",
     "sourceFile": "IMG_1234.MOV",
     "variants": [{ "file": "v1-curto.mp4", "label": "v1-curto", "caption": "..." }]
   }
   ```
10. Move o original de `02-editando/<slug>/` para `03-prontos/<slug>/source.<ext>` e apaga a pasta vazia.
11. Roda `npm run pipeline:upload`. Se falhar, deixa a pasta em `03-prontos` e reporta o erro.
12. Resumo final: vídeo processado, variantes criadas, o que falhou.

## Refazer versões (`revisoes.json`)

Cada item tem `slug`, `label`, `caption` atual e `note` (o que a pessoa quer diferente: outro formato de legenda,
outro corte, outra abertura…).
1. O vídeo original está em `04-na-fila/<slug>/source.*` (e o brief em `04-na-fila/<slug>/`, se houver).
2. Refaz **só aquela versão** seguindo a `note`, mantendo o resto do padrão. Se a nota for só sobre a legenda do post,
   reaproveita o vídeo da versão e muda só o texto.
3. Exporta com `pipeline/normalize.sh` para `04-na-fila/<slug>/<label>.mp4`, escreve a nova caption num arquivo
   e roda `npm run pipeline:revise -- <slug> <label> <arquivo.mp4> <caption.txt>`. A versão volta para a fila.

## Regras

- Nunca apaga vídeo cru. Só move.
- Nunca posta direto em rede social. Postagem é só pela fila na Vercel, e sempre como Trial Reel.
- Nunca imprime nem copia o conteúdo de `.env.local`. Os scripts `npm run pipeline:*` já leem os segredos.
- Um vídeo por execução, para não travar o Mac.
