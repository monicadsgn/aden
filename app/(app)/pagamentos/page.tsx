"use client";

import { AlertOctagon, CheckCircle2, Clock, Plus, Trash2, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BotaoAcao, OQueQuerDizer } from "@/components/Alertas";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Botao, Card, CampoMoeda, CampoTexto, Rotulo, Selecao, TituloCard, Vazio, cx } from "@/components/ui";
import { configVazia, novoId } from "@/lib/calculo/novo";
import { distribuirPagamentos, type Pagamento } from "@/lib/calculo/pagamentos";
import { clienteNoMes } from "@/lib/calculo/clientes";
import type { Configuracao } from "@/lib/calculo/tipos";
import { Destinos, SITUACAO } from "@/components/financeiro";
import { useDados } from "@/lib/dados/contexto";
import { competenciaAtual } from "@/lib/dados/repositorio";
import { formatarMoeda } from "@/lib/formato";

const hoje = () => new Date().toISOString().slice(0, 10);

export default function Pagamentos() {
  const { repo } = useDados();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [competencia, setCompetencia] = useState(competenciaAtual);
  const [novo, setNovo] = useState<{ clienteId: string | null; competencia: string; valor: number | null; data: string; obs: string }>(() => ({
    clienteId: null,
    competencia: competenciaAtual(),
    valor: null,
    data: hoje(),
    obs: "",
  }));
  const [carregado, setCarregado] = useState(false);
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  const recarregar = useCallback(async () => setPagamentos(await repo.listarPagamentos()), [repo]);
  useEffect(() => {
    (async () => {
      try {
        setConfig(await repo.carregarConfig());
        await recarregar();
      } catch (e) {
        setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao carregar." });
      } finally {
        setCarregado(true);
      }
    })();
  }, [repo, recarregar]);

  const ativos = useMemo(() => config.clientes.filter((c) => c.ativo && !c.interno), [config]);
  const clienteNovo = config.clientes.find((c) => c.id === novo.clienteId);

  // prévia: para onde vai este pagamento, somado aos que já caíram no mesmo mês
  const previa = useMemo(() => {
    if (!clienteNovo || !novo.valor || novo.valor <= 0) return null;
    const p: Pagamento = { id: "previa", clienteId: clienteNovo.id, competencia: novo.competencia, valorCentavos: novo.valor, recebidoEm: novo.data, criadoEm: "9999" };
    const d = distribuirPagamentos(config, clienteNovo, novo.competencia, [...pagamentos, p], hoje());
    return { d, parte: d.partes.find((x) => x.pagamentoId === "previa") ?? null };
  }, [clienteNovo, novo, pagamentos, config]);

  const registrar = async () => {
    if (!clienteNovo || !novo.valor || novo.valor <= 0) return;
    try {
      await repo.salvarPagamento({
        id: novoId(),
        clienteId: clienteNovo.id,
        competencia: novo.competencia,
        valorCentavos: novo.valor,
        recebidoEm: novo.data,
        observacao: novo.obs || null,
      });
      await recarregar();
      setNovo({ ...novo, valor: null, obs: "" });
      setMensagem({ tom: "ok", texto: `Pagamento de ${formatarMoeda(novo.valor)} de ${clienteNovo.nome} registrado. Ficou no histórico.` });
    } catch (e) {
      setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao registrar." });
    }
  };

  const distribuicoes = useMemo(() => ativos.filter((c) => clienteNoMes(c, competencia)).map((c) => distribuirPagamentos(config, c, competencia, pagamentos, hoje())), [ativos, config, competencia, pagamentos]);

  if (!carregado) return null;

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={Wallet}
        selo="Financeiro"
        titulo="Registrar pagamento"
        descricao="Cada pagamento que cai, mesmo atrasado ou em pedaços. O sistema mostra na hora para onde vai cada real: custos, imposto, reinvestimento e cada sócio."
      />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {mensagem && <p className={cx("px-1 text-xs font-semibold", mensagem.tom === "erro" ? "text-erro" : "text-ok")}>{mensagem.texto}</p>}

        <Card>
          <TituloCard icone={Plus} titulo="Caiu um pagamento" descricao="Mês de referência = o mês que o cliente está pagando (pode ser um mês atrasado)." />
          <div className="grid gap-4 px-5 pb-5 lg:grid-cols-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <Selecao
                className="sm:col-span-2"
                rotulo="Cliente"
                valor={novo.clienteId}
                vazio="Escolha o cliente…"
                opcoes={ativos.map((c) => ({ valor: c.id, rotulo: c.nome }))}
                aoMudar={(v) => setNovo({ ...novo, clienteId: v })}
              />
              <div>
                <Rotulo>Mês de referência</Rotulo>
                <input
                  type="month"
                  value={novo.competencia}
                  onChange={(e) => e.target.value && setNovo({ ...novo, competencia: e.target.value })}
                  className="h-10 w-full rounded-campo border border-linha bg-superficie px-3 text-sm focus:border-marca focus:outline-none"
                />
              </div>
              <div>
                <Rotulo>Data em que caiu</Rotulo>
                <input
                  type="date"
                  value={novo.data}
                  onChange={(e) => e.target.value && setNovo({ ...novo, data: e.target.value })}
                  className="h-10 w-full rounded-campo border border-linha bg-superficie px-3 text-sm focus:border-marca focus:outline-none"
                />
              </div>
              <CampoMoeda rotulo="Valor que caiu" valor={novo.valor} aoMudar={(v) => setNovo({ ...novo, valor: v })} />
              <CampoTexto rotulo="Observação (opcional)" valor={novo.obs} aoMudar={(v) => setNovo({ ...novo, obs: v })} />
              <div className="sm:col-span-2">
                <Botao variante="primario" icone={Plus} disabled={!clienteNovo || !novo.valor} onClick={registrar}>
                  Registrar pagamento
                </Botao>
              </div>
            </div>
            <div className="rounded-bloco bg-marca-tinta/60 p-4">
              <p className="mb-2 text-xs font-bold">Para onde vai este pagamento</p>
              {!previa && <p className="text-[11px] text-texto-suave">Escolha o cliente e digite o valor para ver a divisão.</p>}
              {previa?.d.bloqueio && (
                <div className="flex flex-col gap-2 rounded-item bg-erro-suave px-3 py-2 text-xs font-medium text-erro">
                  <span>{previa.d.bloqueio.texto}</span>
                  <div>
                    <BotaoAcao a={previa.d.bloqueio} />
                  </div>
                  <OQueQuerDizer explica={previa.d.bloqueio.explica} />
                </div>
              )}
              {previa?.parte && (
                <>
                  <Destinos b={previa.parte} config={config} />
                  <p className="mt-2 text-[11px] text-texto-suave">
                    {config.empresa.ordemDistribuicao === "custo_primeiro"
                      ? "Custo primeiro: enquanto os custos do mês não estão cobertos, o dinheiro vai para eles."
                      : "Proporcional: cada real vai para custos e sócios na mesma proporção do mês inteiro."}
                    {previa.parte.atrasado && " Este pagamento chegou depois do mês de referência: fica marcado como atrasado."}
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex-1 text-base font-bold">Pagamentos do mês</h2>
          <input
            type="month"
            aria-label="Mês de referência"
            value={competencia}
            onChange={(e) => e.target.value && setCompetencia(e.target.value)}
            className="h-10 rounded-campo border border-linha bg-superficie px-3 text-sm focus:border-marca focus:outline-none"
          />
        </div>

        {ativos.length === 0 && (
          <Vazio icone={Wallet} titulo="Nenhum cliente ativo">
            Cadastre os clientes em Configurações.
          </Vazio>
        )}

        {distribuicoes.map((d) => {
          const st = SITUACAO[d.situacao];
          const doCliente = pagamentos.filter((p) => p.clienteId === d.clienteId && p.competencia === competencia);
          return (
            <Card key={d.clienteId} className={cx(d.situacao === "atrasado" && "border-erro/40")}>
              <div className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="flex-1 text-sm font-bold">{d.nome}</h3>
                  <Badge tom={st.tom} icone={d.situacao === "atrasado" ? AlertOctagon : d.situacao === "pago" ? CheckCircle2 : Clock}>
                    {st.rotulo}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <p className="text-[10px] font-semibold text-texto-suave">Contrato do mês</p>
                    <p className="numero font-bold">{formatarMoeda(d.contratoCentavos)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-texto-suave">Já entrou</p>
                    <p className="numero font-bold">{formatarMoeda(d.recebidoCentavos)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-texto-suave">Falta</p>
                    <p className={cx("numero font-bold", d.situacao === "atrasado" && "text-erro")}>{formatarMoeda(d.faltaReceberCentavos)}</p>
                  </div>
                </div>
                {d.bloqueio && (
                  <div className="flex flex-wrap items-center gap-2 rounded-item bg-erro-suave px-3 py-2 text-xs font-medium text-erro">
                    <span className="flex-1">{d.bloqueio.texto}</span>
                    <BotaoAcao a={d.bloqueio} />
                    <OQueQuerDizer explica={d.bloqueio.explica} />
                  </div>
                )}
                {doCliente.map((p) => {
                  const parte = d.partes.find((x) => x.pagamentoId === p.id);
                  return (
                    <details key={p.id} className="rounded-bloco bg-superficie-2/60 px-3 py-2">
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[13px]">
                        <span className="numero font-bold">{formatarMoeda(p.valorCentavos)}</span>
                        <span className="text-texto-suave">em {new Date(`${p.recebidoEm}T12:00:00`).toLocaleDateString("pt-BR")}</span>
                        {parte?.atrasado && <Badge tom="erro">caiu atrasado</Badge>}
                        {p.observacao && <span className="text-[11px] text-texto-suave">· {p.observacao}</span>}
                        <span className="flex-1" />
                        <Botao
                          pequeno
                          variante="perigo"
                          icone={Trash2}
                          aria-label="Apagar pagamento"
                          onClick={async (e) => {
                            e.preventDefault();
                            if (!confirm("Apagar este pagamento? A exclusão fica no histórico.")) return;
                            await repo.removerPagamento(p.id);
                            await recarregar();
                          }}
                        />
                      </summary>
                      {parte && (
                        <div className="mt-2">
                          <Destinos b={parte} config={config} />
                        </div>
                      )}
                    </details>
                  );
                })}
                {!d.bloqueio && d.recebidoCentavos > 0 && (
                  <details className="text-[12px]">
                    <summary className="cursor-pointer font-semibold text-texto-suave">Total do mês até agora, por destino</summary>
                    <div className="mt-2">
                      <Destinos b={d.totais} config={config} />
                    </div>
                  </details>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
