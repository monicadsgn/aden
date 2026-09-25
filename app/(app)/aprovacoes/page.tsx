"use client";

import { Check, CheckCircle2, Clock, ShieldCheck, Undo2, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Botao, Card, Selecao, TituloCard, Vazio, cx, type Tom } from "@/components/ui";
import { configVazia } from "@/lib/calculo/novo";
import type { Configuracao } from "@/lib/calculo/tipos";
import { descreverItem } from "@/lib/dados/acoes";
import { useDados } from "@/lib/dados/contexto";
import type { Pedido, StatusPedido } from "@/lib/dados/repositorio";
import { formatarMoeda } from "@/lib/formato";
import { aplicarItens, impactoNoBolso, REGRAS_PROTECAO } from "@/lib/regras/aprovacao";

const STATUS: Record<StatusPedido, { tom: Tom; rotulo: string; icone: typeof Clock }> = {
  pendente: { tom: "aviso", rotulo: "esperando aprovação", icone: Clock },
  aplicado: { tom: "ok", rotulo: "valeu", icone: CheckCircle2 },
  recusado: { tom: "erro", rotulo: "recusado", icone: XCircle },
  cancelado: { tom: "neutro", rotulo: "cancelado", icone: Undo2 },
};

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

export default function Aprovacoes() {
  const { repo, usuario } = useDados();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [como, setComo] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const local = repo.modo === "local";

  const carregar = useCallback(async () => {
    try {
      const c = await repo.carregarConfig();
      setConfig(c);
      setPedidos(await repo.listarPedidos());
      setComo((x) => x ?? c.pessoas.find((p) => p.socio && p.ativo)?.id ?? null);
    } catch (e) {
      setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao carregar." });
    } finally {
      setCarregado(true);
    }
  }, [repo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void carregar();
  }, [carregar]);

  const eu = local ? como : (usuario?.pessoaId ?? null);
  const nome = useCallback((id: string | null) => config.pessoas.find((p) => p.id === id)?.nome ?? "sócio", [config]);
  const falta = (p: Pedido) => p.afetados.filter((a) => !p.aprovacoes.some((x) => x.pessoaId === a));

  const grupos = useMemo(() => {
    const pend = pedidos.filter((p) => p.status === "pendente");
    return {
      meus: pend.filter((p) => eu != null && falta(p).includes(eu)),
      outros: pend.filter((p) => eu == null || !falta(p).includes(eu)),
      historico: pedidos.filter((p) => p.status !== "pendente"),
    };
  }, [pedidos, eu]);

  const decidir = async (p: Pedido, decisao: "aprovado" | "recusado") => {
    let motivo: string | null = null;
    if (decisao === "recusado") {
      motivo = prompt("Por que recusar? (opcional, fica no histórico)") ?? null;
    } else if (!confirm(`Aprovar "${p.descricao}"?`)) return;
    try {
      const st = await repo.decidirPedido(p.id, decisao, motivo, eu ?? undefined);
      if (p.autorPessoaId && p.autorPessoaId !== eu)
        await repo.criarAvisos([
          {
            pessoaId: p.autorPessoaId,
            titulo: decisao === "aprovado" ? "Seu pedido foi aprovado" : "Seu pedido foi recusado",
            texto: `${nome(eu)} ${decisao === "aprovado" ? "aprovou" : "recusou"}: ${p.descricao}.${motivo ? ` Motivo: ${motivo}` : ""}${st === "aplicado" ? " Já está valendo." : ""}`,
            impactoCentavos: null,
            autorNome: nome(eu),
            pedidoId: p.id,
          },
        ]);
      await carregar();
      setMensagem({
        tom: "ok",
        texto: st === "aplicado" ? "Aprovado. A mudança já está valendo." : st === "recusado" ? "Recusado. Continua valendo o valor antigo." : st === "cancelado" ? "Os valores mudaram desde o pedido; ele foi cancelado." : "Aprovado. Falta a aprovação do outro sócio afetado.",
      });
    } catch (e) {
      setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao decidir." });
    }
  };

  const renderPedidos = (lista: Pedido[], podeDecidir: boolean) => (
    <div className="flex flex-col gap-3">
      {lista.map((p) => {
        const st = STATUS[p.status];
        const impacto = p.tipo === "campos" ? impactoNoBolso(config, aplicarItens(config, p.itens)) : null;
        return (
          <div key={p.id} className={cx("flex flex-col gap-2 rounded-bloco border p-4", p.status === "pendente" ? "border-aviso/40" : "border-linha")}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-sm font-bold">{p.descricao}</p>
              <Badge tom={st.tom} icone={st.icone}>
                {st.rotulo}
              </Badge>
            </div>
            <p className="text-[11px] text-texto-suave">
              Pedido por {p.autorNome ?? "—"} em {quando(p.criadoEm)}
              {p.decididoEm && ` · decidido em ${quando(p.decididoEm)}`}
            </p>
            {p.itens.length > 0 && (
              <ul className="flex flex-col gap-1 text-[12px]">
                {p.itens.map((i) => (
                  <li key={`${i.registroId}-${i.campo}-${i.pessoaId ?? ""}`} className="rounded-item bg-superficie-2/70 px-3 py-1.5">
                    {descreverItem(i)}
                  </li>
                ))}
              </ul>
            )}
            {p.dados && (
              <div className="rounded-item bg-superficie-2/70 px-3 py-2 text-[12px]">
                <p>
                  Valor: <strong className="numero">{formatarMoeda(p.dados.valorCentavos)}</strong>
                  {p.dados.aplicar === "escopo" ? " · ao aprovar, vira o escopo contratado do cliente" : " · ao aprovar, libera a proposta"}
                </p>
                {p.dados.perdas.map((x) => (
                  <p key={x.pessoaId} className="text-erro">
                    {x.nome} fica {formatarMoeda(x.perdaMensalCentavos)} por mês abaixo do piso.
                  </p>
                ))}
              </div>
            )}
            {impacto && p.status === "pendente" && (
              <p className="text-[12px]">
                <strong>No bolso, por mês, com os clientes de hoje:</strong>{" "}
                {config.pessoas
                  .filter((x) => x.socio && x.ativo)
                  .map((x) => `${x.nome} ${(impacto[x.id] ?? 0) >= 0 ? "+" : "−"}${formatarMoeda(Math.abs(impacto[x.id] ?? 0))}`)
                  .join(" · ")}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-texto-suave">Afetados:</span>
              {p.afetados.map((a) => {
                const d = p.aprovacoes.find((x) => x.pessoaId === a);
                return (
                  <Badge key={a} tom={d ? (d.decisao === "aprovado" ? "ok" : "erro") : "neutro"} icone={d ? (d.decisao === "aprovado" ? Check : X) : Clock}>
                    {nome(a)}
                    {d ? (d.automatica ? " (pediu, vale como aprovação)" : ` · ${d.decisao}`) : " · falta decidir"}
                  </Badge>
                );
              })}
            </div>
            {p.motivo && <p className="text-[11px] text-texto-suave">Motivo: {p.motivo}</p>}
            {p.status === "pendente" && (
              <div className="flex flex-wrap gap-2">
                {podeDecidir && (
                  <>
                    <Botao pequeno variante="primario" icone={Check} onClick={() => decidir(p, "aprovado")}>
                      Aprovar
                    </Botao>
                    <Botao pequeno variante="perigo" icone={X} onClick={() => decidir(p, "recusado")}>
                      Recusar
                    </Botao>
                  </>
                )}
                {(local || p.autorNome === usuario?.nome) && (
                  <Botao
                    pequeno
                    variante="fantasma"
                    icone={Undo2}
                    onClick={async () => {
                      if (!confirm("Desistir deste pedido?")) return;
                      try {
                        await repo.cancelarPedido(p.id);
                        await carregar();
                      } catch (e) {
                        setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao cancelar." });
                      }
                    }}
                  >
                    Desistir do pedido
                  </Botao>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  if (!carregado) return null;

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={ShieldCheck}
        selo="Sócios"
        titulo="Aprovações"
        descricao="Mudanças no que protege a remuneração dos sócios e exceções abaixo do piso. Só valem depois que o sócio afetado aprova. Nada aqui se apaga."
      />
      <div className="mx-auto flex max-w-[1000px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <p className="rounded-card border border-marca/30 bg-marca-tinta px-4 py-3 text-xs leading-relaxed">{REGRAS_PROTECAO}</p>
        {mensagem && <p className={cx("px-1 text-xs font-semibold", mensagem.tom === "erro" ? "text-erro" : "text-ok")}>{mensagem.texto}</p>}
        {local && (
          <Selecao
            className="max-w-xs"
            rotulo="Modo demonstração: decidir como"
            valor={como}
            opcoes={config.pessoas.filter((p) => p.socio && p.ativo).map((p) => ({ valor: p.id, rotulo: p.nome }))}
            aoMudar={setComo}
          />
        )}
        {!local && usuario?.pessoaId == null && (
          <p className="rounded-card bg-aviso-suave px-4 py-3 text-xs text-aviso">
            Seu login não está ligado a um sócio, então você não aprova nada. Ligue em Configurações → Sócios → Login deste sócio.
          </p>
        )}

        <Card>
          <TituloCard icone={Clock} titulo="Esperando você" descricao="Até você decidir, vale o valor antigo." />
          <div className="px-5 pb-5">
            {grupos.meus.length === 0 ? <p className="text-xs text-texto-suave">Nada esperando por você.</p> : renderPedidos(grupos.meus, true)}
          </div>
        </Card>

        <Card>
          <TituloCard icone={Clock} titulo="Esperando o outro sócio" />
          <div className="px-5 pb-5">
            {grupos.outros.length === 0 ? <p className="text-xs text-texto-suave">Nenhum pedido esperando.</p> : renderPedidos(grupos.outros, false)}
          </div>
        </Card>

        <Card>
          <TituloCard icone={ShieldCheck} titulo="Histórico de decisões" descricao="Quem pediu, quem aprovou, antes e depois. Não pode ser editado nem apagado." />
          <div className="px-5 pb-5">
            {grupos.historico.length === 0 ? (
              <Vazio icone={ShieldCheck} titulo="Nenhuma decisão ainda" />
            ) : (
              renderPedidos(grupos.historico, false)
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
