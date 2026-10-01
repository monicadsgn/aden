"use client";

// Datas comemorativas do planejamento mensal. Cada data (do ano certo) vale para os clientes ligados a ela,
// cada um com os próprios dias de antecedência da campanha e uma nota de ideia. O Claude lê isso em
// datas_do_mes antes de montar o planejamento. Salva na hora, sem o botão "Salvar" das outras abas.

import { CalendarHeart, EyeOff, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Botao, CampoTexto, Interruptor, Vazio } from "../ui";
import { diasAntes, type DataComemorativa, type DataDoCliente } from "@/lib/calculo/datas";
import { novoId } from "@/lib/calculo/novo";
import type { ClienteBase } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";

const campo = "h-9 rounded-campo border border-linha bg-superficie px-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20";
const dataBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function SecaoDatas({ clientes: todos }: { clientes: ClienteBase[] }) {
  const { repo } = useDados();
  const [datas, setDatas] = useState<DataComemorativa[]>([]);
  const [ligacoes, setLigacoes] = useState<DataDoCliente[]>([]);
  const [nova, setNova] = useState({ nome: "", data: "" });
  const [verPassadas, setVerPassadas] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await repo.listarDatas();
    setDatas(r.datas);
    setLigacoes(r.ligacoes);
  }, [repo]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lista vinda do banco
    void carregar().catch((e) => setErro(e instanceof Error ? e.message : "Não deu para carregar."));
  }, [carregar]);

  const clientes = todos.filter((c) => c.ativo && !c.interno);
  const hoje = new Date().toISOString().slice(0, 10);
  const visiveis = datas.filter((d) => verPassadas || d.data >= hoje).sort((a, b) => a.data.localeCompare(b.data));
  const passadas = datas.filter((d) => d.data < hoje).length;

  const tentar = async (fn: () => Promise<void>) => {
    setErro(null);
    try {
      await fn();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
    }
  };

  const criar = () =>
    tentar(async () => {
      if (!nova.nome.trim() || !nova.data) throw new Error("Preencha o nome e o dia.");
      await repo.salvarDataComemorativa({ id: novoId(), nome: nova.nome.trim(), data: nova.data, ativo: true });
      setNova({ nome: "", data: "" });
    });

  const ligar = (d: DataComemorativa, clienteId: string, patch: Partial<DataDoCliente>) => {
    const antes = ligacoes.find((l) => l.dataId === d.id && l.clienteId === clienteId);
    return tentar(() =>
      repo.salvarDataDoCliente({ id: antes?.id ?? novoId(), dataId: d.id, clienteId, diasAntecedencia: null, nota: null, escondida: false, ...antes, ...patch }),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-texto-suave">
        Datas que entram no planejamento de cada cliente. Cadastre a data do ano certo (a Black Friday muda todo ano) e ligue aos clientes. Cada cliente tem a própria
        antecedência: com 45 dias, a campanha da data começa 45 dias antes, e o Claude já sugere post de aquecimento no mês em que a janela abre. “Esconder” tira a data do
        planejamento daquele cliente sem apagar.
      </p>

      <div className="flex flex-wrap items-end gap-2 rounded-bloco border border-linha p-3">
        <CampoTexto className="min-w-48 flex-1" rotulo="Nova data" placeholder="ex.: Dia das Crianças" valor={nova.nome} aoMudar={(v) => setNova({ ...nova, nome: v })} />
        <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave">
          Dia
          <input type="date" className={campo} value={nova.data} onChange={(e) => setNova({ ...nova, data: e.target.value })} />
        </label>
        <Botao pequeno variante="primario" icone={Plus} onClick={() => void criar()}>
          Adicionar
        </Botao>
      </div>
      {erro && <p className="text-xs font-semibold text-erro">{erro}</p>}

      {visiveis.length === 0 ? (
        <Vazio icone={CalendarHeart} titulo="Nenhuma data por vir">
          Ex.: Dia das Crianças, Black Friday, Natal, datas do nicho do cliente.
        </Vazio>
      ) : (
        visiveis.map((d) => (
          <div key={d.id} className={`flex flex-col gap-2 rounded-bloco bg-superficie-2/60 p-3 ${d.ativo ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <CalendarHeart size={15} className="text-marca-forte" />
              <strong className="text-sm">{d.nome}</strong>
              <span className="text-xs text-texto-suave">{dataBr(d.data)}</span>
              {!d.ativo && <Badge>desligada</Badge>}
              <span className="flex-1" />
              <Interruptor ligado={d.ativo} rotulo="Ligada" aoMudar={(v) => void tentar(() => repo.salvarDataComemorativa({ ...d, ativo: v }))} />
              <Botao
                pequeno
                variante="perigo"
                icone={Trash2}
                aria-label="Apagar data"
                onClick={() => confirm(`Apagar ${d.nome}? Some de todos os clientes.`) && void tentar(() => repo.removerDataComemorativa(d.id))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              {clientes.map((c) => {
                const l = ligacoes.find((x) => x.dataId === d.id && x.clienteId === c.id);
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                    <label className="flex w-40 items-center gap-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={!!l}
                        onChange={(e) => (e.target.checked ? void ligar(d, c.id, {}) : l && void tentar(() => repo.removerDataDoCliente(l.id)))}
                      />
                      {c.nome}
                    </label>
                    {l && (
                      <>
                        <label className="flex items-center gap-1 text-xs text-texto-suave">
                          <input
                            key={`dias-${l.id}-${l.diasAntecedencia}`}
                            type="number"
                            min={0}
                            className={`${campo} w-20`}
                            defaultValue={l.diasAntecedencia ?? ""}
                            onBlur={(e) => {
                              const v = e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value)));
                              if (v !== l.diasAntecedencia) void ligar(d, c.id, { diasAntecedencia: v });
                            }}
                          />
                          dias antes
                        </label>
                        {l.diasAntecedencia ? <span className="text-xs text-texto-suave">campanha a partir de {dataBr(diasAntes(d.data, l.diasAntecedencia))}</span> : null}
                        <input
                          key={`nota-${l.id}-${l.nota}`}
                          className={`${campo} min-w-40 flex-1`}
                          placeholder="ideia (opcional)"
                          defaultValue={l.nota ?? ""}
                          onBlur={(e) => e.target.value.trim() !== (l.nota ?? "") && void ligar(d, c.id, { nota: e.target.value.trim() || null })}
                        />
                        <Botao pequeno variante="fantasma" icone={EyeOff} onClick={() => void ligar(d, c.id, { escondida: !l.escondida })}>
                          {l.escondida ? "Mostrar" : "Esconder"}
                        </Botao>
                        {l.escondida && <Badge>escondida</Badge>}
                      </>
                    )}
                  </div>
                );
              })}
              {clientes.length === 0 && <p className="text-xs text-texto-suave">Cadastre um cliente ativo para ligar a data.</p>}
              {ligacoes.some((x) => x.dataId === d.id) && (
                <p className="text-[12px] leading-snug text-texto-suave">Dias antes: quantos dias antes da data a campanha começa para aquele cliente. Ex.: 30 dias.</p>
              )}
            </div>
          </div>
        ))
      )}

      {passadas > 0 && (
        <button type="button" className="self-start text-xs font-semibold text-texto-suave underline" onClick={() => setVerPassadas((v) => !v)}>
          {verPassadas ? "Esconder as que já passaram" : `Ver as que já passaram (${passadas})`}
        </button>
      )}
    </div>
  );
}
