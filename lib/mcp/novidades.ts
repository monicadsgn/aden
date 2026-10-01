// Versão das ferramentas do conector (M14 da auditoria, 01/10/2026). Toda vez que uma ferramenta nova entra, sai ou
// muda de jeito, sobe a VERSAO e ganha uma linha em NOVIDADES. O quem_sou_eu devolve isso para o Claude avisar o sócio,
// e a Visão do dia mostra um aviso aos dois sócios até cada um marcar que atualizou o conector no claude.ai.

export const VERSAO_FERRAMENTAS = "2026-10-01";

export const NOVIDADES: { versao: string; texto: string }[] = [
  {
    versao: "2026-10-01",
    texto:
      "Cronômetro opcional (as horas vêm do tempo cadastrado); projeto de marca em salvar_tipo_entrega (projeto, horasDoProjeto, prazoDias); pedido de tarefa ao outro sócio com aviso (pedidaPor em listar_tarefas e ver_visao_do_dia.semPrazo); ver_avisos; descrição e respostas do cliente em listar_tarefas; conversa inicial (briefing) em ver_cliente; apelido aceito nos nomes (\"Moni\", \"Olinda\"); ver_pagamentos_do_mes mostra quem deve, a divisão fica em ver_mes_visto_de_cima.",
  },
];

/** Onde cada sócio atualiza a lista de ferramentas (texto da tela e do Claude). */
export const COMO_ATUALIZAR =
  "No claude.ai: Configurações → Conectores → Aden → desconectar e conectar de novo (ou \"Atualizar\"), para o Claude enxergar as ferramentas novas.";
