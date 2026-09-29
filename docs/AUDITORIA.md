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
6. **Configurações longas:** mesmo com Metas e Limites escondidos, são 8 abas. O médio 12 (dois grupos) resolve se ainda
   pesar depois da Fase 2.
7. **Tabelas no celular** (Mês → Cada cliente) rolam para o lado; aceitável com 2 a 5 clientes, rever com mais.

### O que foi escondido na Fase 1 (volta sozinho quando tiver dado)

Chaves em `COM_VOLUME` (`lib/recursos.ts`): aba Horas do Mês; Configurações → Metas e → Limites e avisos; botão da
Calibragem. Na calculadora, "Mais opções" (Quem executa, Tráfego, Projetos pontuais, Percentuais, Meses sem cobrança) e
"Ver a conta inteira" (indicadores por hora e passo a passo). Na Visão do dia, Próximos dias, Depende de mim e Metas só
aparecem quando têm algo.
