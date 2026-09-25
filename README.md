# Aden · Gestão

Sistema de gestão da Aden (assessoria de marketing e performance). Sistema próprio,
separado do SoftMoni e da Mônica Design: repositório, banco, deploy e dados exclusivos.

**Fase 1 (atual): Calculadora de projeto.** Simula um cliente antes de fechar, nos dois sentidos:

- **Escopo → valor mínimo:** você monta as entregas e o sistema calcula o menor valor mensal em que cada sócio com horas no projeto atinge o próprio piso por hora.
- **Valor → o que cabe:** você informa a mensalidade e o sistema mostra a sobra, a parte e o valor por hora de cada sócio, e quantas entregas de cada tipo ainda cabem (ou quantas precisam sair).

Também tem custo fixo da empresa rateado (igual ou proporcional ao valor), cobrança de tráfego configurável, projetos pontuais (diluídos ou por fora), meses sem cobrança, consumo da capacidade de cada sócio e comparação de até 3 cenários.

Nenhum número de negócio (percentual, preço, prazo, piso) vem preenchido: tudo é configurado em **Configurações**.

## Rodar localmente

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # testes do motor de cálculo
npm run lint && npm run typecheck
```

Sem as variáveis do Supabase, o sistema abre em **modo demonstração** (dados salvos só no navegador).
Para usar com banco e login, siga [docs/SETUP.md](docs/SETUP.md).

## Onde está cada coisa

| Caminho | O quê |
|---|---|
| `app/tokens.css` | **Identidade visual**: cores, fonte, raios, sombras. Trocar a marca = mexer só aqui (e em `components/Marca.tsx`). |
| `lib/calculo/` | Motor de cálculo (funções puras + testes). Reaproveitado depois pelo Financeiro. |
| `lib/dados/` | Camada de dados: `supabase.ts` (real) e `local.ts` (demonstração). |
| `supabase/migrations/` | Banco: tabelas, permissões por papel (RLS) e histórico automático de alterações. |
| `components/calculadora/` | Editor de cenário, painel de resultado, comparação. |
| `docs/ARQUITETURA.md` | Plano das fases, modelo de dados completo e fórmulas. |
