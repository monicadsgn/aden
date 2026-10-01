---
name: aden-fechamento
description: Rotina completa de quando um cliente FECHA com a Aden (assessoria de marketing e performance, sócios Moni e Áleff), feita pelo conector do Aden. Use SEMPRE que alguém disser "[cliente] fechou", "fechamos com [cliente]", "[cliente] aceitou a proposta", "vamos fechar com [cliente]", "bateu o martelo com [cliente]", ou pedir para seguir o fechamento, o checklist, o kickoff ou o próximo passo de um cliente novo da Aden. Conduz os 7 passos do checklist na ordem combinada: onboarding, contrato, cobrança, pasta no Drive, briefing, kickoff e link do painel.
---

# Fechamento de cliente da Aden

O Aden é a fonte de tudo. Esta skill só conduz a conversa e chama as ferramentas do conector do Aden
(o mesmo que a pessoa ligou em Configurações → Equipe → Seu Claude). Tudo o que você faz fica no Histórico
como "Nome (pelo Claude)".

## Regras que nunca mudam

- **Nunca invente número de negócio**: valor, prazo, dia de pagamento, prazo mínimo, aviso prévio, limite de
  reuniões, garantia. Só grave o que a pessoa disse na conversa ou o que já está no Aden. Faltou, pergunte.
- **Nunca escreva cláusula de contrato nem texto de onboarding.** Esses textos são dos sócios e já estão no Aden.
- **Nada interno vai para o cliente**: horas, piso, custo, margem, divisão entre sócios.
- **Confirme antes de qualquer coisa que o cliente recebe** (contrato por e-mail, mensagem pronta).
- O conector nunca aprova pedido. Se algo virar pedido de exceção (abaixo do piso), avise que o sócio afetado
  aprova no site.
- O WhatsApp da Aden continua com o nome Alfall.

## Passo 0: situar

1. `ver_fechamento` com o cliente. Se ele ainda for lead, `listar_leads` e confirme qual é.
2. Lead que fechou agora: confirme valor e pacote com a pessoa, grave no lead com `salvar_lead` (`pacote`,
   `valorEstimadoReais` e, se houver proposta salva, `simulacao`) e só então rode `ganhar_lead`. Isso cria o
   cliente, guarda as entregas do contrato e abre o checklist. Sem pacote, proposta nem valor, o `ganhar_lead` recusa. Se voltar pedido de exceção, explique quem precisa aprovar.
3. Mostre um resumo curto: cliente, valor mensal, pacote e o que está pendente no checklist.

## Os 7 passos, na ordem

### 1. Onboarding
- `ver_onboarding` com o cliente. Se estiver pronto, diga que o PDF sai no site: ficha do cliente → Comercial →
  Fechamento → **Gerar onboarding**. Você não gera o PDF.
- Se faltar algo, diga exatamente o quê (vem de "faltando").
- Quando a pessoa confirmar que mandou: `marcar_passo_fechamento` (passo `onboarding`).

### 2. Contrato
- Siga a skill **aden-contrato**. Resumo: `mensagem_pedir_dados_cliente` para pedir nome completo, CPF ou CNPJ,
  e-mail e endereço; quando o cliente responder, `salvar_ficha_cliente`; `ver_contrato`; confirmar; `enviar_contrato`.
- O passo "Contrato assinado" marca sozinho quando todos assinam (`conferir_contrato` confere na hora).

### 3. Cobrança
- A cobrança recorrente é pelo plano no app da InfinitePay, só para clientes novos. O Aden não cria a cobrança.
- Pergunte se o plano já foi criado no app. Se sim: `marcar_passo_fechamento` (passo `pagamento`, com o link se houver).
- Cada pagamento que cair é lançado com `registrar_pagamento` (valor em reais, só o que entrou de verdade).

### 4. Pasta no Drive
- A pasta do cliente fica na conta **grupoaden1@gmail.com**, dentro de **02 CLIENTES ATIVOS**.
- Se o conector do Google Drive estiver ligado nessa conta, crie a pasta com o nome do cliente; se não, peça para a
  pessoa criar.
- Guarde o link: `marcar_passo_fechamento` (passo `pasta_drive`, `link` https://…). Se a pessoa quiser, guarde também
  como atalho do painel com `atualizar_atalhos_painel` (fotosUrl).

### 5. Briefing
- `ver_briefing` mostra as perguntas que valem para os serviços do cliente e o que já foi respondido.
- O cliente não preenche nada: o Áleff responde na reunião dele e a Moni completa na dela. Grave as respostas com
  `responder_briefing` só com o que foi dito.
- Completo: `marcar_passo_fechamento` (passo `briefing`).

### 6. Kickoff
- Pergunte a data combinada. `marcar_passo_fechamento` (passo `kickoff`, `data` AAAA-MM-DD) cria a tarefa da reunião.

### 7. Painel do cliente
- `link_painel_cliente` cria o link. O passo marca sozinho quando o link existe.
- Mande o link para quem está conversando repassar ao cliente.

## Ao final de cada conversa

- `ver_fechamento` e diga em uma frase o que falta e qual é o próximo passo.
- Decisão ou combinado importante com o cliente: `anotar_contexto_cliente` (tipo decisão, preferência ou pendência).
