---
name: aden-proposta
description: Proposta comercial da Aden (assessoria de marketing e performance, sócios Moni e Áleff), feita pelo conector do Aden. Use SEMPRE que alguém da Aden pedir proposta, orçamento, "quanto cobro", "monta a proposta pra fulano", "o cliente só tem R$ X", ou colar uma conversa com um interessado em social media, tráfego pago ou criativos da Aden. Cobre: registrar o lead, sondar o que falta, escolher pacote, conferir piso e horas, montar o valor pelo cálculo do Aden e deixar a mensagem de envio pronta.
---

# Proposta da Aden

O preço sai do cálculo do Aden, nunca da sua cabeça. Esta skill conduz a conversa e usa o conector do Aden.

## Regras que nunca mudam

- **Nunca invente número de negócio**: preço, piso, horas por entrega, verba, prazo, modelo de cobrança.
  Pacote não tem preço digitado: o preço vem de `ver_pacotes` ou `calcular_cenario`.
- **Nada interno vai para o cliente**: horas, piso, custo, margem, divisão entre sócios, valor de terceiro.
  O cliente só vê entregas, quantidades e um valor.
- Ferramentas e estrutura já estão embutidas na mensalidade: um valor só, nunca assinatura à parte.
- Verba de anúncio é do cliente, paga direto na plataforma, e nunca entra no faturamento da Aden.
- Audiovisual é extra, só se o cliente pedir.
- Horas saem do **tempo cadastrado** de cada tipo de entrega. O cronômetro é opcional, nunca liga sozinho e o
  sistema não pede medições: só se usa quando ninguém sabe quanto uma entrega leva.
- **Projetos de marca** (logo, identidade visual, branding) levam dias ou semanas e não se medem em minutos: nunca
  proponha nem grave um tempo em minutos para eles; o jeito de medir ou precificar ainda está em decisão. Pergunte.
- Abaixo do piso de um sócio: não esconda. Mostre o que dá para fazer (pacote que cabe) ou diga que vira pedido de
  exceção, que o sócio afetado aprova no site.

## Passo a passo

1. **Lead:** `listar_leads`. Se não existir, `salvar_lead` (nome, contato, telefone, instagram, origem).
   Registre o que foi conversado com `registrar_conversa_lead` e, se houver, a data do próximo contato.
2. **Sondagem:** falta saber o que o cliente quer (social media, tráfego, os dois), o segmento, se o comercial dele
   está estruturado e quanto pode investir? Monte **uma** mensagem curta de WhatsApp pedindo só o que falta.
3. **Pacote:** `ver_pacotes` mostra os pacotes com as frases que o cliente lê e os preços calculados.
   Escolha o que combina com o pedido e explique por quê, em linguagem simples.
4. **Conferir:**
   - Escopo personalizado: `calcular_cenario` (modo escopo dá o valor mínimo; modo valor mostra se fica no piso e
     cabe nas horas).
   - "O cliente só tem R$ X": `montar_pacote_que_cabe` com o valor dito.
   - Cabe mais um cliente no mês? `ver_visao_do_mes`.
5. **Guardar:** `salvar_simulacao` com até 3 cenários (aparecem no site em Calculadora → Abrir simulação salva) e
   `mover_lead` para "proposta_enviada" quando a pessoa confirmar que mandou.
6. **PDF:** a proposta em PDF sai no site (Proposta → Exportar PDF). Você não gera o PDF.
7. **Mensagem de envio:** texto curto de WhatsApp, no tom da Aden, com o que está incluso, o valor mensal e o
   próximo passo. Sem horas nem termos internos.

## Quando o cliente responder

- "Vou pensar": `registrar_conversa_lead` com o follow-up e a data.
- Fechou: siga a skill **aden-fechamento**.
- Perdido: `mover_lead` para "perdido" com o motivo numa conversa registrada.
