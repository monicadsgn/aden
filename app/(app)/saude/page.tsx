"use client";

import { AlertOctagon, CheckCircle2, HeartPulse, Info, Save, TrendingDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Botao, Card, CampoMoeda, CampoNumero, Vazio, cx } from "@/components/ui";
import { calcularSaudeCliente, type RegistroMesCliente } from "@/lib/calculo/mes";
import { configVazia } from "@/lib/calculo/novo";
import type { ClienteBase, Configuracao } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";
import { competenciaAtual } from "@/lib/dados/repositorio";
import { formatarHoras, formatarMoeda, formatarNumero } from "@/lib/formato";

const vazio = (): RegistroMesCliente => ({ valorRecebidoCentavos: null, horas: {} });

function CartaoCliente({
  config,
  cliente,
  salvo,
  aoSalvar,
}: {
  config: Configuracao;
  cliente: ClienteBase;
  salvo: RegistroMesCliente | null;
  aoSalvar: (r: RegistroMesCliente) => Promise<void>;
}) {
  const [reg, setReg] = useState<RegistroMesCliente>(salvo ?? vazio());
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- troca de mês recarrega o registro
    setReg(salvo ?? vazio());
  }, [salvo]);

  const sujo = JSON.stringify(reg) !== JSON.stringify(salvo ?? vazio());
  const s = useMemo(() => calcularSaudeCliente(config, cliente, reg), [config, cliente, reg]);
  const socios = config.pessoas.filter((p) => p.ativo && p.socio);

  const status = s.contratadoAbaixoDoPiso && !s.prejuizoSilencioso
    ? { tom: "aviso" as const, icone: TrendingDown, texto: "contratado abaixo do piso" }
    : !s.horasLancadas
    ? { tom: "neutro" as const, icone: Info, texto: "horas do mês ainda não lançadas" }
    : s.prejuizoSilencioso
      ? { tom: "erro" as const, icone: TrendingDown, texto: "prejuízo silencioso" }
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

        {s.prejuizoSilencioso && (
          <p className="flex items-start gap-2 rounded-bloco bg-erro-suave px-3 py-2 text-xs font-medium text-erro">
            <AlertOctagon size={15} className="mt-px shrink-0" />
            Este cliente pagou menos que o piso por hora de {s.socios.filter((x) => x.abaixoPisoReal).map((x) => x.nome).join(" e ")} neste mês. Ele está
            custando mais horas do que paga.
          </p>
        )}

        {s.contratadoAbaixoDoPiso && (
          <p className="flex items-start gap-2 rounded-bloco bg-aviso-suave px-3 py-2 text-xs font-medium text-aviso">
            <AlertOctagon size={15} className="mt-px shrink-0" />
            Mesmo trabalhando só as horas previstas, este contrato paga menos que o piso de{" "}
            {s.socios.filter((x) => x.abaixoPisoPrevisto).map((x) => x.nome).join(" e ")}. O problema está no valor ou no escopo combinado.
          </p>
        )}

        {/* lançamento do mês */}
        <div className="flex flex-wrap gap-3 rounded-bloco bg-superficie-2/60 p-3 [&>*]:min-w-36 [&>*]:flex-1">
          <CampoMoeda
            rotulo="Quanto entrou no mês"
            placeholder={cliente.valorMensalCentavos != null ? `contrato: ${formatarNumero(cliente.valorMensalCentavos / 100)}` : "valor recebido"}
            valor={reg.valorRecebidoCentavos}
            aoMudar={(v) => setReg({ ...reg, valorRecebidoCentavos: v })}
          />
          {socios.map((p) => (
            <CampoNumero
              key={p.id}
              rotulo={`Horas reais · ${p.nome}`}
              sufixo="h"
              placeholder={s.temEscopo ? `previsto ${formatarNumero(s.socios.find((x) => x.id === p.id)?.horasPrevistas ?? 0)}` : "horas"}
              valor={reg.horas[p.id] ?? null}
              aoMudar={(v) => setReg({ ...reg, horas: { ...reg.horas, [p.id]: v } })}
            />
          ))}
        </div>
        <p className="-mt-2 text-[11px] text-texto-suave">
          Vazio em “Quanto entrou” = considera o valor do contrato ({formatarMoeda(cliente.valorMensalCentavos)}).
        </p>

        {/* previsto × realizado */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] border-separate border-spacing-0 text-[13px]">
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
                    <span className="block text-[10px] text-texto-suave">piso: {formatarMoeda(x.piso)}</span>
                  </td>
                  <td className={cx("numero border-t border-linha px-3 py-1.5 text-right", x.abaixoPisoPrevisto && "font-bold text-aviso")}>
                    {formatarMoeda(x.valorHoraPrevisto)}
                  </td>
                  <td className={cx("numero border-t border-linha px-3 py-1.5 text-right font-bold", x.abaixoPisoReal && "text-erro")}>
                    <span className="inline-flex items-center gap-1">
                      {formatarMoeda(x.valorHoraReal)}
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
              {salvando ? "Salvando…" : "Salvar mês"}
            </Botao>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Saude() {
  const { repo } = useDados();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [competencia, setCompetencia] = useState(competenciaAtual);
  const [registros, setRegistros] = useState<Record<string, RegistroMesCliente>>({});
  const [carregado, setCarregado] = useState(false);
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  const carregarMes = useCallback(async (c: string) => setRegistros(await repo.carregarMes(c)), [repo]);

  useEffect(() => {
    (async () => {
      try {
        setConfig(await repo.carregarConfig());
        await carregarMes(competencia);
      } catch (e) {
        setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao carregar." });
      } finally {
        setCarregado(true);
      }
    })();
  }, [repo, carregarMes, competencia]);

  const ativos = config.clientes.filter((c) => c.ativo);
  const comProblema = ativos.filter((c) => calcularSaudeCliente(config, c, registros[c.id] ?? null).prejuizoSilencioso);

  if (!carregado) return null;

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={HeartPulse}
        selo="Financeiro"
        titulo="Saúde dos clientes"
        descricao="Quanto cada cliente pagou no mês e quantas horas custou de verdade. Vermelho é o cliente que está pagando menos do que o piso por hora de um sócio."
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
              ? `${comProblema.length} cliente(s) pagando abaixo do piso neste mês: ${comProblema.map((c) => c.nome).join(", ")}.`
              : "Nenhum cliente abaixo do piso nos lançamentos deste mês."}
          </div>
        )}

        {ativos.length === 0 && (
          <Vazio icone={HeartPulse} titulo="Nenhum cliente ativo">
            Cadastre os clientes em Configurações e guarde o escopo contratado de cada um pela calculadora.
          </Vazio>
        )}

        {ativos.map((c) => (
          <CartaoCliente
            key={`${c.id}-${competencia}`}
            config={config}
            cliente={c}
            salvo={registros[c.id] ?? null}
            aoSalvar={async (r) => {
              try {
                await repo.salvarMesCliente(competencia, c.id, r);
                await carregarMes(competencia);
                setMensagem({ tom: "ok", texto: `Mês de ${c.nome} salvo.` });
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
