---
name: aden-contrato
description: Contrato de prestação de serviços da Aden (sócios Moni e Áleff), montado e enviado para assinatura eletrônica pela Autentique através do conector do Aden. Use SEMPRE que alguém da Aden disser "manda o contrato pra fulano", "monta o contrato", "gera o contrato", "o contrato do [cliente] foi assinado?", colar os dados de um cliente (nome, CPF/CNPJ, e-mail, endereço) para o contrato, ou pedir a mensagem para pedir esses dados ao cliente.
---

# Contrato da Aden

O contrato é montado pelo Aden com a ficha do cliente e o modelo dos sócios (Configurações → Contrato) e vai pela
Autentique para o e-mail do cliente e de quem assina pela Aden. Você não escreve o contrato.

## Regras que nunca mudam

- **Nunca escreva nem altere cláusula.** Obrigações e disposições gerais são texto dos sócios, guardado no Aden.
  Se pedirem mudança de cláusula, diga que é em Configurações → Contrato (ou grave com `salvar_modelo_contrato`
  só o texto exato que os sócios passarem).
- **Nunca invente dado do contrato**: valor, dia de pagamento, início, prazo mínimo, aviso prévio, rodadas, reuniões,
  garantia. Só o que foi combinado.
- **Confirme antes de enviar**: o cliente recebe o e-mail na hora.

## Passo a passo

1. **Dados do cliente:** `mensagem_pedir_dados_cliente` devolve a mensagem pronta de WhatsApp que pede só nome
   completo (ou razão social), CPF ou CNPJ, e-mail e endereço com CEP. Entregue o texto para a pessoa copiar.
2. **Quando o cliente responder:** grave com `salvar_ficha_cliente`:
   - `razaoSocial` (nome completo ou razão social, como vai no contrato);
   - `documento` (CPF ou CNPJ; o Aden formata com ponto, barra e traço);
   - `email`, `endereco` e `contato` (quem assina pelo cliente).
   Condições combinadas vão no mesmo lugar: `inicioContrato`, `diaPagamento` ou `venceUltimoDiaUtil`,
   `prazoMinimoMeses`, `avisoPrevioDias`, `limiteRodadas`, `limiteReunioesMes`, `garantiaResultado`.
3. **Escopo:** se o cliente ainda não tem escopo, `definir_escopo_cliente` com o `pacote` combinado.
   **Projeto avulso** (logo, identidade visual, pago uma vez): não tem escopo mensal. O contrato de valor único sai
   do projeto fechado em `ganhar_lead` (o que o cliente leu na proposta, extras, valor, prazo em dias úteis, rodadas
   do pacote e as duas parcelas); data de início e dia do pagamento não entram.
4. **Conferir:** `ver_contrato` mostra o contrato inteiro e o que falta ("faltando"). Resuma para a pessoa:
   partes, o que está incluso por mês, valor e vencimento, prazo. No projeto avulso: o que está incluso, o valor
   total e as duas partes, o prazo em dias úteis (começa com o pagamento do início, o briefing e os materiais) e as
   rodadas. Se faltar algo, diga exatamente o quê.
5. **Enviar:** com o ok da pessoa, `enviar_contrato`. Se já houver um contrato esperando assinatura, só reenvie
   (`reenviar: true`) se a pessoa pedir.
6. **Assinatura:** `conferir_contrato` diz quem já assinou. Assinado por todos, o passo "Contrato assinado" do
   fechamento é marcado sozinho.

A pessoa também pode baixar o PDF para ver antes: ficha do cliente → Comercial → Contrato → Baixar PDF.
