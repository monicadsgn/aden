"use client";

import { useEffect, useMemo, useState } from "react";
import { BlocoDoc, Capa, Documento, NumeroGrande } from "@/components/impressao/Documento";
import { useParametro } from "@/components/ui";
import { useDados } from "@/lib/dados/contexto";
import { amostraPequena, fraseComparacao, limitarDias, respostaCurta, type DiaValor, type RespostaMetricas } from "@/lib/meta/metricas";

const dataBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");
const mil = (n: number) => (n >= 10_000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : n.toLocaleString("pt-BR"));

function Grafico({ titulo, dados }: { titulo: string; dados: DiaValor[] }) {
  if (dados.length < 2) return null;
  const max = Math.max(...dados.map((d) => d.valor), 1);
  const L = 300;
  const A = 90;
  const pontos = dados.map((d, i) => `${(i / (dados.length - 1)) * L},${A - (d.valor / max) * (A - 8) - 2}`).join(" ");
  return (
    <div className="break-inside-avoid rounded-bloco border border-linha p-3">
      <p className="text-xs font-semibold text-texto-suave">{titulo}</p>
      <svg viewBox={`0 0 ${L} ${A}`} className="mt-1 h-24 w-full" role="img" aria-label={titulo}>
        <polyline points={pontos} fill="none" stroke="var(--marca-forte)" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      <p className="flex justify-between text-[10px] text-texto-suave">
        <span>{dataBr(dados[0].dia)}</span>
        <span>pico: {mil(max)}</span>
        <span>{dataBr(dados[dados.length - 1].dia)}</span>
      </p>
    </div>
  );
}

// Relatório do Instagram de um cliente. Os números vêm direto da Meta (só leitura); nada interno aparece aqui.
// Os prints do Meta Business Suite são escolhidos no computador e ficam só nesta tela (não são guardados em lugar nenhum).
export default function ImprimirRelatorio() {
  const { repo } = useDados();
  const clienteId = useParametro("cliente");
  const diasParam = useParametro("dias");
  const [nome, setNome] = useState("");
  const [r, setR] = useState<RespostaMetricas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [prints, setPrints] = useState<string[]>([]);
  const dias = limitarDias(Number(diasParam) || null);

  useEffect(() => {
    if (!clienteId) return;
    (async () => {
      const config = await repo.carregarConfig();
      setNome(config.clientes.find((c) => c.id === clienteId)?.nome ?? "Cliente");
      setR(await repo.metaMetricasNoServidor(clienteId, dias));
    })().catch((e) => setErro(e instanceof Error ? e.message : "Não deu para montar o relatório."));
  }, [repo, clienteId, dias]);

  const resposta = useMemo(() => (r?.ativo ? respostaCurta(r.numeros) : null), [r]);

  if (erro) return <p className="p-8 text-sm text-erro">{erro}</p>;
  if (!r) return null;
  if (!r.ativo) return <p className="p-8 text-sm">As métricas estão desligadas ({r.motivo}). Um sócio liga na Vercel e na ficha do cliente.</p>;

  const mes = new Date(`${r.ate}T12:00:00`).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }).replace("/", "-");
  return (
    <Documento arquivo={`relatorio-instagram_${nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${mes}`}>
      <Capa tipo="Relatório" titulo={`Instagram de ${nome}`} sub={`${dataBr(r.de)} a ${dataBr(r.ate)} (${r.dias} dias), contra os ${r.dias} dias anteriores · @${r.usuario}`} />

      {resposta && (
        <BlocoDoc titulo="Resposta curta">
          <p className="rounded-bloco bg-marca-tinta p-4 text-sm">
            <strong>{resposta.titulo}.</strong> {resposta.texto}
          </p>
        </BlocoDoc>
      )}

      <BlocoDoc titulo="Os números do período">
        <div className="grid gap-3 sm:grid-cols-3">
          {r.numeros.map((n) => (
            <div key={n.chave} className="break-inside-avoid">
              <NumeroGrande rotulo={n.rotulo} valor={mil(n.valor)} />
              <p className="mt-1 text-xs font-semibold">{fraseComparacao(n)}</p>
              <p className="text-[11px] text-texto-suave">{n.explica}</p>
            </div>
          ))}
        </div>
      </BlocoDoc>

      {(r.porDia.alcance.length > 1 || r.porDia.seguidores.length > 1) && (
        <BlocoDoc titulo="Dia a dia">
          <div className="grid gap-3 sm:grid-cols-2">
            <Grafico titulo="Pessoas alcançadas por dia" dados={r.porDia.alcance} />
            <Grafico titulo="Seguidores novos por dia" dados={r.porDia.seguidores} />
          </div>
        </BlocoDoc>
      )}

      {r.posts.length > 0 && (
        <BlocoDoc titulo="Os posts que mais chamaram atenção">
          <div className="grid gap-3 sm:grid-cols-2">
            {r.posts.map((p, i) => (
              <div key={i} className="break-inside-avoid rounded-bloco border border-linha p-3 text-sm">
                <p className="font-bold">{p.titulo}</p>
                <p className="text-xs text-texto-suave">
                  {p.tipo}
                  {p.data ? ` do dia ${dataBr(p.data)}` : ""}
                </p>
                <p className="mt-1 text-xs">
                  {p.pessoasViram != null && <>Alcançou {mil(p.pessoasViram)} pessoas. </>}
                  {p.compartilhamentos != null && <>{p.compartilhamentos} compartilhamentos. </>}
                  {p.guardaram != null && <>{p.guardaram} salvamentos.</>}
                </p>
              </div>
            ))}
          </div>
          {amostraPequena(r.posts.length) && <p className="mt-2 text-xs text-texto-suave">São poucos posts no período, então isso é indício, não prova.</p>}
        </BlocoDoc>
      )}

      {r.publico && (
        <BlocoDoc titulo="Quem segue o perfil">
          <p className="text-sm">
            {r.publico.mulheresPct != null && <>{r.publico.mulheresPct}% mulheres{r.publico.homensPct != null ? `, ${r.publico.homensPct}% homens` : ""}. </>}
            {r.publico.faixaPrincipal && <>Faixa de idade que mais aparece: {r.publico.faixaPrincipal} anos. </>}
            {r.publico.cidades.length > 0 && <>Cidades que mais aparecem: {r.publico.cidades.join(", ")}.</>}
          </p>
        </BlocoDoc>
      )}

      <BlocoDoc titulo="Pontos de atenção">
        <ul className="list-disc pl-5 text-sm">
          <li>Os últimos 1 ou 2 dias ainda podem estar incompletos na Meta.</li>
          <li>Os números juntam anúncio e orgânico: para separar o que veio de cada um, é preciso cruzar com a aba Anúncios.</li>
          {r.faltou.length > 0 && <li>A Meta não devolveu: {r.faltou.join(", ")}. Esses itens ficaram de fora em vez de serem estimados.</li>}
        </ul>
      </BlocoDoc>

      <BlocoDoc titulo="Prints do Meta Business Suite">
        <div className="nao-imprimir mb-3">
          <label className="text-xs font-semibold">
            Escolha os prints (opcional), eles aparecem aqui e saem no PDF:
            <input
              type="file"
              accept="image/*"
              multiple
              className="mt-1 block text-xs"
              onChange={(e) => setPrints(Array.from(e.target.files ?? []).map((f) => URL.createObjectURL(f)))}
            />
          </label>
        </div>
        {prints.length === 0 ? (
          <p className="nao-imprimir text-xs text-texto-suave">Nenhum print escolhido. Os prints mostram ao cliente que o número foi tirado direto da Meta.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {prints.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={`Print ${i + 1} do Meta Business Suite`} className="break-inside-avoid rounded-bloco border border-linha" />
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-texto-suave">Fonte: Meta, Insights do Instagram.</p>
      </BlocoDoc>
    </Documento>
  );
}
