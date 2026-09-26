# Roadmap do Aden

Plano guardado. **Nada daqui é para construir sem a Moni pedir.** Atualizado em 26/09/2026.

## 1. Próximo: depois da reunião de terça (29/09/2026), nesta ordem

Itens da auditoria de usabilidade aprovados pela Moni (os graves 1–4 e os detalhes 16 e 19 já foram feitos):

1. **Grave 5:** dados do cliente num lugar só. Tirar a aba Clientes das Configurações; a ficha do cliente é o único lugar.
   "Personalizar escopo" na ficha abre a Proposta e volta para a ficha.
2. **Grave 6:** aba Cada cliente da tela Mês com uma linha por cliente (pagou, horas, valor por hora, sinal), abrindo o
   detalhe ao clicar. As horas vêm das tarefas; o campo manual vira "corrigir".
3. **Grave 7:** calculadora mostra só Como calcular, Rotina, Custos e Entrada; Tráfego, Projetos pontuais, Percentuais e
   Meses sem cobrança ficam atrás de "Mais opções" (abrem sozinhos quando têm dado).
4. **Médios 8–14:**
   - 8: aviso repetido de ordem de distribuição vira uma faixa amarela só.
   - 9: "Mês passado em aberto" ganha explicação e botão.
   - 10: links passam o cliente e o lead junto.
   - 11: topo da Visão do dia no celular.
   - 12: abas das Configurações em dois grupos.
   - 13: contador vê Pagamentos só leitura.
   - 14: nomes que ainda divergem.
5. **Detalhes 15, 17 e 18:** texto mínimo de 12 px em frase explicativa; ícones repetidos no menu; bolinha da Proposta
   com explicação.

Perguntas de regra de contrato que vão para a reunião de terça (não inventar a resposta):
- Cliente **pausado**: divide custo fixo? Conta nas horas e no faturamento esperado? Paga mensalidade?
- **Reunião em que o cliente faltou**: conta como entregue ou fica devendo?
- **Extras**: só contar, ou avisar que deveriam ser cobrados à parte?
- **Mês do onboarding**: paga mensalidade? Gera também a tarefa da rotina desse mês?

## 2. Organização de tarefas (referência de uma agência maior): guardado, voltar com base no uso

Decisão da Moni (26/09/2026): **não construir agora**. O sistema ainda não tem clientes reais e a aprovação de conteúdo
continua fora do Aden. Voltar nisso depois de algumas semanas de uso de verdade.

A referência (só a lógica):
1. **Tarefa do mês gerada pelo pacote:** uma tarefa por cliente por mês ("Olinda, outubro"), com checklist das entregas.
   Nunca uma tarefa por post.
2. **Etapas de conteúdo:**
   - em produção (copy);
   - liberado pra design;
   - em aprovação com o cliente;
   - alteração e ajustes;
   - aprovado.

   Em qualquer ponto a tarefa pode ficar **aguardando informação do cliente** ou **bloqueada**, mostrando há quantos
   dias está parada.
3. **Extras:** tarefa fora do pacote marcada como "extra". Na tela Mês, aba Cada cliente: quantos extras e quantas horas.
4. **Reuniões com cliente:** realizada, não realizada (cliente faltou) ou remarcada, contadas por cliente.
5. Sem responsável por cargo e sem listas por cliente: o cliente é um campo da tarefa (o Aden já é assim).
6. **Etapa do cliente na ficha:** novo, em onboarding, ativo, pausado, encerrado. Ao passar para "em onboarding", cria
   sozinho a tarefa "[Cliente] Onboarding" com o checklist das entregas de entrada do pacote; concluída, o cliente vira
   "ativo".

### O conflito: uma tarefa por mês quebra o cronômetro

Hoje o relógio mede a **tarefa inteira**, e cada tarefa é de um tipo de entrega com quantidade (ex.: 8 posts simples).
Disso dependem duas coisas:
- a **calibragem**: quanto cada entrega leva de verdade (`medicoes.tarefa_id`, `unidades`; `lib/calculo/calibragem.ts`);
- as **horas reais por cliente** (item 2 da seção 3 e grave 6).

Uma tarefa "Olinda, outubro" com reels, estáticos, roteiros e reunião mediria tudo misturado.

**Sugestão aprovada como caminho:** uma tarefa por cliente por mês, mas cada item do checklist é uma entrega com tipo e
quantidade ("7 Reels", "8 estáticos") e tem **o próprio botão Começar**. A medição passa a ser por item
(tipo × unidades), então a calibragem e as horas por cliente continuam certas.

### Como encaixaria (sem item novo no menu)

- **Tarefa do mês:**
  - gerada pelo **escopo contratado do cliente**, não pelo pacote, para respeitar a personalização;
  - começar com um botão "Gerar tarefas de [mês]", não automático no dia 1;
  - uma só por cliente e mês (apertar de novo não duplica).
- **Etapas:** status da tarefa (o quadro passa de 4 para 5 colunas). "Com o cliente" vira "em aprovação com o cliente".
  - "aguardando cliente" e "bloqueado" ficam como marca à parte, com data de início, para contar os dias e voltar para a
    etapa em que estava;
  - na Visão do dia, trocar o contador "Concluídas hoje" por **"Paradas"**, para não chegar a 6 contadores no celular.
- **Extras e horas:** fazer junto com o grave 6.
- **Reuniões:** a "Reunião mensal" do pacote vira item do checklist com resultado; contagem na ficha do cliente.
- **Etapa do cliente:**
  - hoje o cliente só tem `ativo`; a etapa mexe em rateio, capacidade, faturamento esperado e lembretes de contrato;
  - depende das respostas de terça.

**Decidir antes de construir:**
- As etapas valem para o **lote do mês** (o cliente aprova o mês de uma vez) ou para **cada item** do checklist?

**Cuidados:**
- As quantidades da entrada do pacote padrão ainda estão vazias ("a confirmar"): o checklist do onboarding sairia sem
  números.
- O painel do cliente (desligado) usa os status atuais (`responder_peca` exige `revisao`). Se as etapas mudarem, ajustar
  as funções `painel_cliente` e `responder_peca` junto.
- O conector MCP precisa acompanhar: status novos, gerar tarefas do mês, etapa do cliente, resultado de reunião.

**Ordem sugerida quando voltar:**
1. Etapa do cliente e onboarding.
2. Tarefa do mês com relógio por item.
3. Etapas e paradas.
4. Extras, junto com o grave 6.
5. Reuniões.

## 3. Roadmap da auditoria (seção e): aprovado para depois

Em ordem de prioridade:

- **Tarefas geradas pelo pacote:** é a seção 2 acima.
- **Horas reais por cliente vindas das tarefas.**
- **Link de pagamento e lembrete de cobrança**, com o pagamento entrando sozinho em Pagamentos.
- **Aviso** (e-mail ou WhatsApp) quando o cliente responde ou uma tarefa vence.
- **Arquivos e ficha da marca:** por enquanto um campo com o link da pasta basta.
- **Contrato gerado com os dados da ficha, com assinatura eletrônica:** reaproveitar a lógica de contrato e assinatura
  que já existe no SoftMoni, **reescrita aqui dentro**, sem ligação nenhuma com ele (regra de acesso no CLAUDE.md).

Descartados pela Moni:
- Briefing em formulário para o cliente preencher.
- Pipeline de conteúdo separado das tarefas.

## 4. Painel do cliente: esperando decisão

Desligado em `lib/recursos.ts`. A aprovação de conteúdo (Olinda, StadiumPlay, que são clientes do Aden) continua fora do
Aden até os sócios decidirem se migra. Se migrar, trazer as etapas (planejado, agendada, publicada) e os avisos,
reescritos aqui dentro.
