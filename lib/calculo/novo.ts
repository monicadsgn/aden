// Fábricas de objetos vazios. Nenhum número de negócio: tudo começa vazio.

import type { Cenario, Configuracao, LinhaCusto, LinhaEntrega, ProjetoPontual } from "./tipos";

export function novoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function configVazia(): Configuracao {
  return {
    empresa: { reinvestimentoPct: null, impostoPct: null, taxaRecebimentoPct: null, regraRateio: null },
    pessoas: [],
    servicos: [],
    tiposEntrega: [],
    custosFixos: [],
    clientes: [],
    terceiros: [],
    pacotes: [],
    metas: [],
  };
}

export function novaLinhaEntrega(tipoEntregaId: string | null = null): LinhaEntrega {
  return { id: novoId(), tipoEntregaId, quantidade: null, horasPorUnidade: null };
}

export function novaLinhaCusto(categoria: LinhaCusto["categoria"]): LinhaCusto {
  return { id: novoId(), categoria, descricao: "", forma: "fixo", valorCentavos: null, tipoEntregaId: null };
}

export function novoPontual(): ProjetoPontual {
  return { id: novoId(), nome: "", forma: null, meses: null, entregas: [], custos: [], valorCobradoCentavos: null };
}

export function novoCenario(nome: string): Cenario {
  return {
    id: novoId(),
    nome,
    modo: "escopo",
    clienteId: null,
    mensalidadeCentavos: null,
    entregas: [],
    custos: [],
    trafego: {
      modelo: null,
      valorFixoCentavos: null,
      valorPorCampanhaCentavos: null,
      campanhas: null,
      percentualVerba: null,
      verbaMensalCentavos: null,
    },
    pontuais: [],
    entrada: { entregas: [], custos: [], valorCobradoCentavos: null, mesesParaPagar: null },
    mesesSemCobranca: null,
    suspensaoSemCobranca: null,
    horizonteMeses: null,
    sobreposicoes: {
      reinvestimentoPct: null,
      impostoPct: null,
      taxaRecebimentoPct: null,
      percentualPessoa: {},
      divisaoServico: {},
    },
  };
}

export function duplicarCenario(c: Cenario, nome: string): Cenario {
  const copia: Cenario = JSON.parse(JSON.stringify(c));
  copia.id = novoId();
  copia.nome = nome;
  return copia;
}
