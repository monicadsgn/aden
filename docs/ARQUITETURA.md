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

Menu (reorganizado na auditoria de usabilidade de 26/09/2026 e simplificado na Fase 1, 29/09/2026): **Dia a dia**
(Visão do dia, Tarefas, Calendário; sempre aberto) · **Clientes** (Clientes e contratos, Leads) · **Vendas** (sempre
aberto: **Calculadora de projeto** em destaque e Proposta) · **Dinheiro e mês** (Mês, Pagamentos; Relatórios é botão
dentro do Mês) · **Sócios** (Pedidos e avisos) · Configurações no fim. Glossário e tour no rodapé (livrinho e "?").

**Fase 1 · simplificar (29/09/2026):** na frente só o que se usa com 2 a 5 clientes; o resto fica escondido sem apagar
(o endereço continua abrindo) e aparece sozinho quando passa a ter dado. As chaves ficam em `COM_VOLUME`
(`lib/recursos.ts`): aba Horas do Mês, Configurações → Metas e → Limites e avisos, botão da Calibragem. Na Visão do dia,
Próximos dias, Depende de mim e Metas só aparecem quando têm algo; o bloco Comercial tem o atalho para a calculadora
e o Financeiro diz quanto falta entrar no mês.

- **Mês** (`/mes`) junta, em abas, o que antes eram quatro telas: Resumo e metas (antiga Visão do mês), Horas
  (Capacidade), Cada cliente (Saúde dos clientes) e Sócios (Repasse). As rotas antigas redirecionam para a aba.
  As abas são componentes em `components/mes/`, abertos por `components/PaginaComAbas.tsx` (aba no endereço
  `?aba=`; o "?" do topo usa a chave `rota#aba` de `lib/ajuda.ts`).
- **Pedidos e avisos** (`/aprovacoes`): abas "Pedidos entre sócios" e "Avisos" (`/avisos` redireciona).
- **Proposta** é a antiga Negociação ao vivo. A **calculadora** é a proposta vista por dentro (só sócios): voltou ao
  menu na Fase 1 e também abre pelo botão "Só para os sócios" da Proposta (pede confirmação). Na frente ficam Como
  calcular, Rotina, Custos e Entrada; Quem executa, Tráfego, Projetos pontuais, Percentuais e Meses sem cobrança ficam
  em "Mais opções" e abrem sozinhos quando a versão usa aquilo (ou quando um aviso aponta para eles: `irParaBloco`
  dispara `EVENTO_ABRIR_BLOCO`). No resultado, o valor, os avisos, a proposta e cada sócio ficam na frente; indicadores
  por hora e o passo a passo ficam em "Ver a conta inteira".
- **Cliente num lugar só (grave 5):** a aba Clientes saiu das Configurações (`?secao=clientes` e os avisos levam para
  `/clientes`). Na ficha, "Personalizar escopo" abre a Proposta com o escopo do cliente; "Guardar no escopo de X" grava
  pelas regras de sempre (`guardarEscopo`, abaixo do piso = pedido de exceção) e volta para a ficha, aba Contrato.
- Calibragem (botão em Configurações → Tipos de entrega) e Histórico (botão no topo das Configurações) saíram do menu.
- Nomes: a tarefa em status `revisao` aparece como **Com o cliente** (esperando a aprovação dele); "aprovação"
  sozinha fica só para os pedidos entre sócios.

## Fase 2 · regras da reunião de 29/09/2026

- **Divisão entre os sócios** (campos protegidos em `configuracoes_empresa`, migration 0019; regra em
  `lib/regras/aprovacao.ts` → `CAMPOS_SOCIEDADE`): `socioPercentualId` recebe `sociedadePctSocio` % do que entra,
  depois do imposto em %, enquanto o faturamento do mês fica abaixo de `sociedadeTetoViradaCentavos`; `socioSobraId`
  fica com o resto e escolhe `sociedadeSobraTrafegoPct` (% da sobra para o tráfego próprio; só ele aprova mudança).
  Da virada para cima, a sobra é dividida pelo % padrão e o tráfego próprio fica com `trafegoProprioMinimoCentavos`.
  Quem é quem trava depois de escolhido.
  - **Calculadora** (`motor.ts`): o faturamento do mês = contratos ativos (sem internos) + o cenário; abaixo da virada,
    `divisao.tipo = "percentual"`. O tráfego próprio fica fora da conta de projeto. Valor mínimo com a regra: busca
    binária da menor mensalidade em que todo sócio com horas chega ao piso (e ninguém fica no negativo), primeiro
    abaixo da virada, depois a partir dela.
  - **Pagamentos** (`pagamentos.ts`): antes da virada (o que entrou no mês do pagamento, todos os clientes), o sócio do
    % recebe o % de cada pagamento depois do imposto (parcial gera o % do parcial); o resto paga taxa e custos; a
    sobra vai para o tráfego próprio (pelo %) e para o outro sócio. Cada pagamento pode ter a taxa real
    (`pagamentos.taxa_centavos`, ex.: cartão); vazio = padrão.
  - **Mês visto de cima** (`lib/calculo/sociedade.ts` → `calcularMesDeCima`; aba "Visto de cima" da tela Mês, que
    substituiu a aba Sócios; o repasse por cliente continua em `?aba=socios`): pagamentos pelo mês em que caíram;
    imposto; DAS; taxas; custos do caixa; custos dos clientes (escopo); **bancado por** (custo com
    `pago_por_pessoa_id`: conta no preço, não sai do caixa); tráfego próprio (quem completa o mínimo); parte de cada
    sócio; **bônus** (parte acima de `sociedadeAvisoBonusCentavos`); quanto falta para a virada; custos **planejados**
    (`custos_fixos.planejado`, desligados) acendem aviso quando a sobra cobre o valor e ainda deixa o tráfego no mínimo.
  - **Teto do MEI**: `mesQueEstouraOTeto` soma o que entrou no ano e projeta os contratos; aviso no Mês e na Visão do dia.
- **Tráfego com garantia**: modelo de cobrança `"garantia"` (gestão sem receita até o resultado; horas contam). A
  Proposta e o PDF mostram a oferta (`ofertaVerbaMin/Max`, `ofertaGestaoAposResultado`); abaixo de
  `ofertaMinimoSocialTrafego` com social media + tráfego, só aviso (calculadora e confirmação ao exportar). O contrato
  guarda o que conta como resultado e até quando (`garantia_resultado`, `garantia_ate`). O lead tem
  `comercial_estruturado`; sem ele, a Proposta pergunta antes de exportar com garantia. Cada cliente mostra as horas de
  tráfego investidas sem cobrança.
- **Contrato**: `vence_ultimo_dia_util` (segunda a sexta, sem feriados) e `limite_reunioes_mes` (condição, não
  quantidade do pacote).
- **Leads**: interação `follow_up`; `followUpsMaximo` na configuração; passou do número, a ficha sugere perda.
- **Conector**: `definir_regras_sociedade`, `ver_mes_visto_de_cima`; campos novos em `definir_percentuais_empresa`
  (oferta, follow-ups), `salvar_custo_fixo` (`pagoPor`, `planejado`), `registrar_pagamento` (`taxaReais`),
  `salvar_ficha_cliente` (vencimento, reuniões, garantia), `salvar_lead` (`comercialEstruturado`) e
  `registrar_conversa_lead` (`follow_up`).
- **Cores**: os tokens de `app/tokens.css` já são o verde (#797c46) e o creme (#fcf9f1) do SVG da logo; provisórios.

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
  Na tela (Configurações → Tipos de entrega) isso é o campo **Quem faz**: "Os sócios" (com tempo) ou um terceiro
  cadastrado (grava `audiovisual=true` + `terceiro_id`; sem horas dos sócios). O conector faz o mesmo com `terceiro`.
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

## CRM (26/09/2026)

Etapas iguais às do SoftMoni: lead recebido → contato feito → proposta enviada → ganho / perdido (com motivo).
Card mostra há quantos dias está na etapa; "parado" só acende com `dias_lead_parado` configurado (vazio = nunca).
Próximo contato aparece na Visão do dia ("Falar com") e no calendário. Taxa de fechamento = ganhos ÷ (ganhos +
perdidos). Valor estimado: digitado, ou o preço calculado do pacote de interesse. **Fechou** (`ganharLead`): cria o
cliente (ativo, no rateio), guarda o escopo a partir da simulação ligada (ou do pacote) com o valor estimado, pelas
mesmas regras da calculadora (abaixo do piso = pedido de exceção), e liga o lead ao cliente.

## Clientes e contratos (26/09/2026)

Ficha do cliente (`/clientes`, `components/clientes/FichaCliente.tsx`): dados, contrato, tarefas, pagamentos e a
conversa do CRM. Nenhuma condição vem pronta. Contas (`lib/calculo/clientes.ts`): fidelidade até = início + prazo
mínimo; avisar se não renovar até = fim − aviso prévio; vencimento do mês = dia do pagamento (dia 31 em mês de 30 vira
30). A Visão do dia lembra: pagamento que vence hoje e ainda não entrou; contrato que termina neste mês (ou já dentro
do aviso prévio); último dia do aviso prévio quando cai neste mês. Sem número fixo de dias.

## Painel do cliente (26/09/2026)

**Desligado** (`PAINEL_CLIENTE_ATIVO = false` em `lib/recursos.ts`, decisão da Moni em 26/09/2026): por enquanto a
aprovação de conteúdo (Olinda, StadiumPlay) fica no SoftMoni. Com a chave desligada somem o link na ficha, o "Para o
cliente" na tarefa e as duas ferramentas do conector, e nenhum link `/c/…` abre. Banco, funções e código continuam.
Se os sócios decidirem migrar, a ideia é trazer as etapas (planejado, agendada, publicada) e os avisos do SoftMoni.

Link só do cliente (`/c/<código>`), sem login. O código é aleatório (48 caracteres) e fica em `clientes.painel_token`;
"gerar outro" revoga o antigo. O cliente só chega aos dados por duas funções do banco (`painel_cliente`,
`responder_peca`, security definer, liberadas para anon): elas devolvem só as tarefas do cliente marcadas
"aparece no painel" (título, legenda, artes, prazo, respostas) e nada interno. Artes no bucket `pecas` (leitura pelo
endereço, escrita de sócio). Fluxo: a equipe marca a tarefa, sobe a arte e a legenda e "envia para aprovar" (status Em
aprovação) → o cliente aprova (fica marcada, a equipe conclui ao publicar) ou pede ajuste (volta para Em produção,
+1 rodada, o texto aparece na tarefa e na Visão do dia). Rodadas usadas × limite do contrato e prazo para aprovar =
envio + prazo de aprovação do contrato. Respostas guardadas em histórico (`respostas_cliente`). Tutorial de 4 passos
na primeira visita, "?" reabre. Peças entregues somem do painel depois de 60 dias (só organização da tela).

## Google Agenda (26/09/2026)

Só leitura, sem app OAuth: cada pessoa cola o "endereço secreto no formato iCal" da própria agenda
(`agendas_externas`, só o dono lê, SEM auditoria para o endereço não aparecer no Histórico). A rota `/api/agenda` recebe
o token da sessão, lê as agendas DAQUELA pessoa pelo banco (RLS) e busca no Google; só aceita endereços
`https://calendar.google.com/calendar/ical/…/*.ics` (o servidor não busca qualquer endereço). Leitor em
`lib/agenda/ics.ts`: fuso (TZID/UTC → fuso de quem vê), dia inteiro, repetição (diária, semanal com dias, mensal pelo
dia, anual, INTERVAL/COUNT/UNTIL), EXDATE, ocorrência alterada, cancelado. Aparece no calendário e em "Agenda de
hoje" na Visão do dia. Criar evento no Google pelo Aden fica para quando houver app OAuth da Aden. O conector não lê
agendas (são pessoais); no claude.ai já existe o conector do Google Agenda.

## Equipe e acessos (26/09/2026)

Papéis: **sócio** (admin, tudo), **equipe** (colaborador: todas as tarefas e o calendário, cria tarefas), **freelancer**
(só as tarefas em que é responsável), **contador** (só financeiro). Quem garante é o banco (migration 0018):
`eh_membro` passou a ser só sócio; a equipe tem regras próprias em `tarefas`, `medicoes` (só o próprio tempo),
`tipos_entrega` e `servicos`, e recebe nomes de pessoas e clientes por `equipe_nomes()` (só nome e foto, nunca piso,
percentual, valor ou link do painel). Convite por e-mail (`convites`); no primeiro acesso a pessoa cria a senha em
/entrar e `aceitar_convite()` a torna membro (equipe e freelancer ganham uma "pessoa" não sócia para receber tarefas).
Sócio não muda o próprio acesso. Testado no banco com um freelancer de mentira dentro de transação desfeita.

## A própria Aden como cliente interno (30/09/2026)

`clientes.interno = true` (coluna da 0001, sem migração nova). A Aden tem tarefas, peças e cronômetro como qualquer
cliente, mas:

- sem mensalidade: fora do faturamento (`calcularVisaoMes`), do teto do MEI (`calcularTeto`, `mesQueEstouraOTeto`), da
  regra da sociedade (`calcularMesDeCima` ignora pagamento dela; o conector recusa registrar pagamento nela), de
  Pagamentos e do "falta entrar";
- não divide nem recebe custo fixo (`prepararMes`: base do rateio sem internos; escopo dela com rateio desligado);
- escopo livre, guardado direto, nunca vira pedido de exceção de piso (`guardarEscopo`);
- as horas do cronômetro nela aparecem no Mês → Cada cliente no card "Investido na Aden", por sócio
  (`horasInvestidasNaAden`), fora da tabela de clientes pagantes; no conector, `ver_saude_clientes.investidoNaAden`.

Testes em `lib/calculo/interno.test.ts`.

## Publicação das peças (Fase 3, passo 1, 30/09/2026)

Peça de conteúdo é tarefa (o pipeline separado foi descartado). Migration 0020 soma duas datas: `publicar_em` (quando
vai ao ar) e `publicada_em` (quando foi). O status da tarefa não muda (a reorganização da seção 2 do ROADMAP segue
guardada); a etapa é calculada em `situacaoPeca`: planejado (a fazer, com data) → produção → esperando aprovação /
ajuste → aprovada → agendada (aprovada, com data) → publicada. `publicar()` conclui a tarefa e para o relógio.
- Tela: bloco da peça no detalhe da tarefa (legenda, artes, "Vai ao ar em", "Marcar como publicada"); fica recolhido em
  tarefa que não é peça. O que é do painel (mostrar ao cliente, enviar para aprovar) só aparece com o painel ligado.
- Visão do dia: bloco "Publicação" (vai ao ar hoje; passou do dia sem marcar; cliente não aprovou no prazo do
  contrato) em `avisosDePublicacao`.
- Painel do cliente: `painel_cliente` devolve `publicarEm`/`publicadaEm`; grupos "No calendário", "Aprovadas"
  (agendadas com data) e "Publicadas e entregues".
- Conector: `salvar_tarefa` com `legenda` e `publicarEm` (AAAA-MM-DD HH:MM, Brasília), `marcar_publicada`, etapa da
  peça em `listar_tarefas` e `ver_visao_do_dia.publicacao`. Testes em `lib/calculo/publicacao.test.ts`.

## Painel do cliente em quadro (Fase 3, 30/09/2026)

`/c/[token]`: colunas que deslizam para o lado, na ordem do caminho do post (`montarQuadro` em `lib/calculo/painel.ts`):
Vem por aí → Em produção (com o ajuste pedido) → Aguardando sua aprovação (primeira no celular) → Aprovada →
Agendada → Publicado recentemente (as 7 mais novas). "Aguardando" e "Publicado" sempre aparecem; as outras, só com
peça. Card com a arte e a faixa "Entra/Entrou dia X"; peça aberta com texto da arte, legenda e, no rodapé, "Ajustar
arte", "Ajustar texto" (com motivos rápidos) e "Aprovar"; aviso "Recebido!" depois de responder; "Resumo do mês"
(`resumoDoMes`) nos atalhos. Migration 0022: `texto_arte` (o que vai escrito na arte; o cliente lê antes da legenda) e
`agendada_em` (a equipe programou o post: aprovada → agendada), e o painel devolve o formato (nome do tipo). A
descrição da tarefa continua interna e nunca sai para o cliente.

## Porta genérica (Fase 3, passo 2, 30/09/2026)

Exceção aprovada em 29/09/2026: um sócio gera o próprio código (Configurações → Equipe e acessos → "Sua porta de
acesso") e entrega a outro sistema, que usa `/api/porta` para ver e mexer nas tarefas desse sócio. O Aden não guarda
nada do outro lado.
- Migration 0021: tabela `portas` (só o hash sha-256 e o começo do código; só o dono lê), funções `porta_gerar`,
  `porta_cancelar`, `porta_ler`, `porta_salvar_tarefa`, `porta_status`. Quem confere o código é o banco.
- Só tarefas em que o dono é o responsável (tarefa nova nasce no nome dele); lê nomes de clientes e tipos, nada de
  valores. Status pela porta: a fazer, em produção, concluída, publicada (sem "com o cliente", que é do painel). O
  relógio segue a regra de `mudarStatus`.
- Histórico: `carimbar()` e `auditar()` usam o dono do código como autor quando não há login (`aden.autor_id`).
- `app/api/porta/route.ts` só traduz (`lib/porta.ts`, testado); cabeçalho `Authorization: Bearer <código>`.
- Não há ferramenta no conector para gerar código: o conector não é uma pessoa, e o código não deve passar por conversa.

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
horas reais do mês e o valor recebido (vazio = valor do contrato). Horas de cada sócio, nesta ordem (grave 6, 29/09/2026):
corrigidas à mão no mês → **cronômetro das tarefas do cliente no mês** (`horasDasTarefas`: soma das medições com o
cliente e o sócio, contadas no mês em que terminaram) → escopo × média medida (calibragem) → escopo × tempo cadastrado.
Na tela (Mês → Cada cliente) é uma linha por cliente (pagou, horas, paga por hora, sinal); o detalhe abre numa janela. Mostra valor por hora real de cada sócio, marca
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
**Código pessoal (Fase 4, migration 0025):** cada sócio gera o seu em Configurações → Equipe → Seu Claude (tabela
`portas` com `uso = 'conector'`; só o hash fica guardado) e cola `/api/mcp/<código>` no claude.ai. O servidor manda o
código no cabeçalho `x-aden-conector` de toda chamada; o banco (`conector_agente`) confere e assina em nome do dono:
auditoria com `pelo_claude = true` (o Histórico mostra "Nome (pelo Claude)"), carimbos e pedidos (`criar_pedido` via
`quem_age`). Mudança protegida que só afeta o dono vale na hora (igual no site); se afeta o outro sócio, vira pedido.
`decidir_pedido` não olha o código: o conector nunca aprova. O código do conector não abre a porta genérica e
vice-versa. Endereço antigo (senha única `ADEN_MCP_TOKEN`, tudo como "Claude (conector)", toda mudança protegida vira
pedido) fica ligado por `CONECTOR_ENDERECO_ANTIGO` em `lib/recursos.ts` até os dois sócios usarem o código novo.
**Contexto do cliente:** `contexto_cliente` (tipo decisão/preferência/pendência/nota, quem anotou e quem resolveu
preenchidos pelo banco, sem exclusão: resolvida sai da lista). Aba Contexto na ficha do cliente; no conector,
`ver_contexto_cliente`, `anotar_contexto_cliente`, `resolver_nota_contexto` e o resumo em `ver_cliente`. Só sócios.
**Planejamento mensal, datas e atalhos (30/09/2026, migration 0027):** `importar_planejamento_mensal` cria as peças
de um calendário de uma vez (`salvarTarefas`, tudo ou nada), na etapa planejado e visíveis ao cliente ("Vem por aí");
`rede` e `lote` da tarefa são internos (filtro por lote na tela Tarefas e em `listar_tarefas`). Datas comemorativas:
`datas_comemorativas` (a data do ano certo) + `datas_do_cliente` (antecedência e nota por cliente, escondida); a conta
do mês fica em `lib/calculo/datas.ts` (`datasDoPlanejamento`, testada) e sai em `datas_do_mes`; tela em Configurações →
Datas comemorativas. Atalhos do painel: colunas `painel_*` em `clientes` (links só https), editados na ficha e por
`atualizar_atalhos_painel`, lidos pelo `painel_cliente`.
**Fase 5, passos 1 e 2 (30/09/2026, migrations 0028 e 0029):** checklist de fechamento (`fechamento_passos`, conta em
`lib/calculo/fechamento.ts`), aberto quando o lead vira cliente (`clientes.fechamento_iniciado_em`), na ordem
onboarding → contrato → pagamento → pasta no Drive → briefing → kickoff (vira tarefa) → link do painel (conferido pelo
link da ficha); quem fez vem do banco. CRM ganhou as etapas pesquisa e reunião. "Mês do onboarding cobra mensalidade?"
em Configurações → Regras da empresa (vazio = a definir). Briefing único: `briefing_perguntas` (texto dos sócios, por
seção, todos os serviços ou um) e `briefing_respostas` (quem respondeu e o texto da pergunta naquele momento), aba
Briefing na ficha e Configurações → Briefing; conta em `lib/calculo/briefing.ts`. Conector: `ver_fechamento`,
`marcar_passo_fechamento`, `ver_briefing`, `responder_briefing`, `salvar_pergunta_briefing`.

**Fase 5, passo 3 (30/09/2026, migration 0031):** contrato com assinatura eletrônica pela Autentique. O texto sai de
`montarContrato` (`lib/calculo/contrato.ts`, puro e testado): partes, objeto (entregas do escopo com o nome que o cliente
vê), valor, vencimento, prazo, condições e garantia vêm da ficha como dados; obrigações e disposições gerais são o texto
dos sócios em Configurações → Contrato (`contrato_modelo`); o sistema não escreve cláusula e lista o que falta. A ficha
ganhou nome no contrato, CPF/CNPJ e endereço. PDF em `lib/contrato/pdf.ts` (pdf-lib); envio e conferência em
`lib/contrato/autentique.ts` (GraphQL v2, só no servidor, chave `AUTENTIQUE_TOKEN` na Vercel, `AUTENTIQUE_SANDBOX=1` para
teste). O site pede por `/api/contrato` com o token da sessão (só sócio); o conector usa `ver_contrato`,
`salvar_modelo_contrato`, `enviar_contrato` e `conferir_contrato`. Cada envio fica em `contratos_assinatura` (quem enviou
vem do banco); a ficha confere sozinha ao abrir e, assinado por todos, marca o passo "Contrato assinado".

**Fase 5, passo 5 (30/09/2026, migration 0032):** onboarding do cliente. O texto é da Moni, guardado em
`onboarding_modelo` (seções com título e texto, "como funciona" de cada serviço, frase da garantia, contato e
atendimento) e editável em Configurações → Onboarding. `montarOnboarding` (`lib/calculo/onboarding.ts`, puro e
testado) junta com o pacote do cliente (incluso), os serviços contratados, a garantia e as condições do contrato, e
lista o que falta. PDF pela impressão do navegador (`/imprimir/onboarding`, `components/impressao/Onboarding.tsx`, com
teste sem nada interno). Conector: `ver_onboarding`, `salvar_modelo_onboarding`.

**PDFs da Aden (30/09/2026, migration 0033; identidade real aprovada pela Moni no mesmo dia):** contrato e
onboarding usam `lib/documentos/base.ts` (pdf-lib + fontkit, no servidor e no navegador): Poppins embutida
(`fontes.ts`, gerado), logo "aden" em vetor (`logo.ts`, do ADEN VERDE.svg), cores da marca (branco domina, verde de
apoio, tons de apoio no verde escuro, texto verde quase preto), ondas, curvas e cantos arredondados, ícones de traço
próprios. `contrato-visual.ts`: primeira página com bloco verde, logo branca, título grande e a linha do contratante,
onda separando do corpo; partes em cartões, cláusulas com número em quadrado verde e título verde em negrito,
assinaturas em cartões, rodapé com a logo pequena. `onboarding-visual.ts`: capa verde "Olá, [nome]!", seções com
ícone e cartões (seções curtas duas por página), página final de contato em verde. Medida de texto letra por letra
(o pdf-lib mede com kerning e desenha sem). O contrato segue a estrutura do contrato da Moni: título "Contrato de
prestação de serviços · Aden · marca", partes qualificadas em texto corrido (CPF/CNPJ formatados por
`formatarDocumento`), cláusulas 1.1, 1.2…, valor por extenso, local e data (cidade em `contrato_modelo.cidade`) e
assinaturas. Conector: `mensagem_pedir_dados_cliente`; `definir_escopo_cliente` aceita `pacote`. Ficha: próximo
vencimento (`proximoVencimento`).

## Modelo de dados

Todas as tabelas têm `id`, `org_id`, `atualizado_em`, `atualizado_por`, RLS e trigger de auditoria.
✅ = criada na Fase 1.

**Núcleo**
- ✅ `organizacoes`, ✅ `membros` (papel: admin, contador, colaborador, freelancer, cliente)
- ✅ `pedidos_alteracao` (campos protegidos e exceções abaixo do piso), ✅ `aprovacoes` (imutável), ✅ `avisos_socios`
- ✅ `auditoria` (tabela, registro, ação, antes, depois, autor, data). Só inserida por trigger e sem edição.
- ✅ `configuracoes_empresa` (reinvestimento, imposto, taxa de recebimento, regra de rateio)
- ✅ `pessoas` (sócio?, % padrão, piso/h, capacidade h/mês, vínculo opcional com membro)
- ✅ `datas_comemorativas`, ✅ `datas_do_cliente` (planejamento mensal)
- ✅ `fechamento_passos` (checklist de fechamento), ✅ `briefing_perguntas`, ✅ `briefing_respostas`, ✅ `contrato_modelo`, ✅ `contratos_assinatura`, ✅ `onboarding_modelo` (Fase 5)
- ✅ `portas` (códigos pessoais: `uso` porta genérica ou conector do Claude; só hash), ✅ `contexto_cliente` (memória do cliente, Fase 4)
- `anexos`

**Comercial / CRM**
- ✅ `simulacoes`, ✅ `simulacao_cenarios` (entradas + fotografia do resultado e da configuração usada)
- ✅ `leads` (etapa, dias na etapa, contato, origem, pacote/simulação ligados, valor estimado, responsável, próximo contato, motivo da perda, cliente criado), ✅ `lead_interacoes` (histórico da conversa)
- Depois: `criterios_qualificacao`, `lead_criterios`, `propostas` (documento enviado)

**Clientes e contratos**
- ✅ `clientes` (interno?, entra no rateio?), ✅ `contratos` (status, valor mensal, **escopo contratado** em jsonb)
- ✅ `mes_cliente` (valor recebido no mês), ✅ `horas_realizadas` (horas reais por sócio e mês)
- ✅ `servicos`, ✅ `servico_divisao`, ✅ `tipos_entrega` (horas por unidade, calibrar desde)
- ✅ `terceiros` (valor por saída, deslocamento médio, frase do cliente), ✅ `pacotes` (frases, rotina e entrada em jsonb, padrão), ✅ `metas` (critério, alvo, ação, conquistada em)
- ✅ `tarefas` (status, prioridade, responsável, datas, checklist em jsonb), ✅ `medicoes` (cronômetro; `tarefa_id`, `unidades`), ✅ `pagamentos` (cada pagamento, mês de referência e data)
- ✅ `clientes` ganhou a ficha (contato, telefone, e-mail, Instagram, segmento, observações, cliente desde); ✅ `contratos` ganhou fim, prazo mínimo, dia do pagamento, aviso prévio, rodadas de alteração, prazo de aprovação, prazo de entrega, início da cobrança e outras condições
- Depois: modelo de cobrança do tráfego no contrato, versão/aditivos
- `contrato_entregas` (tipo de entrega, quantidade/mês), `metas_resultado` (métrica, fonte, alvo, prazo, atingida em)

**Decisões**
- `decisoes` (título, descrição, contexto, data, quem decidiu, quem registrou, área, cliente/contrato/lead, status vigente/substituída/revogada, substitui, revisar em, anexos). Sem remoção: uma mudança cria uma nova decisão.

**Produção**
- `capacidade_membros` (vigência), `ausencias`, `entregas_mes`, `tarefas`, `apontamentos`

**Aprovação (painel do cliente)**
- ✅ na própria `tarefas`: `visivel_cliente`, `legenda`, `arquivos`, `enviada_cliente_em`, `rodadas`, `feedback_cliente`, `cliente_aprovou_em`, `respostas_cliente`; ✅ `clientes.painel_token`

**Financeiro**
- `contas`, `categorias`, `fornecedores`, `lancamentos`, `recorrencias`, ✅ `custos_fixos` (Fase 1), `rateios`, `distribuicoes`, `fechamentos`

**Relatórios**
- `integracoes`, `metricas_diarias`, `relatorios`
