"use client";

import {
  Calculator,
  Copy,
  FilePlus2,
  FolderOpen,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  Printer,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Comparacao } from "@/components/calculadora/Comparacao";
import { EditorCenario } from "@/components/calculadora/EditorCenario";
import { PainelResultado } from "@/components/calculadora/PainelResultado";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Botao, Selecao, cx } from "@/components/ui";
import { calcularCenario } from "@/lib/calculo/motor";
import { configVazia, duplicarCenario, novoCenario, novoId } from "@/lib/calculo/novo";
import type { Configuracao } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";
import type { ResumoSimulacao, Simulacao } from "@/lib/dados/repositorio";

const LETRAS = ["A", "B", "C"];
const MAX_CENARIOS = 3;

function novaSimulacao(): Simulacao {
  return { id: novoId(), nome: "Nova simulação", cenarios: [novoCenario("Cenário A")] };
}

export default function Calculadora() {
  const { repo } = useDados();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [lista, setLista] = useState<ResumoSimulacao[]>([]);
  const [inicial] = useState(novaSimulacao);
  const [sim, setSim] = useState<Simulacao>(inicial);
  // referência para "há alterações?": uma simulação nova e intocada não conta como suja
  const [salvoJson, setSalvoJson] = useState<string>(() => JSON.stringify(inicial));
  const [ativoId, setAtivoId] = useState<string>(() => "");
  const [reuniao, setReuniao] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregado, setCarregado] = useState(false);

  const carregarLista = useCallback(async () => setLista(await repo.listarSimulacoes()), [repo]);

  useEffect(() => {
    (async () => {
      try {
        setConfig(await repo.carregarConfig());
        await carregarLista();
      } catch (e) {
        setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao carregar." });
      } finally {
        setCarregado(true);
      }
    })();
  }, [repo, carregarLista]);

  const ativo = sim.cenarios.find((c) => c.id === ativoId) ?? sim.cenarios[0];
  const resultados = useMemo(() => sim.cenarios.map((c) => calcularCenario(config, c)), [config, sim.cenarios]);
  const resultadoAtivo = resultados[sim.cenarios.indexOf(ativo)];
  const sujo = JSON.stringify(sim) !== salvoJson;

  const mudarCenario = (c: typeof ativo) => setSim((s) => ({ ...s, cenarios: s.cenarios.map((x) => (x.id === c.id ? c : x)) }));

  const confirmarDescarte = () => !sujo || confirm("Há alterações não salvas nesta simulação. Descartar?");

  const abrir = async (id: string | null) => {
    if (!id || !confirmarDescarte()) return;
    const s = await repo.carregarSimulacao(id);
    if (s) {
      setSim(s);
      setSalvoJson(JSON.stringify(s));
      setAtivoId(s.cenarios[0]?.id ?? "");
      setMensagem(null);
    }
  };

  const nova = () => {
    if (!confirmarDescarte()) return;
    const s = novaSimulacao();
    setSim(s);
    setSalvoJson(JSON.stringify(s));
    setAtivoId(s.cenarios[0].id);
    setMensagem(null);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await repo.salvarSimulacao(sim, resultados, config);
      setSalvoJson(JSON.stringify(sim));
      await carregarLista();
      setMensagem({ tom: "ok", texto: "Simulação salva." });
    } catch (e) {
      setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!lista.some((l) => l.id === sim.id)) return nova();
    if (!confirm(`Excluir a simulação "${sim.nome}"? A exclusão fica registrada no histórico.`)) return;
    await repo.removerSimulacao(sim.id);
    await carregarLista();
    const s = novaSimulacao();
    setSim(s);
    setSalvoJson(JSON.stringify(s));
    setAtivoId(s.cenarios[0].id);
  };

  const adicionarCenario = (base?: typeof ativo) => {
    if (sim.cenarios.length >= MAX_CENARIOS) return;
    const letra = LETRAS.find((l) => !sim.cenarios.some((c) => c.nome === `Cenário ${l}`)) ?? String(sim.cenarios.length + 1);
    const c = base ? duplicarCenario(base, `Cenário ${letra}`) : novoCenario(`Cenário ${letra}`);
    setSim((s) => ({ ...s, cenarios: [...s.cenarios, c] }));
    setAtivoId(c.id);
  };

  const removerCenario = (id: string) => {
    if (sim.cenarios.length <= 1) return;
    const resto = sim.cenarios.filter((c) => c.id !== id);
    setSim((s) => ({ ...s, cenarios: resto }));
    if (ativo.id === id) setAtivoId(resto[0].id);
  };

  const configIncompleta = config.pessoas.filter((p) => p.socio).length === 0 || config.tiposEntrega.length === 0;

  if (!carregado) return null;

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={Calculator}
        selo="Comercial"
        titulo="Calculadora de projeto"
        descricao="Simule um cliente antes de fechar: do escopo ao valor mínimo, ou do valor ao que cabe dentro dele."
        acoes={
          <>
            <Botao variante={reuniao ? "primario" : "secundario"} icone={reuniao ? Minimize2 : Maximize2} onClick={() => setReuniao(!reuniao)}>
              {reuniao ? "Sair do modo reunião" : "Modo reunião"}
            </Botao>
            <Botao icone={Printer} aria-label="Imprimir ou salvar em PDF" onClick={() => window.print()} />
          </>
        }
      />

      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {configIncompleta && (
          <div className="nao-imprimir flex flex-wrap items-center gap-3 rounded-card border border-aviso/30 bg-aviso-suave px-4 py-3 text-sm text-aviso">
            <Settings2 size={18} />
            <span className="flex-1 font-medium">Para calcular, cadastre primeiro os sócios, os serviços e os tipos de entrega com as horas de cada um.</span>
            <Link href="/configuracoes" className="rounded-full bg-aviso px-4 py-1.5 text-xs font-bold text-superficie">
              Ir para configurações
            </Link>
          </div>
        )}

        {/* barra da simulação */}
        <div className="nao-imprimir flex flex-wrap items-center gap-2 rounded-card border border-linha bg-superficie p-2 pl-4 shadow-card">
          {editandoNome ? (
            <input
              autoFocus
              aria-label="Nome da simulação"
              className="h-9 min-w-0 flex-1 rounded-campo border border-marca bg-superficie px-3 text-sm font-bold focus:outline-none"
              value={sim.nome}
              onChange={(e) => setSim({ ...sim, nome: e.target.value })}
              onBlur={() => setEditandoNome(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditandoNome(false)}
            />
          ) : (
            <button type="button" onClick={() => setEditandoNome(true)} className="group flex min-w-0 flex-1 items-center gap-2 text-left">
              <span className="truncate text-sm font-bold">{sim.nome}</span>
              <Pencil size={13} className="text-texto-suave group-hover:text-texto" />
              {sujo ? (
                <Badge tom="aviso">alterações não salvas</Badge>
              ) : lista.some((l) => l.id === sim.id) ? (
                <Badge tom="ok">salva</Badge>
              ) : (
                <Badge tom="neutro">nova</Badge>
              )}
            </button>
          )}
          <Selecao
            className="w-full sm:w-56"
            ariaLabel="Abrir simulação salva"
            valor={null}
            vazio={lista.length ? "Abrir simulação salva…" : "Nenhuma simulação salva"}
            opcoes={lista.map((l) => ({ valor: l.id, rotulo: `${l.nome} · ${new Date(l.atualizadoEm).toLocaleDateString("pt-BR")}` }))}
            aoMudar={abrir}
          />
          <Botao pequeno icone={FilePlus2} onClick={nova}>
            Nova
          </Botao>
          <Botao pequeno variante="perigo" icone={Trash2} aria-label="Excluir simulação" onClick={excluir} />
          <Botao pequeno variante="primario" icone={Save} disabled={salvando || !sujo} onClick={salvar}>
            {salvando ? "Salvando…" : "Salvar"}
          </Botao>
        </div>
        {mensagem && (
          <p className={cx("nao-imprimir -mt-3 px-2 text-xs font-semibold", mensagem.tom === "erro" ? "text-erro" : "text-ok")}>{mensagem.texto}</p>
        )}

        {/* abas de cenário */}
        <div className="nao-imprimir flex flex-wrap items-center gap-2" role="tablist" aria-label="Cenários">
          {sim.cenarios.map((c, i) => {
            const erros = resultados[i].alertas.filter((a) => a.nivel === "erro").length;
            const sel = c.id === ativo.id;
            return (
              <div
                key={c.id}
                className={cx(
                  "flex items-center gap-1 rounded-full border py-1 pr-1 pl-1 transition-all",
                  sel ? "border-marca bg-marca text-sobre-marca shadow-card" : "border-linha bg-superficie hover:border-marca/50",
                )}
              >
                <button type="button" role="tab" aria-selected={sel} onClick={() => setAtivoId(c.id)} className="flex items-center gap-2 py-1 pr-1 pl-1 text-sm font-bold">
                  <span className={cx("flex size-6 items-center justify-center rounded-full text-[11px]", sel ? "bg-sobre-marca/20" : "bg-marca-suave text-marca-forte")}>{i + 1}</span>
                  {sel ? (
                    <input
                      aria-label="Nome do cenário"
                      className="bg-transparent font-bold focus:outline-none"
                      style={{ width: `${Math.min(28, Math.max(6, c.nome.length + 1))}ch` }}
                      value={c.nome}
                      onChange={(e) => mudarCenario({ ...c, nome: e.target.value })}
                    />
                  ) : (
                    c.nome
                  )}
                  {erros > 0 && <span className={cx("size-2 rounded-full", sel ? "bg-sobre-marca" : "bg-erro")} aria-label={`${erros} alertas`} />}
                </button>
                <button type="button" aria-label={`Duplicar ${c.nome}`} title="Duplicar" disabled={sim.cenarios.length >= MAX_CENARIOS} onClick={() => adicionarCenario(c)} className="flex size-7 items-center justify-center rounded-full opacity-70 hover:opacity-100 disabled:opacity-30">
                  <Copy size={13} />
                </button>
                {sim.cenarios.length > 1 && (
                  <button type="button" aria-label={`Remover ${c.nome}`} title="Remover" onClick={() => removerCenario(c.id)} className="flex size-7 items-center justify-center rounded-full opacity-70 hover:opacity-100">
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
          {sim.cenarios.length < MAX_CENARIOS && (
            <Botao pequeno variante="fantasma" icone={Plus} onClick={() => adicionarCenario()}>
              Cenário ({sim.cenarios.length}/{MAX_CENARIOS})
            </Botao>
          )}
          {lista.length > 0 && !lista.some((l) => l.id === sim.id) && (
            <span className="ml-auto hidden items-center gap-1 text-[11px] text-texto-suave sm:flex">
              <FolderOpen size={12} /> {lista.length} simulação(ões) salva(s)
            </span>
          )}
        </div>

        {/* editor + resultado */}
        {reuniao ? (
          <div className="mx-auto w-full max-w-5xl">
            <PainelResultado grande resultado={resultadoAtivo} cenario={ativo} config={config} aoMudar={mudarCenario} />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="nao-imprimir min-w-0">
              <EditorCenario cenario={ativo} config={config} aoMudar={mudarCenario} />
            </div>
            <div className="min-w-0">
              <div className="painel-resultado lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
                <PainelResultado resultado={resultadoAtivo} cenario={ativo} config={config} aoMudar={mudarCenario} />
              </div>
            </div>
          </div>
        )}

        {sim.cenarios.length > 1 && (
          <Comparacao cenarios={sim.cenarios} resultados={resultados} config={config} ativoId={ativo.id} aoSelecionar={setAtivoId} />
        )}
      </div>
    </div>
  );
}
