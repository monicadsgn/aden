# Arquitetura: Aden · Gestão

## Stack

Next.js 16 (App Router) + Supabase (Postgres, Auth, RLS) + Tailwind v4 + Vercel.
Projeto Supabase, projeto Vercel, repositório e domínio exclusivos da Aden.

## O que o Aden é (Moni, 26/09/2026)

O Aden é a **central da agência**: tudo num sistema só, em vez de vários programas. Tarefas, calendário, comercial,
financeiro, metas e clientes no mesmo lugar, cada pessoa com o próprio acesso. Ele **abre na Visão do dia** de quem
entrou: o que tem para resolver hoje, o que atrasou, o que depende de mim (aprovações, avisos) e um resumo de metas,
comercial e financeiro. Sócios podem ver as pendências um do outro quando quiserem (seletor "De quem"), nunca imposto
na tela. A calculadora é uma ferramenta do comercial, não a porta de entrada. Referência de organização: o SoftMoni
(visão do dia com cartões clicáveis, calendário, janelas de tarefa).

Menu: **Dia a dia** (Visão do dia, Tarefas, Calendário; sempre aberto) · Comercial · Operação · Financeiro · Sócios ·
Administrativo · Sistema · Ajuda.

## Áreas do sistema

| Área | Conteúdo | Fase |
|---|---|---|
| Comercial | Calculadora de projeto · CRM (leads, etapas, qualificação) · Propostas | 1 · 6 |
| Administrativo | Clientes e contratos (escopo, limites de alteração, prazos, metas de resultado) · Decisões | 2 |
| Operação | Produção e capacidade por pessoa · Aprovações do cliente (painel) | 3 · 4 |
| Financeiro | Recebimentos, custos fixos, rateio, resultado por cliente, distribuição, fechamento do mês · Relatórios | 5 · 7 |
| Sistema | Configurações · Histórico de alterações · Pessoas e papéis | 1 |

Ordem aprovada: 1 Calculadora → 2 Núcleo + Clientes/Contratos + Decisões → 3 Produção + capacidade → 4 Aprovação → 5 Financeiro → 6 CRM → 7 Relatórios.

## Pendências guardadas para as próximas fases

### Fluxo de fechamento de ponta a ponta (pedido da Moni, 25/09/2026)
Referência: o que já funciona no SoftMoni (briefing → proposta → contrato → CRM → pastas no Drive).
Na Aden: **cliente fechou → o sistema organiza tudo sozinho, qualquer que seja o serviço**, sem montar nada à mão.
Entra entre a Fase 2 (clientes e contratos) e a Fase 6 (CRM), e o desenho do modelo de dados já precisa prever isso.

Ideia do fluxo (a detalhar com a Moni antes de construir):
1. Lead no CRM → briefing → simulação na calculadora → proposta (a partir do cenário escolhido)
2. Cliente fecha → contrato gerado com os dados da proposta e enviado para assinatura
3. Ao assinar: cliente e contrato criados, **pastas do Drive criadas no padrão da Aden**, tarefas da entrada
   (onboarding, enxoval, primeiras peças) e da rotina mensal geradas, painel do cliente liberado
4. Tudo registrado no histórico e nas decisões

A decidir com a Moni (não inventar):
- Conta do Google Drive **da Aden** (separada da Mônica Design) e estrutura padrão de pastas
- Modelos de proposta e contrato da Aden (identidade própria, ainda não definida)
- Ferramenta de assinatura eletrônica
- O que muda no fluxo por serviço (tráfego, criativos, social media, branding)

## Decisões de regra (definidas pela Moni, 25/09/2026)

- Horas informadas **por entrega**; o sistema multiplica pela quantidade. Cada tipo de entrega tem sua hora por unidade configurável.
- Cada serviço tem uma divisão padrão das horas entre os sócios, em %, que pode ser sobreposta por projeto.
- % dos sócios e reinvestimento: padrão da empresa, sobreponível por projeto, **sinalizado na tela quando difere**.
- Imposto sobre faturamento e taxa de recebimento: percentuais configuráveis, começando vazios (= 0%).
- Um piso por sócio. O alerta compara com o valor por hora de cada um. A sobra por hora do projeto aparece só como informação.
- Mostrar custo por hora **e** valor cobrado por hora.
- Pontuais (branding etc.): diluídos em X meses **ou** fora da mensalidade, escolhido por projeto.
- Audiovisual e terceiros: fixo **ou** por entrega. Ferramentas: fixo mensal.
- Meses sem cobrança: só simulação, começa em zero. Duas opções sempre calculadas lado a lado: **A** o cliente não paga nada; **B** não paga a mensalidade, mas paga a gestão de tráfego. O cenário escolhe qual vale para os alertas.
- Consumo de capacidade em % das horas do mês de cada sócio.
- Custo fixo da empresa cadastrado uma vez e rateado entre clientes ativos, **igual** ou **proporcional ao valor**.
- Cobrança do tráfego: fixo, por campanha, % da verba ou incluído na mensalidade. **Sem padrão.**
- **Verba de mídia não é faturamento** (25/09/2026): o cliente paga direto na plataforma. Não entra em receita, imposto nem taxa, e não é somada em lugar nenhum. É um campo opcional e informativo; no modelo "% da verba" serve só de base para calcular a gestão, e o que fatura é a gestão. Travado por teste.
- Reinvestimento só quando há sobra; cliente novo entra no rateio (+1); custo por hora sem imposto e sem taxa (confirmados em 25/09/2026).
- "O que cabe" respeita piso e capacidade e **mostra qual limite trava e de qual sócio**: piso é preço (decisão comercial), capacidade é gente (decisão de equipe).
- Os dois sócios são administradores. Toda alteração em valor, percentual e configuração fica registrada.

- **Audiovisual** (25/09/2026): a Moni não faz audiovisual (edição, motion, legendagem, corte). Tipo de entrega marcado como "vídeo de terceiro" nunca gera horas; é sempre custo de audiovisual (fixo ou por entrega), pago pela empresa. Roteiro e direção de gravação são tipos normais, com horas. Vídeo sem custo de audiovisual no mesmo bloco gera alerta.
- **Entrada × rotina** (25/09/2026): a entrada do cliente novo (onboarding, estrutura visual e proposta de conteúdo, enxoval do perfil, primeiros estáticos e criativos) acontece uma vez só e fica fora do resultado mensal. O resultado mostra a rotina mensal e, à parte, o custo da entrada e em quantos meses ele se paga.

- **Visão do mês e saúde do cliente** (25/09/2026): a calculadora projeta; a Visão do mês soma todos os clientes ativos
  contra a capacidade de cada sócio; a Saúde do cliente compara o previsto (escopo contratado) com o realizado (horas reais
  e valor recebido do mês). Piso é chão de proteção, não meta nem teto.
- **Ferramentas embutidas** (25/09/2026): o custo das ferramentas e da estrutura entra EMBUTIDO na mensalidade, pelo rateio.
  Na proposta sai um valor só, redondo. Nunca assinatura à parte para o cliente pagar.
- **Regime** (25/09/2026): o CNPJ hoje é MEI: imposto fixo mensal (não %) e teto anual de faturamento. Os valores ficam
  na configuração (nada no código). O sistema avisa quando a projeção anual se aproxima do teto.
- **Custo variável por caso**: diária de gravação, deslocamento (Uber) etc. entram como custo "outro" no cenário, sem mexer no cadastro.
- **Taxa de recebimento**: % e/ou valor fixo por cobrança, prontos para receber a taxa real quando o InfinitePay for integrado.
- **Linguagem simples**: cada tela e cada número importante dizem, em uma frase, o que significam.

## Segunda leva (definida pela Moni em 25/09/2026)

- **Navegação aprovada** (menu sanfona, uma tela por assunto): Comercial (Calculadora, Negociação ao vivo, CRM) ·
  Operação (Tarefas, Visão do mês, Calibragem das horas, Aprovações do cliente) · Financeiro (Saúde dos
  clientes, Registrar pagamento, Repasse dos sócios, PDFs e relatórios) · Sócios (Aprovações, Avisos) · Administrativo
  (Clientes e contratos, Decisões) · Sistema (Configurações em abas, Histórico). O menu lembra o grupo aberto.
- **Sem regra de rateio** (com custo fixo cadastrado) o resultado é **bloqueado**, com botão para escolher a regra.
  O cliente simulado conta como mais um no rateio; com zero clientes, ele fica com todo o custo fixo.
- **Imposto em dobro:** custo fixo com nome de imposto (DAS, imposto, MEI, Simples) + imposto fixo preenchido → erro.
  No regime MEI o imposto em % some da tela e da conta.
- **Tráfego:** sem entrega de um serviço de tráfego no cenário, vale "sem tráfego" sozinho, sem aviso.
- **Horas:** tempo por entrega digitado em minutos (guardado em horas com 6 casas). Todo número de horas mostra a
  origem: previsto no escopo, lançado manualmente ou média medida (N medições). Sem lançamento: "sem registro" e usa a previsão.
- **Avisos acionáveis:** cada aviso tem botão para o campo que resolve. Erro (resultado errado/bloqueado) ≠ aviso ≠ lembrete
  (campo opcional vazio, ex.: reinvestimento).
- **Quem recebe sem trabalhar:** a regra da divisão não muda; a tela mostra "X recebe R$ Y sem horas neste cliente".
- **Tarefas com o cronômetro dentro (26/09/2026, pedido da Moni):** a aba Cronômetro saiu. O tempo é medido na própria
  tarefa, como o "Rastrear tempo" do ClickUp: Start liga, Pausar para, concluir a tarefa encerra. Uma medição por tarefa;
  ela vale por `quantidade` entregas (calibragem = soma dos segundos ÷ soma das entregas). Relógio flutuante no canto de
  qualquer tela enquanto roda. Lista (agrupada por prazo) e Quadro (arrastar muda o status), janela da tarefa com
  status, datas, estimativa (tempo por entrega × quantidade), responsável, prioridade, cliente, tipo e checklist.
  Status: a fazer, em produção, em aprovação, concluída. Padrões de UX tirados do SoftMoni (janela, criação rápida).
- **Cronômetro (regra da calibragem):** iniciar, pausar, parar por entrega. Modo calibragem pede N medições por tipo (N configurável; a Moni
  pediu 5). Calibrado → a média medida estima as horas reais na Saúde. Sugestão de atualizar o tempo quando a média
  difere (limiar opcional); a atualização passa pela aprovação. Recalibrar descarta as medições anteriores.
- **Proteção da remuneração:** piso, % dos sócios, divisão de horas por serviço e tempo por entrega só mudam com a
  aprovação do sócio afetado (piso: o próprio; %: todos os sócios; divisão: quem teve o % mudado; tempo: quem executa o
  serviço). Se quem mudou é o único afetado, vale na hora. Campo vazio pode ser preenchido direto. Escopo ou proposta
  (PDF) abaixo do piso de um sócio só com a aprovação dele (exceção). O conector nunca aprova. Avisos por sócio com
  autor, antes, depois e impacto no bolso por mês. Histórico (auditoria e aprovações) não pode ser editado nem apagado.
- **Pagamentos:** cada pagamento que cai (mês de referência + data). Ordem de distribuição configurável e vazia até os
  sócios decidirem (vazia = distribuição bloqueada). Atraso = o mês de referência acabou sem o contrato pago; pagamento
  que cai depois do mês fica marcado. A Saúde usa os pagamentos quando o mês fecha (ou já cobriram o contrato).
- **Foto de perfil:** sócio troca a própria foto clicando no avatar do menu (ou em Configurações → Sócios). Cortada no
  quadrado e reduzida no navegador; fica no Storage (bucket `avatares`, pasta = org) e o endereço em `pessoas.foto_url`.
- **Perfis:** "sócio" (admin) hoje; "contador" preparado no banco (papel `contador`, só leitura de pagamentos, clientes,
  custos fixos e configuração da empresa) e em `lib/acesso.ts`. Falta só o convite.

## Terceira leva (pedidos da Moni em 26/09/2026)

- **Ajuda dentro do sistema** (`lib/ajuda.ts`, `components/Ajuda.tsx`): tour de primeira vez (até 6 passos, pular e
  rever pelo menu), botão "?" no cabeçalho de cada tela (até 3 frases), glossário no menu (frase + exemplo) e
  "O que isso quer dizer?" em todo aviso (`Alerta.explica` é obrigatório; o TypeScript não deixa criar aviso sem).
- **Blocos clicáveis na calculadora**: o título de cada bloco abre uma janela (`Modal`) com o que é, o que já está
  cadastrado (números da configuração), um exemplo e atalhos (`components/calculadora/Detalhes.tsx`).
- **Terceiros cobrados por saída** (`terceiros`, `tipos_entrega.terceiro_id`): cada unidade do tipo ligado é uma saída.
  custo = saídas × (valor por saída + deslocamento), deslocamento = o real do cliente (`Cenario.deslocamentos`) ou o
  médio do terceiro. Custo só do cliente (categoria audiovisual/terceiro do projeto), nunca rateado. O cliente vê só a
  frase do terceiro ("gravação e edição mensal inclusa"), nunca o valor.
- **Pacotes fechados** (`pacotes`, `lib/calculo/pacotes.ts`): guardam só o que é entregue (rotina e primeiro mês).
  Manutenção mensal = valor mínimo do escopo da rotina (modo escopo, cliente novo, arredondado como a proposta).
  Primeiro mês = (custos em dinheiro da entrada + horas da entrada × piso) ÷ (1 − imposto% − taxa%), arredondado.
  Quantidade vazia = "a confirmar". Negociação começa escolhendo o pacote; o cliente vê nome, frases e valor;
  "Personalizar" abre + e − e mostra a diferença em relação ao pacote. Abaixo do piso: o sinal discreto de sempre.
  Pacote inicial cadastrado: Social media padrão (7 reels, 8 estáticos = Post simples, 7 roteiros, 1 gravação,
  1 planejamento, 1 reunião; primeiro mês: onboarding, enxoval do perfil, estrutura visual, quantidades a confirmar).
- **Trilha de metas** (`metas`, `lib/calculo/metas.ts`): degraus definidos pelos sócios (nunca pelo sistema), com
  critério (faturamento mensal, número de clientes, quanto cada sócio recebe no mês = o menor entre eles, uso da
  capacidade), alvo e ação. Degrau batido guarda a data (e continua conquistado se o número cair).
- **Visão do mês** em tom de crescimento: trilha no topo; "cabem mais N clientes do pacote padrão" = para cada sócio
  com horas no pacote, horas livres ÷ horas do pacote, o menor; N = 0 vira "hora do próximo passo" (ação do degrau).
  O detalhe de horas foi para Operação → Capacidade.

## Fórmulas da calculadora (`lib/calculo/motor.ts`)

```
horas do serviço      = Σ quantidade × horas por entrega (pontual diluído: ÷ meses)
horas do sócio        = Σ horas do serviço × % de divisão do sócio naquele serviço
receita bruta         = mensalidade + cobrança da gestão de tráfego   (a verba de mídia nunca entra)
impostos / taxas      = receita bruta × %
custos do projeto     = ferramentas + audiovisual + terceiros (+ custos do pontual diluído ÷ meses)
rateio (igual)        = total de custos fixos ÷ nº de clientes na base (cliente novo soma 1)
rateio (proporcional) = total × receita ÷ (receita + Σ valores dos outros clientes)
sobra                 = receita − impostos − taxas − custos do projeto − rateio
reinvestimento        = sobra × % (só se a sobra for positiva)
para dividir          = sobra − reinvestimento
parte do sócio        = para dividir × % do sócio
valor/hora do sócio   = parte ÷ horas do sócio
custo por hora        = (custos do projeto + rateio) ÷ horas totais
valor cobrado/hora    = receita bruta ÷ horas totais
sobra por hora        = sobra ÷ horas totais (informativo)
```

**Valor mínimo (modo escopo):** a menor receita em que todo sócio com horas e com piso chega ao piso:
`sobra ≥ piso × horas ÷ ((1 − reinvestimento) × % do sócio)` para cada sócio. Resolvido de forma exata
(linear no rateio igual, equação de 2º grau no proporcional). Sem piso configurado, o mínimo é o ponto de equilíbrio.
A cobrança de tráfego é descontada da mensalidade mínima.

**O que cabe (modo valor):** para cada tipo de entrega, busca quantas unidades a mais (ou a menos) mantêm
todos os sócios acima do piso e dentro da capacidade, considerando também o custo por entrega vinculado ao tipo.
Informa o limite que trava (piso ou capacidade) e de qual sócio.

**Meses sem cobrança:** no horizonte de M meses com N sem cobrança, soma a sobra dos meses pagantes com a dos N meses
suspensos e calcula a média por hora de cada sócio. Nos meses suspensos os custos e o rateio continuam; a receita é zero
(opção A) ou só a gestão de tráfego, com imposto e taxa sobre ela (opção B). Para cada opção, mostra também a mensalidade
necessária nos meses pagantes para compensar.

**Imposto fixo e taxa fixa:** o imposto fixo mensal (MEI) soma-se aos custos fixos da empresa e é rateado entre
os clientes. A taxa fixa de recebimento é descontada de cada cobrança (só quando há receita) e o valor mínimo já a considera.

**Teto do regime:** projeção anual = (valor mensal dos outros clientes ativos + receita deste cenário) × 12. Aviso a partir
do % configurado; erro acima de 100%.

**Proposta (valor único):** receita bruta do cenário (mensalidade + gestão de tráfego, com rateio embutido). No modo escopo,
arredondada para cima em múltiplos do valor configurado.

**Visão do mês (`lib/calculo/mes.ts`):** para cada cliente ativo com escopo contratado, horas por sócio do escopo (rotina
mensal). Soma por sócio × capacidade → horas livres, "afogado" (acima da capacidade) ou "folga sobrando" (uso abaixo do %
configurado). Clientes sem escopo aparecem em aviso e não entram na soma.

**Saúde do cliente:** previsto = escopo contratado com o valor do contrato. Realizado = mesmos custos e rateio, mas com as
horas reais lançadas no mês e o valor recebido (vazio = valor do contrato). Mostra valor por hora real de cada sócio, marca
"prejuízo silencioso" quando fica abaixo do piso e "contratado abaixo do piso" quando o próprio previsto já fica.

**Entrada do cliente (uma vez só):**
```
custo da entrada = custos em dinheiro da entrada + Σ horas do sócio na entrada × piso do sócio
                   − valor cobrado pela entrada × (1 − imposto − taxa)
folga da rotina  = sobra mensal da rotina − sobra necessária para todos chegarem ao piso
se paga em       = custo da entrada ÷ folga da rotina   (folga ≤ 0 → "não se paga com a rotina")
mensalidade p/ pagar em N meses = menor mensalidade cuja folga × N cobre o custo da entrada
1º mês           = horas da rotina + horas da entrada (consumo da capacidade)
```
No valor mínimo, a rotina paga exatamente o piso, então a entrada não se paga por ela: é preciso cobrá-la à parte ou subir a mensalidade.
**A confirmar:** as horas dos sócios na entrada são valorizadas pelo piso de cada um.

**Soluções da Saúde (`lib/calculo/solucoes.ts`):** o escopo do cliente vira um cenário "como está hoje" no valor do
contrato, com o tempo por entrega ajustado para reproduzir as horas reais de cada sócio (fator do sócio ponderado pela
divisão do serviço). Subir = valor mínimo desse cenário. Cortar = "o que cabe" no valor atual (tirar N de um tipo).
Misto = tirar metade do corte e calcular o novo mínimo. Exceção = horas × piso − parte do sócio, por mês.

**Distribuição de pagamentos (`lib/calculo/pagamentos.ts`):** o mês planejado sai do motor (contrato + escopo). Em cada
pagamento: imposto % e taxa (% + tarifa fixa por pagamento); o líquido vai para custos (do projeto + parte do custo fixo)
e sobra. Custo primeiro: enche os custos antes; proporcional: custos ÷ (custos + sobra) do mês. Custos nunca passam do
planejado. Sobra → reinvestimento → sócios pelo %. Pago inteiro ou em partes chega no mesmo total do mês.

**Pacote que cabe ("só tenho R$ X"):** tira uma entrega por vez (a de mais horas) até todos ficarem no piso e dentro das horas.

**Pontual fora da mensalidade:** cálculo próprio, sem rateio de custo fixo, com valor mínimo e resultado por sócio.

## Identidade visual

Provisória (pistache, creme e Montserrat são da Mônica Design). Cores, fonte, cantos (inclusive o formato pílula
dos botões, abas, seletores e etiquetas: `--raio-botao`) e sombras ficam só em `app/tokens.css`; nenhum componente
tem cor, fonte ou arredondamento fixo (só círculos de verdade: avatares, pontos, chaves, barras). O logo fica em `components/Marca.tsx` e `app/icon.svg`.
Verificado em 25/09/2026: trocando só o `tokens.css` por outra paleta e outra fonte, o sistema inteiro muda.

## Conector MCP (Claude no claude.ai)

`app/api/mcp` e `app/api/mcp/[token]` → `lib/mcp/`. O Claude entra com um usuário próprio vinculado como admin
("Claude (conector)"): RLS e auditoria valem para ele como para um sócio. Ferramentas: ver/alterar configuração
(percentuais, regime, ordem de distribuição, sócios, serviços, tipos de entrega em minutos, custos fixos, clientes),
calcular cenário, simulações, histórico, visão do mês, escopo contratado (com a regra do piso), saúde com os caminhos,
horas do mês, calibragem e medições, pagamentos e repasse, resumo do contador, aprovações (só leitura) e pacote que cabe.
Mudanças protegidas feitas pelo conector viram pedido de aprovação. Dinheiro em reais e referências por nome na conversa; a tradução fica em
`lib/mcp/traducao.ts`. As instruções do servidor proíbem inventar número de negócio.
Ao criar uma área nova (fases 2+), acrescente as ferramentas dela aqui.

## Modelo de dados

Todas as tabelas têm `id`, `org_id`, `atualizado_em`, `atualizado_por`, RLS e trigger de auditoria.
✅ = criada na Fase 1.

**Núcleo**
- ✅ `organizacoes`, ✅ `membros` (papel: admin, contador, colaborador, freelancer, cliente)
- ✅ `pedidos_alteracao` (campos protegidos e exceções abaixo do piso), ✅ `aprovacoes` (imutável), ✅ `avisos_socios`
- ✅ `auditoria` (tabela, registro, ação, antes, depois, autor, data). Só inserida por trigger e sem edição.
- ✅ `configuracoes_empresa` (reinvestimento, imposto, taxa de recebimento, regra de rateio)
- ✅ `pessoas` (sócio?, % padrão, piso/h, capacidade h/mês, vínculo opcional com membro)
- `anexos`

**Comercial / CRM**
- ✅ `simulacoes`, ✅ `simulacao_cenarios` (entradas + fotografia do resultado e da configuração usada)
- `funil_etapas`, `leads`, `criterios_qualificacao`, `lead_criterios`, `interacoes`, `propostas`

**Clientes e contratos**
- ✅ `clientes` (interno?, entra no rateio?), ✅ `contratos` (status, valor mensal, **escopo contratado** em jsonb)
- ✅ `mes_cliente` (valor recebido no mês), ✅ `horas_realizadas` (horas reais por sócio e mês)
- ✅ `servicos`, ✅ `servico_divisao`, ✅ `tipos_entrega` (horas por unidade, calibrar desde)
- ✅ `terceiros` (valor por saída, deslocamento médio, frase do cliente), ✅ `pacotes` (frases, rotina e entrada em jsonb, padrão), ✅ `metas` (critério, alvo, ação, conquistada em)
- ✅ `tarefas` (status, prioridade, responsável, datas, checklist em jsonb), ✅ `medicoes` (cronômetro; `tarefa_id`, `unidades`), ✅ `pagamentos` (cada pagamento, mês de referência e data)
- Fase 2 amplia `contratos`: prazo mínimo, vencimento, limite de rodadas, prazo de aprovação, prazo de entrega, aviso prévio, condição de início da cobrança, modelo de cobrança do tráfego, versão/aditivos
- `contrato_entregas` (tipo de entrega, quantidade/mês), `metas_resultado` (métrica, fonte, alvo, prazo, atingida em)

**Decisões**
- `decisoes` (título, descrição, contexto, data, quem decidiu, quem registrou, área, cliente/contrato/lead, status vigente/substituída/revogada, substitui, revisar em, anexos). Sem remoção: uma mudança cria uma nova decisão.

**Produção**
- `capacidade_membros` (vigência), `ausencias`, `entregas_mes`, `tarefas`, `apontamentos`

**Aprovação (painel do cliente)**
- `pecas`, `peca_versoes` (vence em), `aprovacoes` (rodada, dentro do limite)

**Financeiro**
- `contas`, `categorias`, `fornecedores`, `lancamentos`, `recorrencias`, ✅ `custos_fixos` (Fase 1), `rateios`, `distribuicoes`, `fechamentos`

**Relatórios**
- `integracoes`, `metricas_diarias`, `relatorios`
