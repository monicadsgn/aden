---
name: aden-rotina
description: Rotina de todo chat dos sócios da Aden (Moni e Áleff) com o conector do Aden. Use SEMPRE no começo de qualquer conversa sobre a Aden, a agência, os clientes da Aden, tarefas, decisões ou combinados entre os sócios, e sempre que alguém disser "o que eu tenho pra fazer?", "o que tem pra hoje?", "pede pro Áleff…", "pede pra Moni…", "avisa o Áleff/a Moni que…", "decidimos que…", "combinamos que…", "a partir de agora…" ou "isso já foi feito". Mantém a memória de decisões da Aden em dia e passa tarefas de um sócio para o outro.
---

# Rotina da Aden

Esta skill vale em todo chat dos sócios sobre a Aden. Ela usa o conector do Aden, ligado com o código pessoal de
quem está conversando (Configurações → Equipe → Seu Claude). Tudo o que você faz fica no Histórico como
"Nome (pelo Claude)". O conector nunca aprova pedido.

## 1. No começo de todo chat

1. `quem_sou_eu`: descubra quem está conversando e quem é o outro sócio. Ele traz também a versão das ferramentas
   e o que mudou: se mudou desde a última vez, conte em uma linha e diga como atualizar o conector (vem pronto em
   `comoAtualizar`).
2. `ver_avisos`: conte em uma linha o que chegou de novo para a pessoa (tarefa pedida pelo outro sócio, pedido de
   aprovação). Não aprove nada: aprovação é no site.
3. `ver_contexto_cliente` com cliente **Aden**: leia as decisões, preferências e pendências anotadas.
4. Siga o que está anotado. Se o que a pessoa pedir contrariar uma decisão anotada, avise em uma linha
   ("isso vai contra o que foi anotado em [data]: …") e pergunte antes de seguir.

Não precisa repetir o contexto para a pessoa: só use.

## 2. Anotar na hora

- Quando um sócio **decidir algo novo** sobre a Aden (regra, preço já combinado, processo, prioridade, combinado
  com o outro sócio), grave na hora com `anotar_contexto_cliente`:
  - cliente **Aden**;
  - tipo `decisao` (decisão), `preferencia` (jeito de fazer), `pendencia` (algo que alguém ficou de fazer) ou `nota`;
  - texto curto, completo e com a data de hoje.
- Avise em **uma linha**: "anotei: …".
- Decisão sobre um **cliente** (não sobre a Aden) vai no contexto daquele cliente, não no da Aden.
- Quando algo anotado for **cumprido** ou deixar de valer, `resolver_nota_contexto` com o id da nota e avise em uma
  linha: "resolvido: …". Nota nunca se apaga, só se resolve.
- Não anote conversa solta, dúvida ou ideia que ninguém decidiu.

## 3. Pedir algo para o outro sócio

Não existe bot de WhatsApp: pedido entre os sócios vira tarefa no Aden.

- "Pede pro Áleff fazer X" (ou "pra Moni") → `salvar_tarefa` com:
  - `titulo` curto e claro;
  - `responsavel` = o outro sócio;
  - `cliente` quando for de um cliente (ou **Aden** quando for da própria agência);
  - `vencimento` (AAAA-MM-DD) e `prioridade` só se a pessoa disse;
  - `descricao` com o pedido em uma ou duas frases e quem pediu.
- O Aden grava sozinho quem pediu ("[você] (pelo Claude)") e avisa o outro sócio na Visão do dia dele (Depende de
  mim) e em Pedidos e avisos. Sem prazo, a tarefa aparece em "Sem prazo" na Visão do dia dele, com quem pediu.
- Confirme em uma linha: "tarefa criada para [sócio]: …, até [data]; ele foi avisado".
- Se o pedido também for uma decisão, anote no contexto (item 2).

## 4. "O que eu tenho pra fazer?"

- `ver_visao_do_dia` com o nome de quem está conversando (de `quem_sou_eu`).
- Responda curto e em ordem: atrasadas, hoje, o que vai ao ar hoje, o que depende do cliente, aprovações pendentes,
  o que está sem prazo (diga quem pediu, quando vier `pedidaPor`) e os próximos 7 dias. No fim, a pendência anotada no contexto da Aden que for dessa pessoa, se houver.
- "E o [outro sócio]?" → a mesma coisa com o nome dele. "E todo mundo?" → sem nome.
- Terminou uma tarefa: `mudar_status_tarefa` para `concluida`.

## 5. O que nunca entra no contexto da Aden

- Nada pessoal de um sócio: saúde, família, finanças pessoais, compromissos que não são da Aden.
- Nada de outros negócios de um sócio (trabalhos, clientes ou sistemas que não são da Aden). Se aparecer na
  conversa, não anote, não crie tarefa no Aden e não leve para o contexto de nenhum cliente da Aden.
- Na dúvida se algo é da Aden, pergunte antes de anotar.

## Regras que valem sempre

- Nunca invente número de negócio (preço, piso, prazo, percentual, horas). Só grave o que foi dito.
- Horas saem do **tempo cadastrado** de cada tipo de entrega. O cronômetro é opcional, nunca liga sozinho e o
  sistema não pede medições: só se usa quando ninguém sabe quanto uma entrega leva.
- **Projetos de marca** (logo, identidade visual, branding, estrutura visual) não se medem em minutos: o tipo de
  entrega é um projeto, com horas totais estimadas e prazo em dias (que vai para o contrato). O preço sai do cálculo.
  Se faltar a hora ou o prazo, pergunte aos sócios; nunca invente.
- Mudança em piso, percentual dos sócios, divisão de horas, tempo por entrega ou regra da sociedade que afete o outro
  sócio vira pedido de aprovação: diga isso e que ele aprova no site.
