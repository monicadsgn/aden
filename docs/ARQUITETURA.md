# Arquitetura: Aden · Gestão

## Stack

Next.js 16 (App Router) + Supabase (Postgres, Auth, RLS) + Tailwind v4 + Vercel.
Projeto Supabase, projeto Vercel, repositório e domínio exclusivos da Aden.

## Áreas do sistema

| Área | Conteúdo | Fase |
|---|---|---|
| Comercial | Calculadora de projeto · CRM (leads, etapas, qualificação) · Propostas | 1 · 6 |
| Administrativo | Clientes e contratos (escopo, limites de alteração, prazos, metas de resultado) · Decisões | 2 |
| Operação | Produção e capacidade por pessoa · Aprovações do cliente (painel) | 3 · 4 |
| Financeiro | Recebimentos, custos fixos, rateio, resultado por cliente, distribuição, fechamento do mês · Relatórios | 5 · 7 |
| Sistema | Configurações · Histórico de alterações · Pessoas e papéis | 1 |

Ordem aprovada: 1 Calculadora → 2 Núcleo + Clientes/Contratos + Decisões → 3 Produção + capacidade → 4 Aprovação → 5 Financeiro → 6 CRM → 7 Relatórios.

## Decisões de regra (definidas pela Moni, 25/09/2026)

- Horas informadas **por entrega**; o sistema multiplica pela quantidade. Cada tipo de entrega tem sua hora por unidade configurável.
- Cada serviço tem uma divisão padrão das horas entre os sócios, em %, que pode ser sobreposta por projeto.
- % dos sócios e reinvestimento: padrão da empresa, sobreponível por projeto, **sinalizado na tela quando difere**.
- Imposto sobre faturamento e taxa de recebimento: percentuais configuráveis, começando vazios (= 0%).
- Um piso por sócio. O alerta compara com o valor por hora de cada um. A sobra por hora do projeto aparece só como informação.
- Mostrar custo por hora **e** valor cobrado por hora.
- Pontuais (branding etc.): diluídos em X meses **ou** fora da mensalidade, escolhido por projeto.
- Audiovisual e terceiros: fixo **ou** por entrega. Ferramentas: fixo mensal.
- Meses sem cobrança: só simulação, começa em zero.
- Consumo de capacidade em % das horas do mês de cada sócio.
- Custo fixo da empresa cadastrado uma vez e rateado entre clientes ativos, **igual** ou **proporcional ao valor**.
- Cobrança do tráfego: fixo, por campanha, % da verba ou incluído na mensalidade. **Sem padrão.**
- Os dois sócios são administradores. Toda alteração em valor, percentual e configuração fica registrada.

## Fórmulas da calculadora (`lib/calculo/motor.ts`)

```
horas do serviço      = Σ quantidade × horas por entrega (pontual diluído: ÷ meses)
horas do sócio        = Σ horas do serviço × % de divisão do sócio naquele serviço
receita bruta         = mensalidade + cobrança de tráfego
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

**Meses sem cobrança:** no horizonte de M meses com N sem cobrança, soma a sobra dos meses pagantes com a dos meses
gratuitos (sem receita, com custos) e calcula a média por hora de cada sócio. No modo escopo, mostra a mensalidade
necessária nos meses pagantes para compensar.

**Pontual fora da mensalidade:** cálculo próprio, sem rateio de custo fixo, com valor mínimo e resultado por sócio.

## Modelo de dados

Todas as tabelas têm `id`, `org_id`, `atualizado_em`, `atualizado_por`, RLS e trigger de auditoria.
✅ = criada na Fase 1.

**Núcleo**
- ✅ `organizacoes`, ✅ `membros` (papel: admin, colaborador, freelancer, cliente)
- ✅ `auditoria` (tabela, registro, ação, antes, depois, autor, data). Só inserida por trigger e sem edição.
- ✅ `configuracoes_empresa` (reinvestimento, imposto, taxa de recebimento, regra de rateio)
- ✅ `pessoas` (sócio?, % padrão, piso/h, capacidade h/mês, vínculo opcional com membro)
- `anexos`

**Comercial / CRM**
- ✅ `simulacoes`, ✅ `simulacao_cenarios` (entradas + fotografia do resultado e da configuração usada)
- `funil_etapas`, `leads`, `criterios_qualificacao`, `lead_criterios`, `interacoes`, `propostas`

**Clientes e contratos**
- ✅ `clientes` (interno?, entra no rateio?), ✅ `contratos` (mínimo: status, valor mensal)
- ✅ `servicos`, ✅ `servico_divisao`, ✅ `tipos_entrega` (horas por unidade)
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
