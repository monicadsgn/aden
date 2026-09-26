"use client";

import { AlertOctagon, HandCoins } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BotaoAcao, OQueQuerDizer } from "@/components/Alertas";
import { SITUACAO } from "@/components/financeiro";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Card, TituloCard, Vazio, cx } from "@/components/ui";
import { configVazia } from "@/lib/calculo/novo";
import { distribuirPagamentos, repasseDosSocios, type Pagamento } from "@/lib/calculo/pagamentos";
import type { Configuracao } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";
import { competenciaAtual } from "@/lib/dados/repositorio";
import { formatarMoeda } from "@/lib/formato";

const hoje = () => new Date().toISOString().slice(0, 10);

export default function Repasse() {
  const { repo } = useDados();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [competencia, setCompetencia] = useState(competenciaAtual);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setConfig(await repo.carregarConfig());
        setPagamentos(await repo.listarPagamentos());
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar.");
      } finally {
        setCarregado(true);
      }
    })();
  }, [repo]);

  const distribuicoes = useMemo(
    () => config.clientes.filter((c) => c.ativo && !c.interno).map((c) => distribuirPagamentos(config, c, competencia, pagamentos, hoje())),
    [config, competencia, pagamentos],
  );
  const repasse = useMemo(() => repasseDosSocios(config, distribuicoes), [config, distribuicoes]);
  const bloqueio = distribuicoes.find((d) => d.bloqueio)?.bloqueio ?? null;
  const atrasados = distribuicoes.filter((d) => d.situacao === "atrasado");

  if (!carregado) return null;

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={HandCoins}
        selo="Financeiro"
        titulo="Repasse dos sócios"
        descricao="Quanto cada sócio já recebeu no mês, somando todos os clientes, e quanto ainda falta cair."
        acoes={
          <input
            type="month"
            aria-label="Mês"
            value={competencia}
            onChange={(e) => e.target.value && setCompetencia(e.target.value)}
            className="h-10 rounded-campo border border-linha bg-superficie px-3 text-sm focus:border-marca focus:outline-none"
          />
        }
      />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {erro && <p className="rounded-card bg-erro-suave px-4 py-3 text-sm text-erro">{erro}</p>}
        {bloqueio && (
          <div className="flex flex-wrap items-center gap-2 rounded-card bg-erro-suave px-4 py-3 text-xs font-medium text-erro">
            <span className="flex-1">{bloqueio.texto}</span>
            <BotaoAcao a={bloqueio} />
            <OQueQuerDizer explica={bloqueio.explica} />
          </div>
        )}
        {atrasados.length > 0 && (
          <p className="flex items-center gap-2 rounded-card bg-erro-suave px-4 py-3 text-sm font-medium text-erro">
            <AlertOctagon size={17} /> Em atraso neste mês: {atrasados.map((d) => `${d.nome} (falta ${formatarMoeda(d.faltaReceberCentavos)})`).join(", ")}.
          </p>
        )}
        {repasse.length === 0 && (
          <Vazio icone={HandCoins} titulo="Nenhum sócio cadastrado">
            Cadastre os sócios em Configurações.
          </Vazio>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {repasse.map((r) => (
            <Card key={r.pessoaId}>
              <TituloCard icone={HandCoins} titulo={r.nome} descricao="Somando o que já caiu de todos os clientes neste mês." />
              <div className="flex flex-col gap-3 px-5 pb-5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-bloco bg-ok-suave p-3">
                    <p className="text-[10px] font-semibold text-texto-suave">Já recebeu</p>
                    <p className="numero text-lg font-extrabold">{formatarMoeda(r.recebidoCentavos)}</p>
                  </div>
                  <div className="rounded-bloco bg-superficie-2 p-3">
                    <p className="text-[10px] font-semibold text-texto-suave">Falta</p>
                    <p className="numero text-lg font-extrabold">{formatarMoeda(r.faltaCentavos)}</p>
                  </div>
                  <div className="rounded-bloco bg-marca-tinta p-3">
                    <p className="text-[10px] font-semibold text-texto-suave">Mês cheio</p>
                    <p className="numero text-lg font-extrabold">{formatarMoeda(r.planejadoCentavos)}</p>
                  </div>
                </div>
                <div className="flex flex-col text-[12px]">
                  {r.porCliente.map((c) => (
                    <div key={c.clienteId} className={cx("flex flex-wrap items-center gap-2 border-b border-linha/60 py-1.5 last:border-0", c.situacao === "atrasado" && "text-erro")}>
                      <span className="flex-1 font-semibold">{c.nome}</span>
                      <Badge tom={SITUACAO[c.situacao].tom}>{SITUACAO[c.situacao].rotulo}</Badge>
                      <span className="numero w-40 text-right">
                        {formatarMoeda(c.recebidoCentavos)} de {formatarMoeda(c.planejadoCentavos)}
                      </span>
                    </div>
                  ))}
                  {r.porCliente.length === 0 && <p className="text-texto-suave">Nenhum cliente com distribuição neste mês.</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
