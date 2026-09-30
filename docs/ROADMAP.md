# Roadmap do Aden

Plano guardado. **Nada daqui é para construir sem a Moni pedir.** Atualizado em 29/09/2026.

## Para retomar num chat novo

- Branch de trabalho: `claude/aden-project-calculator-v7bddm` (sem PR). Produção: aden-sable.vercel.app. Supabase `ofzhdddasiuxmbvyrloc`.
- Ler primeiro: `CLAUDE.md` (regras), este arquivo (o que vem a seguir) e `docs/ARQUITETURA.md` (como está feito).
- Estado em 26/09/2026: auditoria de usabilidade feita; graves 1–4, menu novo (5 grupos, tela Mês com abas),
  card "Para começar" e palavras simples já no ar. Painel do cliente desligado. Campo "Quem faz" nos tipos de entrega.
  Sem clientes reais cadastrados ainda.
- 29/09/2026: reunião de sociedade com o Áleff. Decisões na seção 0; plano em fases (0 a 6) logo abaixo delas.
  Fase 0 (diagnóstico) entregue e aprovada; próxima é a Fase 1.

## Pendências da Moni (fora do código)

- Supabase → Authentication: deixar ligado o cadastro de novos usuários (senão o "Primeiro acesso" dá erro), conferir a
  confirmação por e-mail e ligar a proteção contra senhas vazadas.
- Preencher na configuração (o card "Para começar" da Visão do dia mostra o que falta):
  - valores do terceiro Audiovisual;
  - tempo do Reels e dos tipos de entrada;
  - quantidades da entrada do pacote padrão;
  - piso e horas do Áleff; tempo dos tipos de Atendimento e comercial;
  - regras da empresa (ordem de distribuição, reinvestimento, rateio);
  - metas e dias de lead parado, quando quiserem.
- Nunca convidar ninguém da Aden para a conta Vercel dela (o SoftMoni está lá); se precisar, mover o Aden para uma
  conta só da Aden.

## 0. Decisões da reunião de 29/09/2026 (confirmadas pela Moni)

Valem acima da transcrição da reunião. Todo número abaixo vai para a **configuração** (nunca para o código), e os
marcados como protegidos só mudam com aprovação dos dois sócios.

**Sociedade (protegido):**
- Enquanto o que **entrou no mês** for menor que o teto da virada (R$ 15.000), a Mônica recebe 30% da base; o resto
  (70%) paga custos, terceiros, taxa do InfinitePay e tráfego próprio, e o que sobrar é do Áleff.
- Base dos 30% = o que os clientes **efetivamente pagaram** (pagamento parcial gera 30% do parcial), **depois do
  imposto em %** (quando sair do MEI: primeiro desconta os 8%, depois tira os 30%). No MEI o DAS é fixo e sai como custo
  normal, sem mudar a base. A taxa do InfinitePay é custo: sai dos 70%.
- A partir do teto (entrou no mês ≥ R$ 15.000): 50/50 da sobra.
- Aviso de **bônus**: quando a parte da Mônica passar de R$ 3.400 no mês, o que passar aparece destacado como "bônus"
  (para ela planejar a virada). O aviso é ligado ao valor da parte dela, não ao faturamento.
- Teto, percentual e valor do aviso: campos protegidos na configuração.
- Ordem de distribuição: custos fixos e terceiros → tráfego próprio → sócios. Sem data fixa para os sócios.
- Caixa/reserva: 0% por enquanto. A sobra vai para o tráfego da Aden, mínimo R$ 1.500/mês. Se não chegar ao mínimo:
  na regra dos 30%, quem cobre é o Áleff (sai da parte dele); no 50/50, cada sócio cobre metade.
- Sem comissão de venda enquanto forem só os dois sócios.

**Sócios:**
- Áleff: 74 h/mês; piso R$ 5.000/mês (~R$ 68/h). **Ele mesmo preenche o piso no primeiro login** (campo protegido).
  Ligar o login dele.
- Mônica: mantém como está.

**Clientes ativos (cadastrar na Fase 2):**
- Olinda Máquinas: R$ 3.000/mês, vence dia 20, costuma pagar em parcelas de R$ 500. Escopo: social media,
  audiovisual e tráfego. O CRM do cliente o Áleff só acompanha, não opera.
- StadiumPlay: R$ 1.500/mês, vence no último dia útil. Escopo: social media e audiovisual. Tráfego só mediante
  resultado, sem cobrança por enquanto.

**Entregas e custos:**
- Tipo novo "Gestão de campanhas" no serviço de Tráfego pago, 100% Áleff.
- Gestão de campanhas + Atendimento mensal do cliente: 60 min por cliente por mês no total, **30 + 30**, provisório
  até o cronômetro calibrar.
- Relatório mensal de tráfego: entregue no fim do mês, tempo ainda vazio.
- Venda e fechamento: tempo vazio. "5 dias até o sim" é prazo, não hora de trabalho.
- Audiovisual (gravação): terceiro a R$ 300 por saída com Uber incluso (deslocamento zero). Sai do pacote padrão e
  vira extra, vendido só se o cliente pedir. Continua no escopo da Olinda e da StadiumPlay, 2 por mês cada.
- Máximo de 2 reuniões por mês por cliente: **condição do contrato**, não quantidade do pacote.

**Dinheiro:**
- Banco: InfinitePay, conta conjunta; a taxa dele vai no campo de taxa de recebimento.
- Imposto: mantém o DAS do MEI. Quando o contador confirmar a saída do MEI, troca para 8% sobre o faturamento e
  desliga o DAS (nunca os dois juntos).

**Oferta padrão (modo negociação e propostas):** tráfego com garantia (o cliente só paga a gestão quando tiver
resultado); verba de mídia indicada de R$ 1.000 a R$ 2.000; depois do resultado a gestão sobe para ~R$ 3.000; social
media + tráfego não fecha abaixo de R$ 4.000.

**Painel do cliente e aprovação:** a aprovação de conteúdo vem para o Aden. O painel liga junto com a migração (Fase 3).

**Ponte com o sistema pessoal da Moni:** o Aden só oferece uma porta genérica (API/conector) com um código pessoal da
Moni e nunca sabe que outro sistema existe. A migração é uma importação feita uma vez só. O redirecionamento do link
antigo de aprovação fica por conta do outro sistema.

**WhatsApp:** continua com o nome Alfall (é o número do Áleff) até existir um número só da empresa.

**Guardado para depois** (fluxo de tarefas da seção 2, voltar depois de algumas semanas com clientes reais): cliente
pausado, reunião em que o cliente faltou, mês do onboarding e etapas das tarefas (lote ou item).

**Ainda vai chegar (campos editáveis, não inventar):** apresentação de venda do Áleff e materiais de referência; data
de saída do MEI; tempo do relatório e da venda; e-mail novo da Aden; logo em SVG.

### Sugestões da transcrição

Aprovadas para construir (encaixar nas fases 1 e 2):
1. Qualificar o comercial do lead antes de oferecer a garantia.
2. Definir no contrato o que conta como resultado e o prazo da garantia.
3. Mostrar as horas do Áleff investidas em cliente que ainda não paga a gestão.
4. Pagamento em parcelas: quanto falta entrar no mês, na ficha e na Visão do dia.
5. Aviso do mês em que o teto do MEI estoura.
6. Follow-up do "vou ver" com número de tentativas configurável (passou, vira perdido).
9. Custos pagos do bolso de um sócio registrados como "pago por sócio".

Guardadas para depois: 7 (checklist de kickoff conforme quem fechou), 8 (relatório do mês alimenta o planejamento do
seguinte), 10 (terceiro reserva do audiovisual), 11 (convidar o contador).

## Fases do plano mestre (29/09/2026)

Cada fase começa mostrando o plano à Moni e só mexe em tela ou dado real depois da aprovação. Backup antes de qualquer
migração. Meta: tudo pronto até o fim de outubro.

- **Fase 0 · Diagnóstico:** feita em 29/09 (calculadora saiu do menu na auditoria de 26/09; mapa de telas aprovado).
- **Fase 1 · Simplificar:** feita em 29/09. Calculadora de volta no menu (Vendas, com destaque); só fica na frente o
  que se usa com 2 a 5 clientes, o resto escondido sem apagar (`COM_VOLUME` em `lib/recursos.ts`); graves 5, 6 e 7 da
  auditoria feitos; comparação com sistemas de agência em `docs/AUDITORIA.md`.
- **Fase 2 · Dados e regras da reunião:** feita em 30/09. Código publicado; backup no schema `backup_20260930` do
  banco; migration 0019 aplicada; cadastrados: Olinda e StadiumPlay (valor, vencimento, 2 reuniões/mês, condições),
  Gestão de campanhas e Atendimento mensal (30 min cada), terceiro Audiovisual (R$ 300/saída, sem deslocamento),
  gravação fora do pacote padrão, custos com quem paga (Claude Pro da Mônica no lugar de "Inteligência artificial";
  Claude Max planejado), regra da sociedade, oferta padrão, taxa 0%, reinvestimento 0%, ordem custo primeiro e
  convite do Áleff. Falta: quantidades do escopo de cada cliente (a Moni diz ou usa o pacote), o Áleff aceitar o
  convite, ligar o login dele em Configurações → Sócios e ele mesmo preencher o piso. Seção 0 acima (sociedade, sócios, clientes, entregas, dinheiro, "mês visto de
  cima" no lugar da aba Sócios dentro de Mês, oferta padrão) e as sugestões aprovadas.
- **Fase 3 · Migração da área da agência:** tarefas, peças, aprovações e painel da Olinda e da StadiumPlay; porta
  genérica para a Moni ver e mexer nas tarefas dela de fora.
  Aprovada em 30/09/2026: traz só peças abertas (produção, aprovação, agendada) e as publicadas do mês; a área antiga é
  arquivada, não apagada; as 6 tarefas da logo entram no cliente Aden (investido na Aden); reunião de 29/09 e lista de
  dúvidas ficam de fora; painel começa só pela StadiumPlay (a Olinda entra depois das 5 peças que esperam aprovação lá).
  Passo 1 (etapas de publicação, migration 0020) e passo 2 (porta genérica, migration 0021) feitos em 30/09/2026.
  Importação: só os textos (as artes das peças que ainda vão ao ar a Moni põe à mão); tipos: criativos institucionais
  da Aden → "Criativo de tráfego carrossel" (2) e "estático" (2); 12 posts → "Post simples" (8) e "Carrossel" (4
  "Inside Aden"). Próximos: 3 painel (só StadiumPlay), 4 importação, 5 conferência.
- **Fase 4 · Os dois sócios pelo Claude:** memória de contexto do cliente no conector (quem anotou); toda ferramenta
  registra qual sócio agiu; passo a passo de configuração com o Áleff.
- **Fase 5 · Identidade e documentos:** tokens da marca a partir do SVG; proposta em PDF, contrato por e-mail
  (Autentique), link de pagamento (InfinitePay), onboarding por serviço, rotina de fechamento, pasta no Drive (pronta
  para ligar com o e-mail novo), briefing único no perfil do cliente, template da apresentação comercial. Processo:
  indicação → pesquisa de nicho e concorrência → reunião comercial (follow-up se "vou ver") → proposta → kickoff →
  briefing → planejamento → criativos → monitoramento → relatório no fim do mês.
- **Fase 6 · Skills da Aden:** proposta, contrato, onboarding, fechamento e apresentação em arquivos .skill.

## 1. Auditoria de usabilidade: itens que faltam (entram na Fase 1)

Itens da auditoria de usabilidade aprovados pela Moni (os graves 1–4 e os detalhes 16 e 19 já foram feitos; os
graves 5, 6 e 7 foram feitos na Fase 1, em 29/09/2026; os médios 8–14 e os detalhes 15, 17 e 18 em 30/09/2026):

1. **Grave 5:** dados do cliente num lugar só. Tirar a aba Clientes das Configurações; a ficha do cliente é o único lugar.
   "Personalizar escopo" na ficha abre a Proposta e volta para a ficha.
2. **Grave 6:** aba Cada cliente da tela Mês com uma linha por cliente (pagou, horas, valor por hora, sinal), abrindo o
   detalhe ao clicar. As horas vêm das tarefas; o campo manual vira "corrigir".
3. **Grave 7:** calculadora mostra só Como calcular, Rotina, Custos e Entrada; Tráfego, Projetos pontuais, Percentuais e
   Meses sem cobrança ficam atrás de "Mais opções" (abrem sozinhos quando têm dado).
4. **Médios 8–14 (feitos em 30/09/2026):**
   - 8: aviso repetido de ordem de distribuição vira uma faixa amarela só.
   - 9: "Mês passado em aberto" ganha explicação e botão.
   - 10: links passam o cliente e o lead junto.
   - 11: topo da Visão do dia no celular.
   - 12: abas das Configurações em dois grupos.
   - 13: contador vê Pagamentos só leitura.
   - 14: nomes que ainda divergem.
5. **Detalhes 15, 17 e 18 (feitos em 30/09/2026):** texto mínimo de 12 px em frase explicativa; ícones repetidos no menu; bolinha da Proposta
   com explicação.

Perguntas de regra de contrato (a reunião de 29/09 deixou para depois, junto com a seção 2; não inventar a resposta):
- Cliente **pausado**: divide custo fixo? Conta nas horas e no faturamento esperado? Paga mensalidade?
- **Reunião em que o cliente faltou**: conta como entregue ou fica devendo?
- **Extras**: só contar, ou avisar que deveriam ser cobrados à parte? (O audiovisual já é extra, só se o cliente pedir.)
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
- **Contrato gerado com os dados da ficha, com assinatura eletrônica:** é a Fase 5 (Autentique), escrita aqui dentro.

Descartados pela Moni:
- Briefing em formulário para o cliente preencher.
- Pipeline de conteúdo separado das tarefas.

## 4. Painel do cliente: decidido em 29/09/2026, liga na Fase 3

Desligado em `lib/recursos.ts` até a migração. Os sócios decidiram trazer a aprovação de conteúdo (Olinda,
StadiumPlay) para o Aden: na Fase 3, trazer as etapas (planejado, agendada, publicada) e os avisos, reescritos aqui
dentro, e ligar a chave.
