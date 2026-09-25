"use client";

import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  HeartPulse,
  Info,
  Lightbulb,
  Save,
  Scissors,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BotaoAcao } from "@/components/Alertas";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Botao, Card, CampoMoeda, CampoNumero, EtiquetaOrigem, Vazio, cx } from "@/components/ui";
import { calcularCalibragem, type CalibragemTipo } from "@/lib/calculo/calibragem";
import { calcularSaudeCliente, rotuloOrigemHoras, type RegistroMesCliente, type SaudeCliente } from "@/lib/calculo/mes";
import { configVazia } from "@/lib/calculo/novo";
import { somaPagamentos, type Pagamento } from "@/lib/calculo/pagamentos";
import { calcularSolucoes, type SolucoesSaude } from "@/lib/calculo/solucoes";
import type { Cenario, ClienteBase, Configuracao } from "@/lib/calculo/tipos";
import { assinaturaProposta } from "@/lib/dados/acoes";
import { useDados } from "@/lib/dados/contexto";
import { competenciaAtual, type Pedido } from "@/lib/dados/repositorio";
import { formatarHoras, formatarMoeda, formatarNumero } from "@/lib/formato";
import { enviarCenario } from "@/lib/navegacao";

const vazio = (): RegistroMesCliente => ({ valorRecebidoCentavos: null, horas: {} });

const ORIGEM_VALOR = {
  pagamentos: "pagamentos registrados",
  manual: "lançado à mão",
  contrato: "valor do contrato",
} as const;

function Abrir({ c, nome, aoAbrir }: { c: Cenario; nome: string; aoAbrir: (c: Cenario, nome: string) => void }) {
  return (
    <button type="button" onClick={() => aoAbrir(c, nome)} className="inline-flex shrink-0 items-center gap-1 rounded-botao bg-marca px-2.5 py-1 text-[11px] font-bold text-sobre-marca hover:bg-marca-forte">
      Abrir na calculadora <ArrowRight size={12} />
    </button>
  );
}

function Solucoes({
  sol,
  cliente,
  pedidos,
  nomePessoa,
  aoAbrir,
  aoPedirExcecao,
}: {
  sol: SolucoesSaude;
  cliente: ClienteBase;
  pedidos: Pedido[];
  nomePessoa: (id: string) => string;
  aoAbrir: (c: Cenario, nome: string) => void;
  aoPedirExcecao: () => void;
}) {
  if (!sol.temProblema) return null;
  const assinatura = sol.cenarioBase ? assinaturaProposta(sol.cenarioBase, cliente.valorMensalCentavos) : null;
  const excecao = pedidos.find((p) => p.tipo === "excecao" && p.assinatura === assinatura && p.status !== "cancelado");
  return (
    <div className="flex flex-col gap-2 rounded-bloco border border-marca/30 bg-marca-tinta/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold">
        <Lightbulb size={14} /> Caminhos para sair do piso, calculados com os números {sol.base === "real" ? "reais do mês" : "do contrato"}
      </p>
      {sol.faltando.length > 0 && (
        <p className="rounded-item bg-aviso-suave px-3 py-2 text-[11px] font-medium text-aviso">
          Para calcular {sol.cenarioBase ? "tudo" : "os caminhos"}, falta: {sol.faltando.join("; ")}.
        </p>
      )}
      {sol.subir && (
        <div className="flex flex-wrap items-center gap-2 rounded-item bg-superficie px-3 py-2 text-xs">
          <TrendingUp size={15} className="shrink-0 text-marca-forte" />
          <span className="min-w-0 flex-1 basis-56">
            <strong>Subir o valor:</strong> para chegar no piso, a mensalidade precisa ser <strong className="numero">{formatarMoeda(sol.subir.mensalidadeCentavos)}</strong> (
            {formatarMoeda(sol.subir.aMaisCentavos)} a mais).
          </span>
          <Abrir aoAbrir={aoAbrir} c={sol.subir.cenario} nome={`${cliente.nome}: subir o valor`} />
        </div>
      )}
      {sol.cortar.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-item bg-superficie px-3 py-2 text-xs">
          <p className="flex items-center gap-2">
            <Scissors size={15} className="shrink-0 text-marca-forte" />
            <span>
              <strong>Cortar escopo:</strong> mantendo o valor de {formatarMoeda(cliente.valorMensalCentavos)}, cabe no piso tirando:
            </span>
          </p>
          {sol.cortar.map((c) => (
            <div key={c.tipoEntregaId} className="flex flex-wrap items-center gap-2 pl-6">
              <span className="flex-1">
                {c.tirar} {c.nome}
              </span>
              <Abrir aoAbrir={aoAbrir} c={c.cenario} nome={c.cenario.nome} />
            </div>
          ))}
          <p className="pl-6 text-[10px] text-texto-suave">É um ou outro (não a soma). Mesmo cálculo do “o que cabe” da calculadora.</p>
        </div>
      )}
      {sol.corteSozinhoNaoResolve && (
        <p className="rounded-item bg-superficie px-3 py-2 text-[11px] text-texto-suave">Nenhum corte de um tipo só resolve: combine cortes na calculadora ou suba o valor.</p>
      )}
      {sol.misto.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-item bg-superficie px-3 py-2 text-xs">
          <p>
            <strong>Misto:</strong> subir um pouco e cortar um pouco.
          </p>
          {sol.misto.map((m) => (
            <div key={m.tipoEntregaId} className="flex flex-wrap items-center gap-2">
              <span className="flex-1">
                Tirar {m.tirar} {m.nome} e cobrar <strong className="numero">{formatarMoeda(m.mensalidadeCentavos)}</strong> ({formatarMoeda(m.aMaisCentavos)} a mais)
              </span>
              <Abrir aoAbrir={aoAbrir} c={m.cenario} nome={m.cenario.nome} />
            </div>
          ))}
        </div>
      )}
      {sol.excecao.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-item bg-superficie px-3 py-2 text-xs">
          <ShieldAlert size={15} className="shrink-0 text-aviso" />
          <span className="min-w-0 flex-1 basis-56">
            <strong>Aceitar a exceção:</strong> deixar como está custa{" "}
            {sol.excecao.map((x, i) => (
              <span key={x.pessoaId}>
                {i > 0 && " e "}
                {formatarMoeda(x.perdaMensalCentavos)} por mês para {x.nome}
              </span>
            ))}
            . Só vale com a aprovação de {sol.excecao.map((x) => x.nome).join(" e ")}.
          </span>
          {excecao?.status === "aplicado" ? (
            <Badge tom="ok" icone={CheckCircle2}>
              exceção aprovada
            </Badge>
          ) : excecao?.status === "pendente" ? (
            <Badge tom="aviso">esperando {excecao.afetados.filter((a) => !excecao.aprovacoes.some((x) => x.pessoaId === a)).map(nomePessoa).join(" e ")}</Badge>
          ) : excecao?.status === "recusado" ? (
            <Badge tom="erro">exceção recusada</Badge>
          ) : (
            <Botao pequeno icone={ShieldAlert} onClick={aoPedirExcecao}>
              Pedir aprovação
            </Botao>
          )}
        </div>
      )}
    </div>
  );
}

function CartaoCliente({
  config,
  cliente,
  salvo,
  s,
  sol,
  pedidos,
  aoSalvar,
  aoAbrir,
  aoPedirExcecao,
}: {
  config: Configuracao;
  cliente: ClienteBase;
  salvo: RegistroMesCliente | null;
  s: SaudeCliente;
  sol: SolucoesSaude;
  pedidos: Pedido[];
  aoSalvar: (r: RegistroMesCliente) => Promise<void>;
  aoAbrir: (c: Cenario, nome: string) => void;
  aoPedirExcecao: () => void;
}) {
  const [reg, setReg] = useState<RegistroMesCliente>(salvo ?? vazio());
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- troca de mês recarrega o registro
    setReg(salvo ?? vazio());
  }, [salvo]);

  const sujo = JSON.stringify(reg) !== JSON.stringify(salvo ?? vazio());
  const nomePessoa = (id: string) => config.pessoas.find((p) => p.id === id)?.nome ?? "sócio";

  const status = s.bloqueio
    ? { tom: "erro" as const, icone: AlertOctagon, texto: "cálculo bloqueado" }
    : s.prejuizoSilencioso
      ? { tom: "erro" as const, icone: TrendingDown, texto: "prejuízo silencioso" }
      : s.contratadoAbaixoDoPiso
        ? { tom: "aviso" as const, icone: TrendingDown, texto: "contratado abaixo do piso" }
        : !s.horasLancadas
          ? { tom: "neutro" as const, icone: Info, texto: "sem registro de horas: usando a previsão" }
          : { tom: "ok" as const, icone: CheckCircle2, texto: "saudável" };

  return (
    <Card className={cx(s.prejuizoSilencioso && "border-erro/50")}>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-base font-bold">{cliente.nome}</h2>
          {!s.temEscopo && <Badge tom="aviso">sem escopo contratado</Badge>}
          <Badge tom={status.tom} icone={status.icone}>
            {status.texto}
          </Badge>
        </div>

        {s.bloqueio && (
          <div className="flex flex-wrap items-center gap-2 rounded-bloco bg-erro-suave px-3 py-2 text-xs font-medium text-erro">
            <span className="flex-1">{s.bloqueio.texto}</span>
            <BotaoAcao a={s.bloqueio} />
          </div>
        )}

        {s.prejuizoSilencioso && (
          <p className="flex items-start gap-2 rounded-bloco bg-erro-suave px-3 py-2 text-xs font-medium text-erro">
            <AlertOctagon size={15} className="mt-px shrink-0" />
            Este cliente pagou menos que o piso por hora de {s.socios.filter((x) => x.abaixoPisoReal).map((x) => x.nome).join(" e ")} neste mês. Ele está custando mais horas do
            que paga.
          </p>
        )}

        {s.contratadoAbaixoDoPiso && (
          <p className="flex items-start gap-2 rounded-bloco bg-aviso-suave px-3 py-2 text-xs font-medium text-aviso">
            <AlertOctagon size={15} className="mt-px shrink-0" />
            Mesmo trabalhando só as horas previstas, este contrato paga menos que o piso de {s.socios.filter((x) => x.abaixoPisoPrevisto).map((x) => x.nome).join(" e ")}. O problema
            está no valor ou no escopo combinado.
          </p>
        )}

        <Solucoes sol={sol} cliente={cliente} pedidos={pedidos} nomePessoa={nomePessoa} aoAbrir={aoAbrir} aoPedirExcecao={aoPedirExcecao} />

        {/* valor do mês */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Wallet size={14} className="text-texto-suave" />
          <span>
            Valor do mês usado na conta: <strong className="numero">{formatarMoeda(s.valorRealCentavos)}</strong>
          </span>
          <EtiquetaOrigem texto={ORIGEM_VALOR[s.origemValor]} previsao={s.origemValor === "contrato"} />
          {s.pagamentosCentavos != null && s.origemValor !== "pagamentos" && (
            <span className="text-texto-suave">(entrou até agora {formatarMoeda(s.pagamentosCentavos)}; o mês ainda não fechou)</span>
          )}
          <Link href="/pagamentos" className="font-semibold text-marca-forte underline">
            Registrar pagamento
          </Link>
        </div>

        {/* lançamento de horas do mês */}
        <div className="flex flex-wrap gap-3 rounded-bloco bg-superficie-2/60 p-3 [&>*]:min-w-36 [&>*]:flex-1">
          {config.pessoas
            .filter((p) => p.ativo && p.socio)
            .map((p) => {
              const x = s.socios.find((y) => y.id === p.id);
              return (
                <CampoNumero
                  key={p.id}
                  rotulo={`Horas reais · ${p.nome}`}
                  sufixo="h"
                  placeholder={x ? `sem registro: ${formatarNumero(Math.round(x.horasReais * 10) / 10)} previstas` : "horas"}
                  valor={reg.horas[p.id] ?? null}
                  aoMudar={(v) => setReg({ ...reg, horas: { ...reg.horas, [p.id]: v } })}
                />
              );
            })}
          {salvo?.valorRecebidoCentavos != null && (
            <CampoMoeda rotulo="Quanto entrou (lançamento antigo)" valor={reg.valorRecebidoCentavos} aoMudar={(v) => setReg({ ...reg, valorRecebidoCentavos: v })} />
          )}
        </div>
        <p className="-mt-2 text-[11px] text-texto-suave">
          Horas vazias = sem registro: o sistema usa a previsão (ou a média medida pelo cronômetro) e marca que é previsão. Pagamentos agora vão em{" "}
          <Link href="/pagamentos" className="underline">
            Registrar pagamento
          </Link>
          .
        </p>

        {/* previsto × realizado */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-bold tracking-wide text-texto-suave uppercase">
                <th className="py-1.5 pr-3" />
                <th className="px-3 py-1.5 text-right">Previsto</th>
                <th className="px-3 py-1.5 text-right">Real</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-t border-linha py-1.5 pr-3 text-texto-suave">Horas no mês</td>
                <td className="numero border-t border-linha px-3 py-1.5 text-right">{s.temEscopo ? formatarHoras(s.horasPrevistas) : "—"}</td>
                <td className="numero border-t border-linha px-3 py-1.5 text-right">{formatarHoras(s.horasReais)}</td>
              </tr>
              <tr>
                <td className="border-t border-linha py-1.5 pr-3 text-texto-suave">
                  O que ele paga por hora
                  <span className="block text-[10px]">valor do mês ÷ horas que ele deu</span>
                </td>
                <td className="numero border-t border-linha px-3 py-1.5 text-right">{formatarMoeda(s.valorCobradoHoraPrevisto)}</td>
                <td className="numero border-t border-linha px-3 py-1.5 text-right font-bold">{formatarMoeda(s.valorCobradoHoraReal)}</td>
              </tr>
              {s.socios.map((x) => (
                <tr key={x.id} className={cx(x.abaixoPisoReal && "bg-erro-suave/50")}>
                  <td className="border-t border-linha py-1.5 pr-3">
                    <span className="font-semibold">{x.nome}</span> por hora
                    <span className="block text-[10px] text-texto-suave">
                      piso: {formatarMoeda(x.piso)} · recebe {formatarMoeda(x.valorReal)} · {formatarHoras(x.horasReais)}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {x.semRegistro && <EtiquetaOrigem texto="sem registro" previsao />}
                      <EtiquetaOrigem texto={rotuloOrigemHoras(x.origemHoras)} previsao={x.origemHoras.tipo === "previsto"} />
                    </span>
                    {x.recebeSemHoras && (
                      <span className="mt-1 block text-[11px] font-semibold text-info">
                        {x.nome} recebe {formatarMoeda(x.valorReal ?? x.valorPrevisto)} sem horas neste cliente.
                      </span>
                    )}
                  </td>
                  <td className={cx("numero border-t border-linha px-3 py-1.5 text-right", x.abaixoPisoPrevisto && "font-bold text-aviso")}>{formatarMoeda(x.valorHoraPrevisto)}</td>
                  <td className={cx("numero border-t border-linha px-3 py-1.5 text-right font-bold", x.abaixoPisoReal && "text-erro")}>
                    <span className="inline-flex items-center gap-1">
                      {x.horasReais > 0 ? formatarMoeda(x.valorHoraReal) : "sem horas"}
                      {x.abaixoPisoReal && <TrendingDown size={14} aria-label="abaixo do piso" />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sujo && (
          <div className="flex justify-end">
            <Botao
              pequeno
              variante="primario"
              icone={Save}
              disabled={salvando}
              onClick={async () => {
                setSalvando(true);
                try {
                  await aoSalvar(reg);
                } finally {
                  setSalvando(false);
                }
              }}
            >
              {salvando ? "Salvando…" : "Salvar horas do mês"}
            </Botao>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Saude() {
  const { repo } = useDados();
  const router = useRouter();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [competencia, setCompetencia] = useState(competenciaAtual);
  const [registros, setRegistros] = useState<Record<string, RegistroMesCliente>>({});
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [calibragem, setCalibragem] = useState<CalibragemTipo[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  const carregarMes = useCallback(async (c: string) => setRegistros(await repo.carregarMes(c)), [repo]);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await repo.carregarConfig();
        setConfig(cfg);
        await carregarMes(competencia);
        setPagamentos(await repo.listarPagamentos().catch(() => []));
        setCalibragem(calcularCalibragem(cfg, await repo.listarMedicoes().catch(() => [])));
        setPedidos(await repo.listarPedidos().catch(() => []));
      } catch (e) {
        setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao carregar." });
      } finally {
        setCarregado(true);
      }
    })();
  }, [repo, carregarMes, competencia]);

  const ativos = config.clientes.filter((c) => c.ativo);
  const mesFechado = competencia < competenciaAtual();
  const saudes = useMemo(
    () =>
      ativos.map((c) => {
        const s = calcularSaudeCliente(config, c, registros[c.id] ?? null, {
          calibragem,
          pagamentosCentavos: somaPagamentos(pagamentos, c.id, competencia),
          mesFechado,
        });
        return { c, s, sol: calcularSolucoes(config, c, s, calibragem) };
      }),
    [ativos, config, registros, calibragem, pagamentos, competencia, mesFechado],
  );
  const comProblema = saudes.filter((x) => x.s.prejuizoSilencioso);

  const abrir = (c: Cenario, nome: string) => {
    enviarCenario({ origem: "saude", nome, cenarios: [c] });
    router.push("/calculadora");
  };

  const pedirExcecao = async (cli: ClienteBase, sol: SolucoesSaude) => {
    if (!sol.cenarioBase) return;
    const quem = sol.excecao.map((x) => x.nome).join(" e ");
    if (!confirm(`Pedir a ${quem} a aprovação para manter ${cli.nome} como está, abaixo do piso?`)) return;
    try {
      const r = await repo.proporExcecao({
        clienteId: cli.id,
        afetados: sol.excecao.map((x) => x.pessoaId),
        assinatura: assinaturaProposta(sol.cenarioBase, cli.valorMensalCentavos),
        descricao: `Manter ${cli.nome} abaixo do piso de ${quem}`,
        dados: { aplicar: "proposta", cenario: sol.cenarioBase, valorCentavos: cli.valorMensalCentavos, perdas: sol.excecao },
      });
      setPedidos(await repo.listarPedidos());
      setMensagem({ tom: "ok", texto: r.status === "aplicado" ? "Exceção registrada: você é a única afetada." : "Pedido enviado para aprovação." });
    } catch (e) {
      setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao pedir aprovação." });
    }
  };

  if (!carregado) return null;

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={HeartPulse}
        selo="Financeiro"
        titulo="Saúde dos clientes"
        descricao="Quanto cada cliente pagou no mês e quantas horas custou de verdade. Quando algo está abaixo do piso, aparecem os caminhos para resolver, calculados com os números do cliente."
        acoes={
          <label className="flex items-center gap-2 text-xs font-semibold text-texto-suave">
            Mês
            <input
              type="month"
              value={competencia}
              onChange={(e) => e.target.value && setCompetencia(e.target.value)}
              className="h-10 rounded-campo border border-linha bg-superficie px-3 text-sm text-texto focus:border-marca focus:outline-none"
            />
          </label>
        }
      />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {mensagem && <p className={cx("px-1 text-xs font-semibold", mensagem.tom === "erro" ? "text-erro" : "text-ok")}>{mensagem.texto}</p>}

        {ativos.length > 0 && (
          <div
            className={cx(
              "flex items-center gap-2 rounded-card px-4 py-3 text-sm font-medium",
              comProblema.length ? "bg-erro-suave text-erro" : "bg-ok-suave text-ok",
            )}
          >
            {comProblema.length ? <AlertOctagon size={17} /> : <CheckCircle2 size={17} />}
            {comProblema.length
              ? `${comProblema.length} cliente(s) pagando abaixo do piso neste mês: ${comProblema.map((x) => x.c.nome).join(", ")}.`
              : "Nenhum cliente abaixo do piso nas horas registradas ou medidas deste mês."}
          </div>
        )}

        {ativos.length === 0 && (
          <Vazio icone={HeartPulse} titulo="Nenhum cliente ativo">
            Cadastre os clientes em Configurações e guarde o escopo contratado de cada um pela calculadora.
          </Vazio>
        )}

        {saudes.map(({ c, s, sol }) => (
          <CartaoCliente
            key={`${c.id}-${competencia}`}
            config={config}
            cliente={c}
            s={s}
            sol={sol}
            pedidos={pedidos}
            salvo={registros[c.id] ?? null}
            aoAbrir={abrir}
            aoPedirExcecao={() => pedirExcecao(c, sol)}
            aoSalvar={async (r) => {
              try {
                await repo.salvarMesCliente(competencia, c.id, r);
                await carregarMes(competencia);
                setMensagem({ tom: "ok", texto: `Horas de ${c.nome} salvas.` });
              } catch (e) {
                setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao salvar." });
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
