"use client";

import { FilePlus2, History, PencilLine, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Card, Vazio, type Tom } from "@/components/ui";
import type { RegistroAuditoria } from "@/lib/dados/repositorio";
import { useDados } from "@/lib/dados/contexto";
import { formatarMoeda } from "@/lib/formato";

const TABELAS: Record<string, string> = {
  configuracoes_empresa: "Percentuais da empresa",
  pessoas: "Sócio",
  servicos: "Serviço",
  servico_divisao: "Divisão de serviço",
  tipos_entrega: "Tipo de entrega",
  custos_fixos: "Custo fixo",
  clientes: "Cliente",
  contratos: "Contrato",
  simulacoes: "Simulação",
  simulacao_cenarios: "Cenário",
  membros: "Acesso",
};

const CAMPOS: Record<string, string> = {
  nome: "nome",
  reinvestimento_pct: "reinvestimento (%)",
  reinvestimentoPct: "reinvestimento (%)",
  imposto_pct: "imposto (%)",
  impostoPct: "imposto (%)",
  taxa_recebimento_pct: "taxa de recebimento (%)",
  taxaRecebimentoPct: "taxa de recebimento (%)",
  regra_rateio: "regra de rateio",
  regraRateio: "regra de rateio",
  percentual_padrao: "% padrão",
  percentualPadrao: "% padrão",
  piso_hora_centavos: "piso por hora",
  pisoHoraCentavos: "piso por hora",
  capacidade_horas_mes: "horas/mês",
  capacidadeHorasMes: "horas/mês",
  horas_por_unidade: "horas por entrega",
  horasPorUnidade: "horas por entrega",
  valor_mensal_centavos: "valor mensal",
  valorMensalCentavos: "valor mensal",
  percentual: "percentual",
  divisaoPadrao: "divisão padrão",
  ativo: "ativo",
  interno: "interno",
  participa_rateio: "entra no rateio",
  participaRateio: "entra no rateio",
  servico_id: "serviço",
  servicoId: "serviço",
  status: "status",
  entradas: "entradas do cenário",
  cenarios: "cenários",
};

const IGNORAR = new Set(["id", "org_id", "atualizado_em", "atualizado_por", "criado_em", "criado_por", "ordem", "resultado", "config_snapshot"]);

function valor(chave: string, v: unknown): string {
  if (v == null || v === "") return "vazio";
  if (chave.toLowerCase().includes("centavos")) return formatarMoeda(Number(v));
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "object") return "(detalhes)";
  return String(v);
}

function mudancas(r: RegistroAuditoria): { campo: string; de: string; para: string }[] {
  const a = r.antes ?? {};
  const d = r.depois ?? {};
  const chaves = new Set([...Object.keys(a), ...Object.keys(d)]);
  const out: { campo: string; de: string; para: string }[] = [];
  for (const k of chaves) {
    if (IGNORAR.has(k)) continue;
    if (JSON.stringify(a[k]) === JSON.stringify(d[k])) continue;
    if (typeof a[k] === "object" && a[k] != null && typeof d[k] === "object" && d[k] != null) {
      out.push({ campo: CAMPOS[k] ?? k, de: "", para: "" });
      continue;
    }
    out.push({ campo: CAMPOS[k] ?? k, de: valor(k, a[k]), para: valor(k, d[k]) });
  }
  return out;
}

const ACOES: Record<RegistroAuditoria["acao"], { tom: Tom; icone: typeof FilePlus2 }> = {
  criou: { tom: "ok", icone: FilePlus2 },
  alterou: { tom: "info", icone: PencilLine },
  removeu: { tom: "erro", icone: Trash2 },
};

export default function Historico() {
  const { repo } = useDados();
  const [registros, setRegistros] = useState<RegistroAuditoria[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    repo
      .listarAuditoria(300)
      .then(setRegistros)
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."));
  }, [repo]);

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={History}
        selo="Sistema"
        titulo="Histórico de alterações"
        descricao="Toda alteração em valores, percentuais e configurações, com autor e data. Registrado pelo banco e sem possibilidade de edição."
      />
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {erro && <p className="rounded-card bg-erro-suave px-4 py-3 text-sm text-erro">{erro}</p>}
        {registros && registros.length === 0 && <Vazio icone={History} titulo="Nada registrado ainda">As alterações aparecem aqui assim que forem salvas.</Vazio>}
        {registros && registros.length > 0 && (
          <Card>
            <ol className="relative flex flex-col px-5 py-4">
              {registros.map((r) => {
                const a = ACOES[r.acao];
                const Ic = a.icone;
                const nome = (r.depois?.nome ?? r.antes?.nome) as string | undefined;
                const lista = r.acao === "alterou" ? mudancas(r) : [];
                return (
                  <li key={r.id} className="relative flex gap-3 border-b border-linha py-3 last:border-0">
                    <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ${a.tom === "ok" ? "bg-ok-suave text-ok" : a.tom === "erro" ? "bg-erro-suave text-erro" : "bg-info-suave text-info"}`}>
                      <Ic size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px]">
                        <strong>{r.autor}</strong> {r.acao} <Badge tom="marca">{TABELAS[r.tabela] ?? r.tabela}</Badge> {nome && <strong>{nome}</strong>}
                      </p>
                      <p className="text-[11px] text-texto-suave">
                        {new Date(r.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                      {lista.length > 0 && (
                        <ul className="mt-1.5 flex flex-col gap-0.5">
                          {lista.map((m) => (
                            <li key={m.campo} className="text-xs text-texto-suave">
                              {m.de === "" && m.para === "" ? (
                                <>{m.campo} atualizados</>
                              ) : (
                                <>
                                  {m.campo}: <span className="line-through opacity-70">{m.de}</span> → <strong className="text-texto">{m.para}</strong>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        )}
      </div>
    </div>
  );
}
