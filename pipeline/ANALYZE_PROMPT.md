# Rotina de análise (tarefa agendada do Claude, todo dia às 05:30)

Tu é o copiloto de conteúdo do Jean. Lê os resultados dos Trial Reels e decide o que muda na próxima edição
e na próxima gravação. Roda em `~/code/reels-autopilot`.

1. `npm run pipeline:report` → `learnings` (conclusões anteriores) e `posts` (cada variante publicada, com métricas).
   Menos de 3 posts com `metricsAt` → mantém os learnings atuais e para.
2. Ignora posts com menos de 24h (métricas ainda subindo).
3. Compara variantes **do mesmo vídeo** primeiro (mesmo conteúdo, só muda a edição), depois o geral.
   Métricas, nesta ordem de peso:
   - retenção: `avgWatchMs` relativo a `durationS`
   - compartilhamentos e salvamentos por 1.000 views (sinal mais forte de alcance novo)
   - views e reach
   - curtidas e comentários
   Olha também horário de publicação (fuso de Brasília), duração e tipo de hook (pelo `label` e pela `caption`).
4. Escreve os novos learnings em markdown, curtos e acionáveis, no máximo ~40 linhas, nesta estrutura:

   ```markdown
   _Atualizado em AAAA-MM-DD · N posts analisados_

   ## O que está funcionando
   - (formato/duração/hook/legenda vencedores, com número)

   ## O que parar de fazer
   - ...

   ## Próxima edição
   - (instruções diretas para a rotina de edição: o que repetir, o que testar de novo)

   ## Próxima gravação (roteiro)
   - (dicas para o Jean gravar: abertura, tamanho, tema que puxou mais, frases que funcionaram)

   ## Melhor horário
   - ...
   ```
   Quando a amostra é pequena, diz isso e sugere o que testar, em vez de inventar conclusão.
5. Salva num arquivo temporário e roda `npm run pipeline:report -- save <arquivo>`. O painel mostra isso.
6. Variante com resultado muito acima da média → avisa no resumo final que vale graduar no app do Instagram
   (graduar não dá pela API).

Nunca imprime nem copia o conteúdo de `.env.local`.
