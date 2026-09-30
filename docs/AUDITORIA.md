# Auditoria de usabilidade

Guardada no repositório para não se perder (o relatório de 26/09/2026 ficou só no chat; os itens aprovados dele estão
em `docs/ROADMAP.md`, seção 1).

## Comparação refeita na Fase 1 (29/09/2026)

Base: o mapa de telas aprovado na Fase 0, o sistema pessoal da Moni (referência de organização) e sistemas de agência do
mercado (ClickUp, Asana, Runrun.it, Operand, mLabs). Olhando só o que importa com 2 a 5 clientes.

### O que os bons sistemas fazem e o Aden já faz

| Padrão | Onde está no Aden |
|---|---|
| Tela de entrada "o que é meu hoje" | Visão do dia (`/hoje`) |
| Menu curto, um assunto por tela | 5 grupos; Mês em abas; Relatórios dentro do Mês |
| Cliente como centro de tudo que é dele | Ficha do cliente (único lugar dos dados dele desde a Fase 1) |
| Tempo medido dentro da tarefa, discreto | Botão Começar na tarefa; horas do cliente vêm dele (Fase 1) |
| Proposta bonita para o cliente, números internos separados | Proposta × Calculadora ("Só para os sócios") |
| Janela por cima em vez de trocar de tela | Tarefa, ficha do cliente, lead, detalhe de Cada cliente |

### O que ainda sobra ou falta (para as próximas fases, não construir sem pedido)

1. **Aprovação do cliente dentro da peça** (Operand, mLabs): no Aden está desligada; entra na Fase 3.
2. **Tarefas do mês geradas pelo contrato** (Runrun.it, Operand): guardado na seção 2 do roadmap.
3. **Contador de "paradas"** na Visão do dia (ClickUp, Asana): guardado junto com as etapas de tarefa.
4. **Cobrança automática e lembrete** (Operand): Fase 5 (link InfinitePay).
5. **Relatório do mês para o cliente** (mLabs): processo combinado termina nele; hoje é manual.
6. **Configurações longas:** resolvido pelo médio 12 (30/09/2026): abas em dois grupos, "A empresa" e "O que a Aden
   vende".
7. **Tabelas no celular** (Mês → Cada cliente) rolam para o lado; aceitável com 2 a 5 clientes, rever com mais.

### O que foi escondido na Fase 1 (volta sozinho quando tiver dado)

Chaves em `COM_VOLUME` (`lib/recursos.ts`): aba Horas do Mês; Configurações → Metas e → Limites e avisos; botão da
Calibragem. Na calculadora, "Mais opções" (Quem executa, Tráfego, Projetos pontuais, Percentuais, Meses sem cobrança) e
"Ver a conta inteira" (indicadores por hora e passo a passo). Na Visão do dia, Próximos dias, Depende de mim e Metas só
aparecem quando têm algo.

## Médios 8–14 (30/09/2026)

- 8: aviso igual em vários clientes (ex.: ordem de distribuição vazia) vira uma faixa amarela só, no topo de Pagamentos
  e de Mês → Cada cliente (`avisosRepetidos`/`FaixaRepetida` em `components/Alertas.tsx`).
- 9: "Mês passado em aberto" na Visão do dia explica o que é e tem o botão "Registrar o que caiu" por cliente.
- 10: links levam o cliente (e o mês) junto: Pagamentos lê `?cliente=&mes=`; ficha → Pagamentos e → Cada cliente
  (abre o detalhe dele); aviso "sem valor mensal" abre a ficha do cliente no contrato (`DestinoAlerta.clienteId`).
- 11: topo da Visão do dia no celular: data e saudação numa linha, seletor de pessoa numa linha inteira, contadores numa
  faixa que desliza para o lado.
- 12: Configurações em dois grupos (ver item 6 acima).
- 13: contador vê Pagamentos só para consulta: sem registrar, sem apagar e sem a divisão entre sócios.
- 14: nomes alinhados com o menu: "Proposta" (não "Negociação") em Relatórios, no PDF e no nome da simulação salva;
  "Leads" (não "CRM") na ajuda e no conector; títulos das ferramentas do Mês no conector.

## Cabeçalho no celular e detalhes 15, 17 e 18 (30/09/2026)

- Cabeçalho de todas as telas (`CabecalhoPagina`) no celular: ícone, título e "?" numa linha; a frase e os botões
  embaixo, na largura inteira. Na Proposta, só o "a" da marca no celular, para caber o nome do cliente.
- 15: frase de explicação com no mínimo 12 px (rótulos curtos e títulos em maiúsculas continuam menores).
- 17: o ícone do topo de cada tela é o mesmo do menu (Clientes e contratos, Leads), e nenhum ícone serve para duas
  coisas (Visto de cima deixou a carteira de Pagamentos; Limites deixou o medidor da Calibragem; Custos fixos ficou
  com o prédio).
- 18: a bolinha da Proposta continua sem palavra na tela do cliente; a legenda (verde, vermelho, cinza) fica no "?"
  da Proposta, que agora aparece no topo dela.

## Auditoria geral de 30/09/2026 (depois das Fases 1 a 6)

Jornadas: **A** sócio no dia a dia · **B** cliente · **C** comercial da Aden. Quem: Moni (M), Áleff (Á), cliente (C).
Frequência: dia = todo dia, mês = todo mês, 1× = uma vez só (ou raramente). Prints dos problemas em
`docs/auditoria-prints/` (modo demonstração com dados de exemplo).

### Fase 0 · Inventário

| Tela / aba | O que tem | Pra que serve | Jorn. | Quem | Freq. |
|---|---|---|---|---|---|
| Visão do dia `/hoje` | Para começar, 5 contadores, "o que tenho pra resolver" (publicação, cliente respondeu, falar com, atrasadas, hoje, sem prazo), Próximos dias, Agenda, Depende de mim, Metas, Comercial, Financeiro | o que é meu hoje | A | M, Á | dia |
| Tarefas `/tarefas` | Lista por prazo ou Quadro por status, filtros cliente/pessoa/lote, criação rápida | produzir | A | M, Á, equipe | dia |
| Janela da tarefa | status, datas, estimativa, relógio, responsável, prioridade, cliente, tipo, quantidade, peça (legenda, arte, vai ao ar, enviar, agendar, publicar), descrição, checklist | produzir e publicar | A | M, Á | dia |
| Calendário `/calendario` | mês em grade: tarefas, leads, Google Agenda | ver no tempo | A | M, Á | dia |
| Clientes e contratos `/clientes` | cartões dos clientes | achar o cliente | A/B | M, Á | semana |
| Ficha · Dados | contato, documento, link e atalhos do painel | cadastro | B | M, Á | 1× (atalhos: mês) |
| Ficha · Contrato | 13 campos, garantia, escopo contratado | condições | B | M, Á | 1× |
| Ficha · Tarefas / Contexto / Briefing / Pagamentos | tarefas do cliente; memória (decisão, preferência, pendência, nota); respostas da conversa inicial; o que entrou | tudo do cliente | A/B | M, Á | semana |
| Ficha · Comercial | checklist de fechamento (7 passos), contrato pela Autentique, origem do lead | fechar o cliente | B | M, Á | 1× |
| Leads `/crm` | 4 números, 6 colunas (recebido → ganho), ficha do lead com conversas | funil de vendas | C | Á, M | semana |
| Calculadora `/calculadora` | versões, escopo, custos, entrada, "Mais opções", resultado (~25 números) | conta interna | C | M, Á | por proposta |
| Proposta `/negociacao` | pacote, + e −, "só tenho R$ X", garantia, PDF | mostrar ao cliente | C/B | Á, C | por proposta |
| Mês · Resumo e metas | trilha de metas, espaço para vender, faturamento e teto do MEI | crescimento | A | M, Á | mês |
| Mês · Cada cliente | pagou, horas, paga por hora, sinal; janela com caminhos; investido na Aden | saúde de cada cliente | A | M, Á | mês |
| Mês · Visto de cima | para onde foi o dinheiro, parte de cada sócio, bônus, virada | divisão dos sócios | A | M, Á | mês |
| Mês · Horas e Repasse | capacidade; repasse por cliente (escondidas) | — | A | M, Á | mês |
| Pagamentos `/pagamentos` | registrar o que caiu, para onde vai, pagamentos do mês | caixa | A | M, Á, contador | mês |
| Pedidos e avisos `/aprovacoes` | pedidos entre sócios, avisos | proteção dos sócios | A | M, Á | quando há |
| Configurações (14 seções) | A empresa: Sócios, Equipe e acessos, Regras, Custos fixos, (Metas), (Limites). O que a Aden vende: Serviços, Tipos de entrega, Pacotes, Terceiros, Datas comemorativas, Briefing, Onboarding, Contrato | regras e modelos | — | M, Á | 1× (datas: mês) |
| Relatórios `/pdfs`, Histórico, Calibragem, Glossário | PDFs de sócio e contador; alterações; tempo medido × cadastrado; 15 termos | consulta | A | M, Á | mês / raro |
| Painel do cliente `/c/…` | atalhos (planejamento, fotos, identidade, incluso, resumo do mês), quadro de 6 colunas, aprovar/ajustar, tutorial | aprovar peças | B | C | semana |
| PDF da proposta | valor, entregas, garantia | fechar | B | C | 1× |
| PDF do onboarding | boas-vindas, incluso, como funciona, prazos, contato | começar | B | C | 1× |
| PDF do contrato (Autentique) | partes, cláusulas, assinaturas | assinar | B | C | 1× |
| PDFs do sócio e do contador | recebido, por cliente, custos, teto | prestar contas | A | M, Á, contador | mês |
| Entrar `/entrar` | login e primeiro acesso | acesso | — | todos | 1× |

### Fase 1 e 2 · Diagnóstico e relatório

Legenda: **[eu]** resolvo sozinho depois do "ok" · **[decidir]** precisa de decisão da Moni ou do Áleff.
Nada aqui foi corrigido: só aprovado por número.

#### Graves

- **G1 · Visão do dia não é só de hoje** [eu, desenho abaixo]. `/hoje` mostra até 10 blocos; o "Para começar"
  (configuração) ocupa a primeira tela inteira no celular (print `cel-hoje.png`); Comercial, Financeiro, "Mês passado em
  aberto" (vermelho), Metas e Próximos dias disputam espaço com o que é de hoje. Sugestão: topo só com Publicação de
  hoje, O cliente respondeu, Atrasadas e Hoje; Próximos dias recolhido; Comercial e Financeiro viram uma linha de
  resumo com link; "Para começar" vai para Configurações e na Visão do dia fica uma linha só.
- **G2 · Peças do mesmo calendário não se agrupam** [eu]. StadiumPlay tem 19 "Card de jogo" soltos; na Visão do dia
  da Mônica, 12 das 17 linhas dos próximos 7 dias são cards de jogo (print `pc-tarefas.png`). Sugestão: um card por
  calendário ("Cards de outubro · 2/19 prontos") que abre as peças, usando o lote que já existe. Não mexe em status
  nem no relógio (o fluxo guardado continua guardado).
- **G3 · Relógio não pausa quando a peça vai para o cliente** [eu]. `components/tarefas/useTarefas.ts:139`. Os dias
  esperando o cliente viram horas de trabalho: a calibragem e as horas por cliente saem erradas. Sugestão: pausar ao
  enviar.
- **G4 · Pedido de tarefa ao outro sócio pelo Claude some** [decidir: é peça que falta]. Sem data não entra na Visão
  do dia do outro; não gera aviso; a tarefa não mostra quem pediu nem "pelo Claude" (só o Histórico sabe). Proposta:
  tarefa criada para outra pessoa acende "Depende de mim" dela com "pedido por Mônica (pelo Claude)", até ela abrir.
- **G5 · Configurações misturam as três coisas** [decidir onde ficam as datas]. 12 abas (14 com as escondidas), sem
  ordem de preenchimento, sem separar "uma vez" de "todo mês"; Datas comemorativas e Briefing dentro de "O que a Aden
  vende"; a faixa de proteção dos sócios fica fixa no topo de toda aba (print `pc-config.png`). Sugestão: "Sistema"
  (1 Sócios, 2 Regras da empresa, 3 Custos fixos, 4 Equipe e acessos) e "Comercial" (1 Serviços, 2 Tipos de entrega,
  3 Terceiros, 4 Pacotes, 5 Contrato, 6 Boas-vindas, 7 Conversa inicial), números = ordem; Datas comemorativas saem
  para o operacional (aba do Calendário); a faixa de proteção vira o "?" das abas com cadeado.
- **G6 · Checklist de fechamento escondido** [eu]. "Ver o cliente" abre em Dados e o checklist é a 7ª aba; os dados
  do contrato ficam em 3 abas (Dados, Contrato, Comercial); conversa inicial e painel não têm botão; fechamento em
  andamento não aparece na Visão do dia. Sugestão: abrir direto no checklist, cada passo com o botão do lugar que
  resolve, fechamento aberto na Visão do dia.
- **G7 · Lead ganho não vira cliente pelo quadro** [eu]. Arrastar para "Ganho" só muda a coluna; "Fechou!" aparece
  até em lead perdido; a proposta salva não se liga ao lead. Sugestão: arrastar para Ganho abre o "Fechou!"; esconder
  em perdido; proposta aberta pelo lead já nasce ligada.
- **G8 · Proteção dos sócios tem porta dos fundos** [eu]. O banco só barra *mudar* piso, % e tempo; *apagar* passa:
  a lixeira de Sócios, Tipos de entrega e Serviços (site e `remover_da_configuracao` no conector) apaga sem pedido, e
  recriar o tipo troca o tempo por entrega sem aprovação. Sugestão: apagar sócio, serviço ou tipo com horas vira
  pedido para o sócio afetado (mesma regra de hoje), travado no banco.
- **G9 · Contador veria o link do painel e a divisão da sociedade** [eu, antes de convidar o contador]. A leitura do
  contador pega a linha inteira de `clientes` (inclui o link do painel: dá para aprovar peça como se fosse o cliente;
  CPF, endereço) e de `configuracoes_empresa` (% da Mônica, virada, bônus). Hoje não há contador convidado. Sugestão:
  o contador lê por uma vista só com o financeiro.
- **G10 · Equipe e freelancer podem mexer nas respostas do cliente** [eu, antes de convidar alguém]. A regra de
  tarefas deixa atualizar qualquer coluna, inclusive "o cliente aprovou" e o histórico de respostas (que só o banco
  deveria escrever). Hoje não há equipe convidada. Sugestão: trava no banco para essas colunas.

#### Médios

- **M1 · Palavras de fora e jargão** [decidir as palavras]. Checklist: "Briefing preenchido", "Kickoff marcado",
  tarefa "Kickoff · cliente"; PDF do cliente com capa "ONBOARDING"; "feed" no painel; "porta de acesso", "código",
  "Seu Claude" e "conector" para coisas vizinhas com nomes que não conversam; na tela: sobra (~45 vezes), escopo (~50),
  rateio (~20), lote, calibragem, follow-up, iCal. Proposta: briefing → Conversa inicial; kickoff → Reunião de início;
  onboarding (PDF) → Boas-vindas; lote → Calendário; follow-up → Retorno; calibragem → Acerto do tempo; porta →
  Acesso para outro sistema; escopo → Entregas do contrato; rateio → Divisão dos custos fixos; sobra → O que sobra.
- **M2 · Mesma coisa com nomes diferentes** [eu]. "Com o cliente" × "esperando aprovação" (que também é usado nos
  pedidos entre sócios); "Proposta" no menu × "negociação" em Pacotes, na ficha do lead e no conector; "Pedidos e
  avisos" × título "Aprovações"; "Mês · Sócios" na ajuda × grupo Sócios do menu; skill diz "Equipe", tela diz
  "Equipe e acessos".
- **M3 · Campos com número sem frase e exemplo** [eu]. ~25: os 8 números do contrato na ficha (valor, dia, prazo
  mínimo, aviso prévio, rodadas, prazo de aprovação, prazo de entrega, reuniões), os 9 da divisão entre sócios e da
  oferta padrão, tempo por entrega (sem exemplo em minutos), terceiros, antecedência das datas, campos da calculadora.
- **M4 · "Falta preencher" não diz o que acontece** [eu]. Selo, faixa e "Para começar" só listam; não dizem se é
  obrigatório nem o que para de funcionar. Limites diz "vazio = sem aviso" mas conta como falta.
- **M5 · Tom no Mês → Cada cliente** [eu]. Selos "cálculo bloqueado", "prejuízo silencioso", "custando mais horas do
  que paga"; Horas diz "passou das horas". Sugestão: "abaixo do piso: veja os caminhos", "falta um número".
- **M6 · Tarefas longe da referência** [decidir o que é "área"]. Etiqueta do cliente com a mesma cor para todos; tarefa
  sem prazo não mostra "sem prazo"; prioridade normal/baixa invisível; sem filtro abertas/concluídas/todas nem por
  área; calendário é outra tela, não uma visão dentro de Tarefas. Sugestão: cor por cliente (tom da marca por
  cliente), filtros da referência, visões Lista · Quadro · Calendário juntas. "Área" = serviço (social media,
  tráfego…)?
- **M7 · Comercial espalhado no menu** [decidir]. Leads fica em "Clientes"; Calculadora e Proposta em "Vendas". A
  Jornada C (lead → pesquisa → contato → reunião → proposta → fechamento) precisa de um lugar só. Sugestão: grupo
  "Comercial" = Leads, Proposta, Calculadora; "Clientes" fica só com os clientes ativos.
- **M8 · Pagamento conta em meses diferentes** [decidir]. Pagamentos e a Visão do dia contam pelo mês de referência; o
  Visto de cima conta pela data em que caiu (regra da sociedade). O mesmo pagamento atrasado aparece em setembro numa
  tela e em outubro na outra, e a divisão sai de dois cálculos diferentes. Não há caminho de Pagamentos para o Visto
  de cima. Sugestão: frase explicando nas duas telas, link "ver a divisão", e eu confiro se os dois cálculos batem.
- **M9 · Botões pequenos para o dedo** [eu]. Botão padrão 40 px, pequeno 32 px, abas 34 px, menu 36 px, fechar da
  janela 32 px, etiquetas-botão ~24 px: na Visão do dia, 58 de 67 itens clicáveis ficam abaixo de 44 px. Sugestão:
  subir os componentes base.
- **M10 · Contraste no limite** [decidir o tom]. Branco sobre o verde da marca dá 4,4:1 (botão principal, menu ativo,
  abas; o mínimo é 4,5); aviso amarelo 4,1; ok 4,4. Nos PDFs, "CONTRATO" (8 pt) e o nome do cliente (7,5 pt) ficam
  em 3,1:1. Sugestão: botões cheios no verde um tom mais escuro (`--marca-forte`, já existe).
- **M11 · Letra menor que 12 px em explicação** [eu]. ~20 frases em 9 a 11 px (Configurações, calculadora, Cada
  cliente, ficha, bloco da peça com 9 px).
- **M12 · Travas da peça** [eu, sem mexer no fluxo guardado]. Dá para agendar e publicar sem o cliente aprovar;
  aprovada continua em "Com o cliente" e aparece em dois blocos; o quadradinho conclui com um toque, sem confirmar, e
  encerra a medição; o relógio exige tipo de entrega e só avisa depois do clique; o bloco da peça fica escondido
  atrás de um link em tarefa nova.
- **M13 · Cliente não sabe que tem peça esperando** [decidir]. Ninguém avisa o cliente quando chega peça (o link vai
  por fora); o "Resumo do mês" é só contagem do mês atual, sem meses anteriores nem números de resultado; o painel não
  tem as formas da marca (ondas, blocos), fica mais "cru" que o resto (print `cel-painel-cliente.png`). Relatório do
  mês e aviso são peças novas: proponho só depois das graves.
- **M14 · Conector não sabe o que mudou e fala com nome exato** [eu]. Não existe aviso quando a lista de ferramentas
  muda (versão fixa "1.0.0"); as instruções ainda dizem que o painel do cliente está desligado; "Moni" e "Olinda" dão
  erro (a ficha diz "Mônica" e "Olinda Máquinas"). Sugestão: versão + "o que mudou" em `quem_sou_eu` e um aviso para os
  dois sócios na tela quando a versão muda; aceitar apelido e começo do nome quando só um bate.
- **M15 · O Claude tem pouco para sugerir** [eu]. `listar_tarefas` não devolve descrição, legenda nem texto da arte;
  o histórico de ajustes pedidos pelo cliente não sai; não há leitura dos avisos entre sócios; `ver_cliente` não traz
  a conversa inicial nem as peças aprovadas; `ver_historico` devolve CPF e o link do painel crus. Nenhuma skill cobre
  produção de conteúdo (36 ferramentas sem skill).
- **M16 · Proposta pelo Claude pode criar cliente sem valor** [eu]. As skills de proposta e fechamento não mandam
  gravar pacote e valor no lead antes de `ganhar_lead`, e o conector não liga a simulação ao lead.
- **M17 · Dados reais incoerentes** [decidir]. Olinda e StadiumPlay sem início de contrato, contato e e-mail;
  StadiumPlay com "tráfego só mediante resultado" mas o que conta como resultado está vazio; nenhum pagamento lançado
  (a Olinda vence dia 20: o mês aparece como "em aberto"); cliente "teste" (R$ 1, e-mail pessoal) ainda no banco;
  26 tarefas da Aden sem prazo (somem da Visão do dia); títulos com "[STADIUMPLAY] - " repetem a etiqueta.
- **M18 · "Outras condições" vai para o contrato sem avisar** [eu]. O campo da ficha vira a cláusula "Observações"
  no PDF do cliente; nem a tela nem o conector dizem isso. Falta um teste do contrato como o da proposta.

#### Detalhes

- **D1** Ficha → Dados mistura cadastro (uma vez) com atalhos do painel (todo mês) [eu].
- **D2** Configurações têm dois jeitos de salvar: 5 abas salvam na hora, 9 pela barra [eu].
- **D3** Visão do dia manda "Definir metas" para uma aba escondida; `/capacidade` e `/repasse` caem em abas escondidas [eu].
- **D4** Histórico sem busca nem filtro [eu].
- **D5** Leads: 6 colunas largas rolam para o lado no celular [eu].
- **D6** Origem do lead é texto livre: para medir quiz ou landing no futuro, uma lista (indicação, Instagram, quiz,
  landing, outro) [decidir]. Lead entrando sozinho no futuro cabe na porta genérica que já existe (só registrar no roadmap).
- **D7** Cores dos PDFs são cópia dos tokens (`lib/documentos/base.ts`) com 2 tons que não existem em `tokens.css`;
  `app/icon.svg` com a cor escrita [eu].
- **D8** Sombras somem no modo escuro [eu].
- **D9** `.env.example` só tem 2 das 7 variáveis (faltam conector e Autentique) [eu].
- **D10** Código do conector vai no fim do endereço e fica nos registros da Vercel; sem validade nem limite de
  tentativas [decidir: aceitável com 2 sócios?].
- **D11** Artes do painel ficam num depósito público: quem tiver o endereço exato da arte vê [decidir].

#### Efeito vidro (item 16, proposta)

Já existe de leve no menu lateral e no topo do celular. Onde entraria: menu lateral, cabeçalho de cada tela, faixa de
contadores da Visão do dia, janelas (tarefa, lead) e topo e colunas do painel do cliente. Onde não entra: listas de
tarefas, tabelas e campos (leitura primeiro). Regra: token único (`--vidro`: superfície a ~72% no claro e ~64% no
escuro, desfoque, borda clara fina), texto sempre sobre camada que garanta 4,5:1, e volta a fundo sólido para quem
pede menos transparência no aparelho. Mostro antes e depois em uma tela antes de espalhar.

#### Conferido e em ordem

Nenhuma cor, fonte ou arredondamento solto nos componentes; Poppins é a única fonte; painel, PDFs e telas com a marca.
Nada interno sai no painel, na proposta nem no onboarding (há teste). Todas as tabelas novas (0019–0033) só para
sócio; funções abertas ao cliente com retorno limpo; códigos guardados só como resumo (hash) e canceláveis. Nenhuma
chave secreta exposta ao navegador. Nenhum número de negócio no código (só 7 dias da Visão do dia, 60 dias e 7
publicadas do painel, 3 versões na calculadora: organização de tela, não regra). Todas as ferramentas citadas nas
skills existem. Modo escuro sem cor fixa. A pasta do Drive não foi reaberta nesta rodada: a identidade aplicada em
30/09 já saiu dela.

#### Ordem sugerida para a Fase 3

1. Graves sem decisão: G3, G8, G9, G10 (segurança e medição), depois G1, G2, G6, G7.
2. Graves com decisão: G4, G5.
3. Médios [eu] em um bloco; médios [decidir] conforme as respostas.
4. Detalhes.
