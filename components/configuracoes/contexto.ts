// O que a página das Configurações entrega para cada seção: o rascunho em edição, quem mexe nele e os
// pedaços já calculados (sócios, soma dos percentuais, custo fixo total, pendências de aprovação…).

import type { useDados } from "@/lib/dados/contexto";
import type { Membro, Pedido } from "@/lib/dados/repositorio";
import type { verificarImpostoEmDobro } from "@/lib/calculo/motor";
import type { Dispatch, SetStateAction } from "react";
import type { Configuracao, Pessoa, SecaoConfig } from "@/lib/calculo/tipos";
import type { ItemProtegido } from "@/lib/regras/aprovacao";

type Dados = ReturnType<typeof useDados>;

export type ContextoConfig = {
  original: Configuracao;
  rascunho: Configuracao;
  membros: Membro[];
  pedidos: Pedido[];
  set: (patch: Partial<Configuracao>) => void;
  socios: Pessoa[];
  somaSocios: number;
  totalFixo: number;
  e: Configuracao["empresa"];
  e0: Configuracao["empresa"];
  setE: (patch: Partial<Configuracao["empresa"]>) => void;
  dobro: ReturnType<typeof verificarImpostoEmDobro>;
  loginsUsados: Set<string | null | undefined>;
  adicionarCitados: () => void;
  itemPendente: (campo: ItemProtegido["campo"], registroId: string, pessoaId?: string) => ItemProtegido | null;
  pendentes: Pedido[];
  nomePessoa: (id: string) => string;
  nomes: (ids: string[]) => string;
  temMedicao: boolean;
  usuario: Dados["usuario"];
  atualizarUsuario: Dados["atualizarUsuario"];
  repo: Dados["repo"];
  irPara: (s: SecaoConfig) => void;
  setOriginal: Dispatch<SetStateAction<Configuracao>>;
};
