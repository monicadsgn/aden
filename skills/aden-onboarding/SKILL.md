---
name: aden-onboarding
description: Onboarding do cliente da Aden (sócios Moni e Áleff), o PDF que o cliente recebe quando fecha, com boas-vindas, o que está incluso, como funciona cada serviço, prazos, próximos passos e contato. Use SEMPRE que alguém da Aden disser "manda o onboarding", "gera o onboarding do [cliente]", "o onboarding está pronto?", ou pedir para mudar contato, horário de atendimento ou o texto de um serviço no onboarding.
---

# Onboarding da Aden

O onboarding é montado pelo Aden: o texto é dos sócios (Configurações → Onboarding) e o Aden junta com o pacote,
os serviços contratados, a garantia e o contrato do cliente. O PDF sai no site, com a identidade da Aden.

## Regras que nunca mudam

- **Nunca escreva nem reescreva o texto do onboarding.** Se pedirem mudança, grave só o texto exato que os sócios
  passarem: contato, atendimento, frase da garantia e o "como funciona" de cada serviço com
  `salvar_modelo_onboarding`; títulos e textos das seções são editados no site (Configurações → Onboarding).
- Nada interno no onboarding: ele só mostra o que o cliente pode ver.

## Passo a passo

1. `ver_onboarding` com o cliente mostra as seções montadas e o que falta ("faltando").
2. Faltou algo da ficha (escopo, contrato), diga onde preencher. Faltou texto do modelo, diga que é em
   Configurações → Onboarding.
3. Pronto: o PDF sai no site em ficha do cliente → Comercial → Fechamento → **Gerar onboarding**. Você não gera o PDF.
4. Deixe uma mensagem curta de WhatsApp para acompanhar o PDF, no tom da Aden, chamando o cliente pelo primeiro nome.
5. Quando a pessoa confirmar que mandou: `marcar_passo_fechamento` (passo `onboarding`). O próximo passo é o
   contrato (skill **aden-contrato**).
