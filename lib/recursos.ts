// Partes do sistema que existem mas estão desligadas por decisão dos sócios.
// Desligar só esconde: código, banco e dados continuam guardados.

/**
 * Painel do cliente (/c/[token]) e o "Para o cliente" dentro da tarefa.
 * Desligado em 26/09/2026 pela Moni. Em 29/09/2026 os sócios decidiram trazer a aprovação de
 * conteúdo para o Aden; ligado na Fase 3 (passo 3, 30/09/2026). Cliente por cliente: só quem tem
 * link do painel (criado na ficha) vê peças; começou pela StadiumPlay.
 */
export const PAINEL_CLIENTE_ATIVO = true;

/**
 * Telas e blocos que só fazem sentido com mais clientes (Fase 1, aprovada pela Moni em 29/09/2026:
 * na frente só o que se usa com 2 a 5 clientes). Esconder não apaga: o endereço continua abrindo
 * e o que tem dado aparece sozinho. Para mostrar de novo, é só trocar para true.
 */
export const COM_VOLUME = {
  /** aba Horas (capacidade de cada sócio) na tela Mês; /capacidade continua abrindo */
  abaHorasDoMes: false,
  /** Configurações → Metas: aparece sozinha quando já há meta cadastrada */
  secaoMetas: false,
  /** Configurações → Limites e avisos: aparece sozinha quando algum limite está preenchido */
  secaoLimites: false,
  /** botão da Calibragem em Tipos de entrega: aparece sozinho quando há medição do cronômetro */
  botaoCalibragem: false,
};
