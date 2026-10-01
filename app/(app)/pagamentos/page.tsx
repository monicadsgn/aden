"use client";

import { AlertOctagon, CheckCircle2, Clock, Plus, Trash2, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Botao, Card, CampoMoeda, CampoTexto, Rotulo, Selecao, TituloCard, Vazio, cx } from "@/components/ui";
import { configVazia, novoId } from "@/lib/calculo/novo";
import { distribuirPagamentos, type Pagamento } from "@/lib/calculo/pagamentos";
import { clienteNoMes } from "@/lib/calculo/clientes";
import type { Configuracao } from "@/lib/calculo/tipos";
import { SITUACAO } from "@/components/financeiro";
import { calcularMesDeCima } from "@/lib/calculo/sociedade";
import Link from "next/link";
import { useDados } from "@/lib/dados/contexto";
import { competenciaAtual } from "@/lib/dados/repositorio";
import { formatarMoeda } from "@/lib/formato";

const hoje = () => new Date().toISOString().slice(0, 10);

export default function Pagamentos() {
  const { repo, usuario } = useDados();
  // contador: só lê os pagamentos (médio 13); não registra, não apaga e não vê a divisão entre sócios
  const soLeitura = usuario?.papel === "contador";
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [competencia, setCompetencia] = useState(competenciaAtual);
  const [novo, setNovo] = useState<{ clienteId: string | null; competencia: string; valor: number | null; data: string; obs: string; taxa: number | null }>(() => ({
    clienteId: null,
    competencia: competenciaAtual(),
    valor: null,
    data: hoje(),
    obs: "",
    taxa: null,
  }));
  const [carregado, setCarregado] = useState(false);
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  const recarregar = useCallback(async () => setPagamentos(await repo.listarPagamentos()), [repo]);
  useEffect(() => {
    (async () => {
      try {
        setConfig(await repo.carregarConfig());
        await recarregar();
        // links de outras telas trazem o cliente e o mês junto (médio 10)
        const q = new URLSearchParams(window.location.search);
        const cliente = q.get("cliente");
        const mes = q.get("mes");
        const mesValido = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : null;
        if (cliente || mesValido) setNovo((n) => ({ ...n, clienteId: cliente ?? n.clienteId, competencia: mesValido ?? n.competencia }));
        if (mesValido) setCompetencia(mesValido);
      } catch (e) {
        setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao carregar." });
      } finally {
        setCarregado(true);
      }
    })();
  }, [repo, recarregar]);

  const ativos = useMemo(() => config.clientes.filter((c) => c.ativo && !c.interno), [config]);
  const clienteNovo = config.clientes.find((c) => c.id === novo.clienteId);

  // prévia (M8, 01/10/2026): a divisão e o caixa contam pelo mês em que o dinheiro ENTRA (a data), pela regra da
  // sociedade; mostra quanto muda a parte de cada sócio com este pagamento
  const previa = useMemo(() => {
    if (!clienteNovo || !novo.valor || novo.valor <= 0) return null;
    const p: Pagamento = { id: "previa", clienteId: clienteNovo.id, competencia: novo.competencia, valorCentavos: novo.valor, recebidoEm: novo.data, criadoEm: "9999", taxaCentavos: novo.taxa };
    const mes = novo.data.slice(0, 7);
    const antes = calcularMesDeCima(config, pagamentos, mes);
    const depois = calcularMesDeCima(config, [...pagamentos, p], mes);
    return {
      mes,
      entrou: depois.entrouCentavos,
      socios: depois.socios.map((s) => ({ ...s, antes: antes.socios.find((x) => x.pessoaId === s.pessoaId)?.parteCentavos ?? 0 })),
      trafego: { antes: antes.trafegoProprioCentavos, depois: depois.trafegoProprioCentavos },
      semRegra: depois.divisao === "sem_regra",
      atrasado: novo.data.slice(0, 7) > novo.competencia,
    };
  }, [clienteNovo, novo, pagamentos, config]);
  const nomeMes = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

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
        taxaCentavos: novo.taxa,
      });
      await recarregar();
      setNovo({ ...novo, valor: null, obs: "", taxa: null });
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
        selo="Dinheiro e mês"
        titulo="Pagamentos"
        descricao="Cada pagamento que cai, mesmo atrasado ou em pedaços. A divisão dos sócios e o caixa contam pelo mês em que o dinheiro entra; o mês que ele paga mostra quem ainda deve."
      />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {mensagem && <p className={cx("px-1 text-xs font-semibold", mensagem.tom === "erro" ? "text-erro" : "text-ok")}>{mensagem.texto}</p>}

        {soLeitura && (
          <p className="rounded-card bg-info-suave px-4 py-3 text-xs font-medium text-info">
            Você vê os pagamentos só para consulta. Para registrar ou corrigir um pagamento, fale com os sócios.
          </p>
        )}

        {!soLeitura && (
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
                  <CampoMoeda className="sm:max-w-xs" rotulo="Taxa deste pagamento (só se foi cartão)" valor={novo.taxa} aoMudar={(v) => setNovo({ ...novo, taxa: v })} />
                  <p className="mt-1 text-[12px] text-texto-suave">Vazio = taxa padrão das Regras (Pix não cobra). Preencha com o que o banco descontou de verdade; o padrão não muda.</p>
                </div>
                <div className="sm:col-span-2">
                  <Botao variante="primario" icone={Plus} disabled={!clienteNovo || !novo.valor} onClick={registrar}>
                    Registrar pagamento
                  </Botao>
                </div>
              </div>
              <div className="rounded-bloco bg-marca-tinta/60 p-4">
                <p className="mb-2 text-xs font-bold">Para onde vai este pagamento</p>
                {!previa && <p className="text-[12px] text-texto-suave">Escolha o cliente e digite o valor para ver a divisão.</p>}
                {previa && !soLeitura && (
                  <div className="flex flex-col gap-2 text-[13px]">
                    <p className="text-[12px] text-texto-suave">
                      Entra na divisão de <strong>{nomeMes(previa.mes)}</strong>, o mês em que o dinheiro caiu. Com ele, entrou {formatarMoeda(previa.entrou)} no mês.
                      {previa.atrasado && " Ele paga um mês anterior: isso só tira o cliente da lista de quem deve."}
                    </p>
                    {previa.semRegra ? (
                      <p className="rounded-item bg-aviso-suave px-3 py-2 text-[12px] text-aviso">
                        A regra da sociedade ainda não está preenchida (Configurações → Regras da empresa): sem ela não dá para dividir.
                      </p>
                    ) : (
                      <>
                        {previa.socios.map((s) => (
                          <div key={s.pessoaId} className="flex flex-wrap items-baseline gap-2">
                            <span className="flex-1 font-semibold">{s.nome}</span>
                            <span className="numero">
                              {formatarMoeda(s.antes)} → <strong>{formatarMoeda(s.parteCentavos)}</strong>
                            </span>
                          </div>
                        ))}
                        {previa.trafego.depois !== previa.trafego.antes && (
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="flex-1">Tráfego da Aden</span>
                            <span className="numero">
                              {formatarMoeda(previa.trafego.antes)} → <strong>{formatarMoeda(previa.trafego.depois)}</strong>
                            </span>
                          </div>
                        )}
                        <Link href="/mes?aba=cima" className="text-[12px] font-semibold text-marca-forte underline">
                          Ver a divisão do mês inteiro
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold">Quem está devendo</h2>
            <p className="text-[12px] text-texto-suave">
              Pelo mês de referência (o mês que o cliente está pagando). A divisão dos sócios e o caixa contam pelo mês em que o dinheiro entrou:{" "}
              <Link href="/mes?aba=cima" className="font-semibold text-marca-forte underline">
                Mês → Visto de cima
              </Link>
              .
            </p>
          </div>
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
                {doCliente.map((p) => {
                  const parte = d.partes.find((x) => x.pagamentoId === p.id);
                  return (
                    <details key={p.id} className="rounded-bloco bg-superficie-2/60 px-3 py-2">
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[13px]">
                        <span className="numero font-bold">{formatarMoeda(p.valorCentavos)}</span>
                        <span className="text-texto-suave">em {new Date(`${p.recebidoEm}T12:00:00`).toLocaleDateString("pt-BR")}</span>
                        {parte?.atrasado && <Badge tom="erro">caiu atrasado</Badge>}
                        {p.observacao && <span className="text-[11px] text-texto-suave">· {p.observacao}</span>}
                        {p.taxaCentavos != null && <span className="text-[11px] text-texto-suave">· taxa {formatarMoeda(p.taxaCentavos)}</span>}
                        <span className="flex-1" />
                        {!soLeitura && (
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
                        )}
                      </summary>
                    </details>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
