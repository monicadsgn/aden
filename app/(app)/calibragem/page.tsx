"use client";

import { Gauge, RefreshCw, Timer, Wand2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Botao, Card, TituloCard, Vazio, cx } from "@/components/ui";
import { calcularCalibragem, formatarMinutos, type CalibragemTipo, type Medicao } from "@/lib/calculo/calibragem";
import { configVazia } from "@/lib/calculo/novo";
import type { Configuracao, TipoEntrega } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";
import type { AlteracoesConfig } from "@/lib/dados/repositorio";
import { formatarPct } from "@/lib/formato";

const semMudanca = (): AlteracoesConfig => ({
  pessoas: { salvar: [], remover: [] },
  servicos: { salvar: [], remover: [] },
  tiposEntrega: { salvar: [], remover: [] },
  custosFixos: { salvar: [], remover: [] },
  clientes: { salvar: [], remover: [] },
});

export default function Calibragem() {
  const { repo, usuario } = useDados();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro" | "aviso"; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    try {
      setConfig(await repo.carregarConfig());
      setMedicoes(await repo.listarMedicoes());
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

  const lista = useMemo(() => calcularCalibragem(config, medicoes), [config, medicoes]);
  const nomes = (ids: string[]) => ids.map((id) => config.pessoas.find((p) => p.id === id)?.nome ?? "sócio").join(" e ");

  const salvarTipo = async (t: TipoEntrega, texto: string) => {
    try {
      const r = await repo.salvarConfig({ ...semMudanca(), tiposEntrega: { salvar: [t], remover: [] } });
      await carregar();
      if (r.pedido?.status === "pendente")
        setMensagem({ tom: "aviso", texto: `Pedido enviado: o novo tempo só vale depois que ${nomes(r.pedido.aguardando)} aprovar. Até lá vale o tempo antigo.` });
      else setMensagem({ tom: "ok", texto });
    } catch (e) {
      setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao salvar." });
    }
  };

  const atualizarPadrao = (c: CalibragemTipo) => {
    const t = config.tiposEntrega.find((x) => x.id === c.tipoEntregaId);
    if (!t || c.mediaMinutos == null) return;
    const min = Math.round(c.mediaMinutos);
    if (!confirm(`Mudar o tempo de ${t.nome} de ${formatarMinutos(c.padraoMinutos)} para ${formatarMinutos(min)}? É campo protegido: quem executa precisa aprovar.`)) return;
    void salvarTipo({ ...t, horasPorUnidade: min / 60 }, `Tempo de ${t.nome} atualizado para ${formatarMinutos(min)}.`);
  };

  const recalibrar = (c: CalibragemTipo) => {
    const t = config.tiposEntrega.find((x) => x.id === c.tipoEntregaId);
    if (!t) return;
    if (!confirm(`Recalibrar ${t.nome}? As medições de antes deixam de contar e o cronômetro volta a pedir medições. Use quando o processo mudou.`)) return;
    void salvarTipo({ ...t, calibrarDesde: new Date().toISOString() }, `${t.nome} vai ser medido de novo a partir de agora.`);
  };

  if (!carregado) return null;

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={Gauge}
        selo="Configurações"
        titulo="Calibragem das horas"
        descricao="Quanto cada entrega leva de verdade (média do tempo medido nas tarefas) contra o tempo cadastrado. Quando a média fica diferente, o sistema sugere atualizar o tempo."
        acoes={
          <Link href="/tarefas" className="inline-flex h-10 items-center gap-1.5 rounded-botao bg-marca px-4 text-sm font-semibold text-sobre-marca">
            <Timer size={16} /> Ir para as tarefas
          </Link>
        }
      />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {mensagem && (
          <p className={cx("px-1 text-xs font-semibold", mensagem.tom === "erro" ? "text-erro" : mensagem.tom === "aviso" ? "text-aviso" : "text-ok")}>{mensagem.texto}</p>
        )}
        {config.empresa.medicoesCalibragem == null && (
          <p className="rounded-card bg-aviso-suave px-4 py-3 text-xs text-aviso">
            Falta dizer quantas medições calibram cada entrega.{" "}
            <Link href="/configuracoes?secao=limites&campo=medicoesCalibragem" className="font-bold underline">
              Preencher
            </Link>
          </p>
        )}
        <Card>
          <TituloCard
            icone={Gauge}
            titulo="Cada tipo de entrega"
            descricao="Calibrado = já tem as medições pedidas. A partir daí a média medida estima as horas reais na tela Mês (aba Cada cliente); o tempo cadastrado só muda se vocês aprovarem."
          />
          <div className="divide-y divide-linha px-5 pb-3">
            {lista.length === 0 && (
              <Vazio icone={Gauge} titulo="Nenhum tipo de entrega">
                Cadastre os tipos de entrega em Configurações.
              </Vazio>
            )}
            {lista.map((c) => (
              <div key={c.tipoEntregaId} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 text-sm font-semibold">{c.nome}</p>
                  {c.situacao === "calibrado" ? (
                    <Badge tom="ok">calibrado</Badge>
                  ) : c.situacao === "calibrando" ? (
                    <Badge tom="aviso">
                      calibrando: {c.medicoes}
                      {c.alvo != null && ` de ${c.alvo}`}
                    </Badge>
                  ) : (
                    <Badge>sem medição</Badge>
                  )}
                  {c.medicoes > 0 && (
                    <Botao pequeno variante="fantasma" icone={RefreshCw} onClick={() => recalibrar(c)}>
                      Recalibrar
                    </Botao>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <p className="text-[10px] font-semibold text-texto-suave">Tempo cadastrado</p>
                    <p className="numero font-bold">{formatarMinutos(c.padraoMinutos)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-texto-suave">Média medida</p>
                    <p className="numero font-bold">
                      {formatarMinutos(c.mediaMinutos)} {c.medicoes > 0 && <span className="font-normal text-texto-suave">({c.medicoes} medições)</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-texto-suave">Diferença</p>
                    <p className={cx("numero font-bold", c.diferencaPct != null && c.diferencaPct > 0 && "text-aviso")}>
                      {c.diferencaPct == null ? "—" : `${c.diferencaPct > 0 ? "+" : ""}${formatarPct(Math.round(c.diferencaPct))}`}
                    </p>
                  </div>
                </div>
                {c.sugestao && (
                  <div className="flex flex-wrap items-center gap-2 rounded-bloco bg-marca-tinta px-3 py-2 text-xs">
                    <Wand2 size={14} className="shrink-0 text-marca-forte" />
                    <span className="flex-1">{c.sugestao}</span>
                    <Botao pequeno variante="primario" onClick={() => atualizarPadrao(c)}>
                      Atualizar o tempo
                    </Botao>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
        {usuario?.pessoaId == null && repo.modo === "supabase" && (
          <p className="text-[11px] text-texto-suave">Seu login não está ligado a um sócio: atualizar um tempo vira pedido para quem executa aprovar.</p>
        )}
      </div>
    </div>
  );
}
