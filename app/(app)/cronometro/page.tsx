"use client";

import { Pause, Play, Square, Timer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Botao, Card, Selecao, TituloCard, Vazio, cx } from "@/components/ui";
import {
  calcularCalibragem,
  formatarMinutos,
  iniciarMedicao,
  pararMedicao,
  pausarMedicao,
  pedeCronometro,
  retomarMedicao,
  segundosDaMedicao,
  type CalibragemTipo,
  type Medicao,
} from "@/lib/calculo/calibragem";
import { configVazia, novoId } from "@/lib/calculo/novo";
import type { Configuracao, Id } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";
import { formatarDuracao } from "@/lib/formato";

function relogio(seg: number): string {
  const s = Math.floor(seg);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(r).padStart(2, "0")}`;
}

function SeloCalibragem({ c }: { c: CalibragemTipo | undefined }) {
  if (!c) return null;
  if (c.alvo == null) return <Badge>sem meta de medições</Badge>;
  if (c.situacao === "calibrado") return <Badge tom="ok">calibrado · média {formatarMinutos(c.mediaMinutos)}</Badge>;
  return (
    <Badge tom="aviso">
      medir: {c.medicoes} de {c.alvo}
    </Badge>
  );
}

export default function Cronometro() {
  const { repo, usuario } = useDados();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [pessoaId, setPessoaId] = useState<Id | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => setMedicoes(await repo.listarMedicoes()), [repo]);

  useEffect(() => {
    (async () => {
      try {
        const c = await repo.carregarConfig();
        setConfig(c);
        await recarregar();
        setPessoaId(usuario?.pessoaId ?? c.pessoas.find((p) => p.ativo && p.socio)?.id ?? null);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar.");
      } finally {
        setCarregado(true);
      }
    })();
  }, [repo, recarregar, usuario]);

  const abertas = medicoes.filter((m) => m.estado !== "concluido");
  useEffect(() => {
    if (!abertas.some((m) => m.estado === "rodando")) return;
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, [abertas]);

  const calibragem = useMemo(() => calcularCalibragem(config, medicoes), [config, medicoes]);
  const cal = (id: Id) => calibragem.find((c) => c.tipoEntregaId === id);
  const nomeTipo = (id: Id) => config.tiposEntrega.find((t) => t.id === id)?.nome ?? "entrega";
  const nomeCliente = (id: Id | null) => (id ? (config.clientes.find((c) => c.id === id)?.nome ?? "cliente") : "sem cliente");

  const salvar = async (m: Medicao) => {
    try {
      await repo.salvarMedicao(m);
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar a medição.");
    }
  };

  const iniciar = (clienteId: Id | null, tipoEntregaId: Id) => salvar(iniciarMedicao({ id: novoId(), clienteId, tipoEntregaId, pessoaId }, new Date()));

  const clientes = config.clientes.filter((c) => c.ativo && c.escopo);
  const socios = config.pessoas.filter((p) => p.ativo && p.socio);
  const semEscopo = config.tiposEntrega.filter((t) => t.ativo && !t.audiovisual);

  if (!carregado) return null;

  const linha = (chave: string, clienteId: Id | null, tipoId: Id, qtd?: number | null) => {
    const c = cal(tipoId);
    const pede = c ? pedeCronometro(c) : false;
    const tipo = config.tiposEntrega.find((t) => t.id === tipoId);
    return (
      <div key={chave} className="flex flex-wrap items-center gap-2 py-2">
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate text-[13px] font-semibold">{tipo?.nome}</p>
          <p className="text-[11px] text-texto-suave">
            {qtd != null && `${qtd} por mês · `}padrão: {formatarDuracao(tipo?.horasPorUnidade)}
          </p>
        </div>
        <SeloCalibragem c={c} />
        <Botao pequeno variante={pede ? "primario" : "secundario"} icone={Play} onClick={() => iniciar(clienteId, tipoId)}>
          {pede ? "Medir" : "Medir de novo"}
        </Botao>
      </div>
    );
  };

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={Timer}
        selo="Operação"
        titulo="Cronômetro"
        descricao="Mede quanto tempo leva de verdade cada entrega. Aperte iniciar ao começar uma peça, pause se parar, e pare quando terminar. Cada medição é uma entrega."
      />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {erro && <p className="rounded-card bg-erro-suave px-4 py-3 text-sm text-erro">{erro}</p>}

        <div className="flex flex-wrap items-end gap-3">
          <Selecao
            className="w-full sm:w-64"
            rotulo="Quem está medindo"
            valor={pessoaId}
            opcoes={socios.map((p) => ({ valor: p.id, rotulo: p.nome }))}
            aoMudar={setPessoaId}
          />
          <p className="flex-1 pb-2 text-[11px] text-texto-suave">
            {config.empresa.medicoesCalibragem
              ? `Modo calibragem: o sistema pede ${config.empresa.medicoesCalibragem} medições de cada tipo de entrega. Depois para de pedir e usa a média.`
              : "Defina em Configurações → Limites e avisos quantas medições calibram cada entrega."}{" "}
            <Link href="/calibragem" className="font-semibold text-marca-forte underline">
              Ver a calibragem
            </Link>
          </p>
        </div>

        {abertas.length > 0 && (
          <Card className="border-marca/50">
            <TituloCard icone={Timer} titulo="Rodando agora" descricao="Pausou? O tempo parado não conta." />
            <div className="flex flex-col gap-2 px-5 pb-5">
              {abertas.map((m) => (
                <div key={m.id} className={cx("flex flex-wrap items-center gap-3 rounded-bloco p-3", m.estado === "rodando" ? "bg-marca-tinta" : "bg-superficie-2")}>
                  <span className={cx("numero text-3xl font-extrabold tabular-nums", m.estado === "pausado" && "text-texto-suave")}>{relogio(segundosDaMedicao(m, agora))}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{nomeTipo(m.tipoEntregaId)}</p>
                    <p className="text-[11px] text-texto-suave">
                      {nomeCliente(m.clienteId)} · {config.pessoas.find((p) => p.id === m.pessoaId)?.nome ?? "—"} · {m.estado === "rodando" ? "rodando" : "pausado"}
                    </p>
                  </div>
                  {m.estado === "rodando" ? (
                    <Botao icone={Pause} onClick={() => salvar(pausarMedicao(m, new Date()))}>
                      Pausar
                    </Botao>
                  ) : (
                    <Botao icone={Play} onClick={() => salvar(retomarMedicao(m, new Date()))}>
                      Continuar
                    </Botao>
                  )}
                  <Botao variante="primario" icone={Square} onClick={() => salvar(pararMedicao(m, new Date()))}>
                    Parar
                  </Botao>
                  <Botao
                    variante="perigo"
                    icone={Trash2}
                    aria-label="Descartar esta medição"
                    onClick={async () => {
                      if (!confirm("Descartar esta medição? Ela não vai contar na média.")) return;
                      await repo.removerMedicao(m.id);
                      await recarregar();
                    }}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {clientes.length === 0 && (
          <Vazio icone={Timer} titulo="Nenhum cliente com escopo contratado">
            As entregas de cada cliente aparecem aqui quando o escopo contratado é guardado pela calculadora. Enquanto isso, dá para medir abaixo, sem cliente.
          </Vazio>
        )}

        {clientes.map((cli) => {
          const linhas = (cli.escopo?.entregas ?? []).filter((l) => {
            const t = config.tiposEntrega.find((x) => x.id === l.tipoEntregaId);
            return t && !t.audiovisual && (l.quantidade ?? 0) > 0;
          });
          return (
            <Card key={cli.id}>
              <TituloCard icone={Timer} titulo={cli.nome} descricao="Entregas do escopo contratado." />
              <div className="divide-y divide-linha px-5 pb-3">
                {linhas.length === 0 && <p className="py-2 text-xs text-texto-suave">O escopo deste cliente não tem entregas com tempo.</p>}
                {linhas.map((l) => linha(l.id, cli.id, l.tipoEntregaId!, l.quantidade))}
              </div>
            </Card>
          );
        })}

        <Card>
          <TituloCard icone={Timer} titulo="Sem cliente" descricao="Para medir uma entrega avulsa ou de um cliente ainda sem escopo." />
          <div className="divide-y divide-linha px-5 pb-3">
            {semEscopo.map((t) => linha(t.id, null, t.id))}
          </div>
        </Card>

        <Card>
          <TituloCard icone={Timer} titulo="Últimas medições" descricao="Medição errada? Apague: ela sai da média (e fica no histórico)." />
          <div className="divide-y divide-linha px-5 pb-3">
            {medicoes.filter((m) => m.estado === "concluido").length === 0 && <p className="py-2 text-xs text-texto-suave">Nenhuma medição ainda.</p>}
            {medicoes
              .filter((m) => m.estado === "concluido")
              .slice(0, 30)
              .map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-2 py-2 text-[13px]">
                  <span className="numero w-20 font-bold">{formatarMinutos(m.acumuladoSegundos / 60)}</span>
                  <span className="min-w-0 flex-1">
                    {nomeTipo(m.tipoEntregaId)} <span className="text-texto-suave">· {nomeCliente(m.clienteId)} · {new Date(m.fim ?? m.criadoEm).toLocaleDateString("pt-BR")}</span>
                  </span>
                  <Botao
                    pequeno
                    variante="perigo"
                    icone={Trash2}
                    aria-label="Apagar medição"
                    onClick={async () => {
                      if (!confirm("Apagar esta medição?")) return;
                      await repo.removerMedicao(m.id);
                      await recarregar();
                    }}
                  />
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
