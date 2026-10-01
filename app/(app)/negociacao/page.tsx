"use client";

import { Eye, FileDown, HandCoins, Save, X } from "lucide-react";
import { BotaoAjudaTela } from "@/components/Ajuda";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BlocoGarantia } from "@/components/apresentacao/Garantia";
import { VistaCliente } from "@/components/apresentacao/VistaCliente";
import { EscolherPacote, VistaPacoteCliente } from "@/components/apresentacao/VistaPacote";
import { Marca } from "@/components/Marca";
import { Botao, CampoMoeda, CampoTexto, Interruptor, Selecao, cx } from "@/components/ui";
import { alternarServico, garantiaParaCliente, pacoteQueCabe, vistaApresentacao, vistaPacote, type EstadoApresentacao } from "@/lib/calculo/apresentacao";
import type { Lead } from "@/lib/calculo/crm";
import { frasesParaCliente, pacoteParaCenario, precoDoPacote } from "@/lib/calculo/pacotes";
import { abaixoDoMinimoSocialTrafego, ajustarQuantidade, calcularCenario, temEntregaDeTrafego } from "@/lib/calculo/motor";
import { configVazia, duplicarCenario, novoCenario, novoId } from "@/lib/calculo/novo";
import type { Configuracao, Id } from "@/lib/calculo/tipos";
import { assinaturaProposta } from "@/lib/dados/acoes";
import { useDados } from "@/lib/dados/contexto";
import type { Pedido } from "@/lib/dados/repositorio";
import { formatarMoeda } from "@/lib/formato";
import { guardarParaImprimir } from "@/lib/impressao";
import { guardarEscopo } from "@/lib/dados/acoes";
import { enviarCenario, receberCenario } from "@/lib/navegacao";
import { sociosAbaixoDoPiso } from "@/lib/regras/aprovacao";

interface Versao {
  id: string;
  nome: string;
  estado: EstadoApresentacao;
}

export default function Negociacao() {
  const { repo } = useDados();
  const router = useRouter();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [estado, setEstado] = useState<EstadoApresentacao>(() => ({ cenario: novoCenario("Proposta"), desligados: {} }));
  const [versoes, setVersoes] = useState<Versao[]>([]);
  const [simId] = useState(novoId);
  const [nomeCliente, setNomeCliente] = useState("");
  const [soTenho, setSoTenho] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [personalizando, setPersonalizando] = useState(false);
  // vindo da ficha do cliente ("Personalizar escopo"): guarda o escopo e volta para a ficha
  const [volta, setVolta] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // vindo do lead (CRM): para lembrar de conferir o comercial antes de oferecer a garantia
  const [lead, setLead] = useState<Lead | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await repo.carregarConfig();
        setConfig(c);
        setPedidos(await repo.listarPedidos().catch(() => []));
        const recebido = receberCenario();
        const q = new URLSearchParams(window.location.search);
        const v = q.get("volta");
        if (v?.startsWith("/")) setVolta(v);
        const leadId = q.get("lead");
        if (leadId) setLead((await repo.listarLeads().catch(() => [])).find((x) => x.id === leadId) ?? null);
        if (recebido?.cenarios[0]) {
          const cen = recebido.cenarios[0];
          setEstado({ cenario: cen, desligados: {} });
          if (recebido.origem === "ficha") setPersonalizando(true);
          setNomeCliente(c.clientes.find((x) => x.id === cen.clienteId)?.nome ?? "");
        } else if ((c.pacotes ?? []).some((p) => p.ativo)) {
          // vindo do CRM: já com o nome do lead
          const nome = new URLSearchParams(window.location.search).get("cliente");
          if (nome) setNomeCliente(nome);
          // primeiro passo: escolher um pacote
          setEscolhendo(true);
        }
      } finally {
        setCarregado(true);
      }
    })();
  }, [repo]);

  const vista = useMemo(() => vistaApresentacao(config, estado), [config, estado]);
  const cen = estado.cenario;
  const garantia = garantiaParaCliente(config, cen);
  const temTrafego = temEntregaDeTrafego(config, cen);
  const pacotesAtivos = (config.pacotes ?? []).filter((p) => p.ativo);
  const vPacote = useMemo(() => {
    const p = (config.pacotes ?? []).find((x) => x.ativo && x.id === estado.cenario.pacoteId);
    return p ? vistaPacote(config, p, estado) : null;
  }, [config, estado]);

  const escolherPacote = (id: Id) => {
    const p = pacotesAtivos.find((x) => x.id === id);
    if (!p) return;
    setEstado({ cenario: pacoteParaCenario(p, { clienteId: cen.clienteId }), desligados: {} });
    setPersonalizando(false);
    setEscolhendo(false);
  };

  const mudarQuantidade = (tipoId: Id, delta: number) => setEstado((e) => ({ ...e, cenario: ajustarQuantidade(e.cenario, tipoId, delta) }));
  const trocarServico = (servicoId: Id) => setEstado((e) => alternarServico(config, e, servicoId));

  const montarPeloValor = () => {
    if (!soTenho || soTenho <= 0) return;
    const r = pacoteQueCabe(config, cen, soTenho);
    setEstado({ ...estado, cenario: r.cenario });
    setAviso(r.cabe ? `Pacote ajustado para ${formatarMoeda(soTenho)}.` : `Não conseguimos montar um pacote em ${formatarMoeda(soTenho)}.`);
  };

  const valorSeguePacote = () => setEstado({ ...estado, cenario: { ...cen, modo: "escopo", mensalidadeCentavos: null } });

  const salvarVersao = async () => {
    const n = versoes.length + 1;
    const v: Versao = { id: novoId(), nome: `Proposta ${n}`, estado: structuredClone({ ...estado, cenario: { ...duplicarCenario(cen, `Proposta ${n}`) } }) };
    const lista = [...versoes, v];
    setVersoes(lista);
    try {
      const nomeSim = `Proposta · ${nomeCliente || "cliente novo"}`;
      const cens = lista.map((x) => x.estado.cenario);
      await repo.salvarSimulacao({ id: simId, nome: nomeSim, cenarios: cens }, cens.map((x) => calcularCenario(config, x)), config);
      // aberta pelo lead (G7 da auditoria): a proposta já fica ligada a ele, sem escolher depois
      if (lead && lead.simulacaoId !== simId) {
        const ligado = { ...lead, simulacaoId: simId };
        await repo.salvarLead(ligado);
        setLead(ligado);
      }
      setAviso(lead ? `${v.nome} guardada e ligada ao lead ${lead.nome}.` : `${v.nome} guardada.`);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Erro ao guardar a versão.");
    }
  };

  // Os detalhes mostram piso, horas e divisão: nunca abrir sem querer com o cliente olhando.
  const verDetalhes = () => {
    if (!confirm("Os detalhes mostram números internos (piso, horas, divisão entre os sócios). Abrir agora, longe da tela do cliente?")) return;
    enviarCenario({ origem: "apresentacao", nome: `Proposta · ${nomeCliente || "cliente novo"}`, cenarios: [cen] });
    router.push("/calculadora");
  };

  // PDF: versão com algum sócio abaixo do piso precisa de aprovação (sem dizer isso na tela do cliente)
  const r = useMemo(() => calcularCenario(config, cen), [config, cen]);
  const abaixo = sociosAbaixoDoPiso(config, r);
  const valor = vista.valorCentavos;
  const assinatura = assinaturaProposta(cen, valor);
  const excecoes = pedidos.filter((p) => p.tipo === "excecao" && p.assinatura === assinatura);
  const liberado = abaixo.length === 0 || excecoes.some((p) => p.status === "aplicado");
  const pendente = excecoes.some((p) => p.status === "pendente");

  // avisos internos (nunca na tela do cliente): perguntados na hora de exportar
  const avisosInternos = () => {
    const out: string[] = [];
    const min = abaixoDoMinimoSocialTrafego(config, cen, valor);
    if (min != null) out.push(`Social media + tráfego está abaixo do mínimo combinado de ${formatarMoeda(min)} por mês.`);
    if (cen.trafego.modelo === "garantia" && lead?.comercialEstruturado !== true)
      out.push(lead ? `${lead.nome} ainda não tem o comercial marcado como estruturado: a garantia pode não trazer venda.` : "Confirme se o comercial do cliente está estruturado antes de oferecer a garantia.");
    return out;
  };

  const exportar = async () => {
    if (valor == null) return;
    const avisos = avisosInternos();
    if (avisos.length && !confirm(`${avisos.join("\n")}\n\nExportar mesmo assim?`)) return;
    if (!liberado) {
      if (pendente) return setAviso("Esta versão está esperando aprovação interna.");
      if (!confirm("Esta versão precisa de aprovação interna antes de exportar. Pedir agora?")) return;
      const p = await repo.proporExcecao({
        clienteId: cen.clienteId,
        afetados: abaixo.map((a) => a.pessoaId),
        assinatura,
        descricao: `Proposta de ${formatarMoeda(valor)} para ${nomeCliente || "cliente novo"} (negociação) abaixo do piso de ${abaixo.map((a) => a.nome).join(" e ")}`,
        dados: { aplicar: "proposta", cenario: cen, valorCentavos: valor, perdas: abaixo },
      });
      setPedidos(await repo.listarPedidos());
      if (p.status !== "aplicado") return setAviso("Pedido enviado. O PDF libera quando for aprovado.");
    }
    guardarParaImprimir({ tipo: "proposta", cenario: cen, clienteNome: nomeCliente || "cliente", valorCentavos: valor });
    router.push("/imprimir/proposta");
  };

  const guardarComoEscopo = async () => {
    if (!cen.clienteId) return;
    setGuardando(true);
    try {
      const r = await guardarEscopo(repo, config, cen.clienteId, cen);
      if (!r.gravado) {
        setAviso(`Ficou abaixo do piso de ${r.abaixo.map((x) => x.nome).join(" e ")}: o escopo espera aprovação em Sócios → Pedidos e avisos.`);
        return;
      }
      if (volta) router.push(volta);
      else setAviso("Escopo guardado na ficha do cliente.");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não deu para guardar o escopo.");
    } finally {
      setGuardando(false);
    }
  };

  // Sair volta para onde a pessoa estava (CRM, ficha do cliente…); sem histórico, para a Visão do dia.
  const sair = () => {
    if (volta) return router.push(volta);
    const veioDoAden = document.referrer.startsWith(window.location.origin) && !document.referrer.includes("/negociacao");
    if (veioDoAden && window.history.length > 1) router.back();
    else router.push("/hoje");
  };

  if (!carregado) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-fundo">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-linha bg-fundo/95 px-4 py-3 backdrop-blur sm:px-8">
        <span className="sm:hidden">
          <Marca compacta />
        </span>
        <span className="hidden sm:inline-flex">
          <Marca />
        </span>
        <div className="min-w-0 flex-1">
          <CampoTexto ariaLabel="Nome do cliente" placeholder="Nome do cliente" valor={nomeCliente} aoMudar={setNomeCliente} className="max-w-xs" />
        </div>
        <button
          type="button"
          onClick={verDetalhes}
          title="Números internos, só para os sócios"
          className="flex items-center gap-1.5 rounded-botao px-2.5 py-2 text-xs font-semibold text-texto-suave hover:bg-superficie-2 hover:text-texto"
        >
          <Eye size={14} />
          <span className="hidden sm:inline">Só para os sócios</span>
        </button>
        <BotaoAjudaTela chave="/negociacao" />
        <button type="button" onClick={sair} aria-label="Sair da proposta" className="flex size-10 items-center justify-center rounded-item hover:bg-superficie-2">
          <X size={20} />
        </button>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 sm:px-8">
        {escolhendo ? (
          <EscolherPacote
            pacotes={pacotesAtivos.map((p) => ({
              id: p.id,
              nome: p.nome,
              descricao: p.descricao,
              frases: frasesParaCliente(config, p, pacoteParaCenario(p)),
              mensalCentavos: precoDoPacote(config, p).mensalCentavos,
            }))}
            aoEscolher={escolherPacote}
            aoMontarDoZero={() => {
              setEstado({ cenario: { ...novoCenario("Proposta"), clienteId: cen.clienteId }, desligados: {} });
              setEscolhendo(false);
            }}
          />
        ) : vPacote ? (
          <>
            <VistaPacoteCliente
              vista={vPacote}
              personalizando={personalizando}
              aoPersonalizar={() => setPersonalizando(!personalizando)}
              aoMudarQuantidade={mudarQuantidade}
            />
            {pacotesAtivos.length > 0 && (
              <button type="button" onClick={() => setEscolhendo(true)} className="self-start text-xs font-semibold text-texto-suave underline hover:text-texto">
                Trocar de pacote
              </button>
            )}
          </>
        ) : (
          <>
            <VistaCliente vista={vista} aoMudarQuantidade={mudarQuantidade} aoAlternarServico={trocarServico} />
            {pacotesAtivos.length > 0 && (
              <button type="button" onClick={() => setEscolhendo(true)} className="self-start text-xs font-semibold text-texto-suave underline hover:text-texto">
                Escolher um pacote
              </button>
            )}
          </>
        )}

        {garantia && <BlocoGarantia g={garantia} />}

        <section className="flex flex-col gap-3 rounded-card border border-linha bg-superficie p-5 shadow-card">
          {temTrafego && (
            <Interruptor
              ligado={cen.trafego.modelo === "garantia"}
              rotulo="Tráfego com garantia (a gestão só é cobrada depois do resultado)"
              aoMudar={(v) => setEstado({ ...estado, cenario: { ...cen, trafego: { ...cen.trafego, modelo: v ? "garantia" : null } } })}
            />
          )}
          <div className="flex flex-wrap items-end gap-3">
            <CampoMoeda className="w-full sm:w-56" rotulo="Só tenho" valor={soTenho} aoMudar={setSoTenho} />
            <Botao icone={HandCoins} disabled={!soTenho} onClick={montarPeloValor}>
              Montar o pacote que cabe
            </Botao>
            {cen.modo === "valor" && (
              <Botao variante="fantasma" onClick={valorSeguePacote}>
                Voltar: o valor segue o pacote
              </Botao>
            )}
            <span className="flex-1" />
            {volta && cen.clienteId ? (
              <Botao icone={Save} disabled={guardando} onClick={guardarComoEscopo}>
                Guardar no escopo de {config.clientes.find((c) => c.id === cen.clienteId)?.nome ?? "cliente"}
              </Botao>
            ) : (
              <Botao icone={Save} onClick={salvarVersao}>
                Guardar esta versão
              </Botao>
            )}
            <Botao variante="primario" icone={FileDown} disabled={valor == null} onClick={exportar}>
              {liberado ? "Exportar PDF" : pendente ? "Esperando aprovação" : "Exportar PDF (precisa de aprovação)"}
            </Botao>
          </div>
          {aviso && <p className="text-xs font-semibold text-texto-suave">{aviso}</p>}
          {versoes.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-bold tracking-wide text-texto-suave uppercase">Versões</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {versoes.map((v) => {
                  const vv = vistaApresentacao(config, v.estado);
                  const itens = vv.servicos.filter((s) => s.ligado).flatMap((s) => s.itens.filter((i) => i.quantidade > 0));
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setEstado(structuredClone(v.estado))}
                      className={cx("flex flex-col gap-1 rounded-bloco border p-3 text-left transition-colors hover:border-marca", "border-linha bg-superficie-2/50")}
                    >
                      <span className="text-xs font-bold">{v.nome}</span>
                      <span className="numero text-xl font-extrabold">{vv.valorCentavos != null ? formatarMoeda(vv.valorCentavos) : "—"}</span>
                      <span className="text-[11px] text-texto-suave">{itens.map((i) => `${i.quantidade} ${i.nome}`).join(" · ") || "sem entregas"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {config.clientes.some((c) => c.ativo) && (
            <Selecao
              className="max-w-xs"
              rotulo="Cliente já ativo (opcional)"
              valor={cen.clienteId}
              vazio="Cliente novo"
              opcoes={config.clientes.filter((c) => c.ativo).map((c) => ({ valor: c.id, rotulo: c.nome }))}
              aoMudar={(v) => {
                setEstado({ ...estado, cenario: { ...cen, clienteId: v } });
                if (v) setNomeCliente(config.clientes.find((c) => c.id === v)?.nome ?? nomeCliente);
              }}
            />
          )}
        </section>
      </main>
    </div>
  );
}
