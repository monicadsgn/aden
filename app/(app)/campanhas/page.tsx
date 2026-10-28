"use client";

// Campanhas: cada página de captação ou oferta (o quiz, uma LP, um "mês grátis") com ficha própria.
// Dá para pausar, reativar, arquivar e editar. Nada se apaga. As regras da oferta são texto livre por enquanto.

import { Archive, ArrowLeft, BarChart3, ExternalLink, Megaphone, Pause, Play, Plus, Settings2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PainelDoQuiz } from "@/components/crm/PainelDoQuiz";
import { FunilDoQuiz } from "@/components/crm/QuizLead";
import { Recolhivel } from "@/components/Recolhivel";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Botao, CampoNumero, Segmentado, Vazio, type Tom } from "@/components/ui";
import { faltaDefinir, mudarStatusCampanha, novaCampanha, ordenarCampanhas, paginaUrlValida, rotuloStatus, STATUS_CAMPANHA, type Campanha, type StatusCampanha } from "@/lib/calculo/campanhas";
import { novoId } from "@/lib/calculo/novo";
import { resumoDoQuiz, type VisitaQuiz } from "@/lib/calculo/quizFunil";
import { useDados } from "@/lib/dados/contexto";

const TOM: Record<StatusCampanha, Tom> = { ativa: "ok", pausada: "aviso", arquivada: "neutro" };
type Filtro = StatusCampanha | "todas";

function Texto({ rotulo, dica, valor, aoSair, podeEditar, linhas = 3 }: { rotulo: string; dica: string; valor: string; aoSair: (v: string) => void; podeEditar: boolean; linhas?: number }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave">
      {rotulo}
      <span className="text-[12px] font-normal">{dica}</span>
      <textarea
        key={valor}
        rows={linhas}
        disabled={!podeEditar}
        defaultValue={valor}
        onBlur={(e) => e.target.value !== valor && aoSair(e.target.value)}
        className="rounded-campo border border-linha bg-superficie px-3 py-2 text-sm font-normal text-texto focus:border-marca focus:outline-none disabled:opacity-60"
      />
    </label>
  );
}

export default function Campanhas() {
  const { repo, usuario } = useDados();
  const podeEditar = usuario?.papel === "admin" || repo.modo === "local";
  const [lista, setLista] = useState<Campanha[]>([]);
  const [visitas, setVisitas] = useState<VisitaQuiz[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("ativa");
  const [novo, setNovo] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [c, q] = await Promise.all([repo.listarCampanhas(), repo.quizProgresso().catch(() => [] as VisitaQuiz[])]);
        setLista(c);
        setVisitas(q);
        const id = new URLSearchParams(window.location.search).get("campanha");
        if (id) setAberta(id);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não deu para carregar as campanhas.");
      } finally {
        setCarregado(true);
      }
    })();
  }, [repo]);

  const salvar = async (c: Campanha) => {
    setErro(null);
    setLista((l) => (l.some((x) => x.id === c.id) ? l.map((x) => (x.id === c.id ? c : x)) : [c, ...l]));
    try {
      await repo.salvarCampanha(c);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
      setLista(await repo.listarCampanhas());
    }
  };

  const mostradas = useMemo(() => ordenarCampanhas(lista).filter((c) => filtro === "todas" || c.status === filtro), [lista, filtro]);
  const atual = lista.find((c) => c.id === aberta) ?? null;
  const contagem = (s: StatusCampanha) => lista.filter((c) => c.status === s).length;

  if (!carregado) return null;

  if (atual) {
    const ehQuiz = atual.tipo === "quiz";
    const set = (p: Partial<Campanha>) => salvar({ ...atual, ...p });
    const falta = faltaDefinir(atual);
    const resumo = resumoDoQuiz(visitas);
    return (
      <div className="pb-16">
        <CabecalhoPagina
          icone={Megaphone}
          selo="Comercial"
          titulo={atual.nome}
          descricao="Ficha da campanha: o que ela promete, quem pode entrar e como está indo. Pausar não derruba a página: é só o combinado entre os sócios."
          ajuda="/campanhas"
        />
        <div className="mx-auto flex max-w-[900px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          {erro && <p className="rounded-card bg-aviso-suave px-4 py-3 text-sm text-aviso">{erro}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Botao pequeno variante="fantasma" icone={ArrowLeft} onClick={() => setAberta(null)}>
              Todas as campanhas
            </Botao>
            <Badge tom={TOM[atual.status]}>{rotuloStatus(atual.status)}</Badge>
            {podeEditar && (
              <span className="ml-auto flex flex-wrap gap-2">
                {atual.status === "ativa" && (
                  <Botao pequeno icone={Pause} onClick={() => set(mudarStatusCampanha(atual, "pausada"))}>
                    Pausar
                  </Botao>
                )}
                {atual.status === "pausada" && (
                  <Botao pequeno variante="primario" icone={Play} onClick={() => set(mudarStatusCampanha(atual, "ativa"))}>
                    Reativar
                  </Botao>
                )}
                {atual.status !== "arquivada" ? (
                  <Botao pequeno icone={Archive} onClick={() => set(mudarStatusCampanha(atual, "arquivada"))}>
                    Arquivar
                  </Botao>
                ) : (
                  <Botao pequeno icone={Undo2} onClick={() => set(mudarStatusCampanha(atual, "pausada"))}>
                    Tirar do arquivo
                  </Botao>
                )}
              </span>
            )}
          </div>
          <p className="text-sm text-texto-suave">{STATUS_CAMPANHA.find((s) => s.valor === atual.status)?.explica}</p>
          {falta.length > 0 && <p className="rounded-card bg-marca-tinta/60 px-4 py-3 text-sm text-texto-suave">Ainda não está definido: {falta.join(", ")}. Dá para preencher quando os sócios combinarem.</p>}

          <Recolhivel id={`campanha-${atual.id}-oferta`} icone={Settings2} titulo="A oferta" resumo={atual.promete || "O que promete, quem entra, regras e limite"} abertoPadrao>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave">
                Nome
                <input
                  key={atual.nome}
                  disabled={!podeEditar}
                  defaultValue={atual.nome}
                  onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== atual.nome && set({ nome: e.target.value.trim() })}
                  className="h-11 rounded-campo border border-linha bg-superficie px-3 text-sm font-normal text-texto focus:border-marca focus:outline-none disabled:opacity-60"
                />
              </label>
              <Texto rotulo="O que a campanha promete" dica="O que o anúncio e a página dizem para quem chega (ex.: o que a pessoa ganha)." valor={atual.promete} aoSair={(v) => set({ promete: v })} podeEditar={podeEditar} />
              <Texto rotulo="Quem pode entrar (e quem não)" dica="O perfil que a gente quer. Quem fica de fora?" valor={atual.quemEntra} aoSair={(v) => set({ quemEntra: v })} podeEditar={podeEditar} />
              <Texto rotulo="Regras" dica="As condições da oferta, escritas do jeito que os sócios combinaram." valor={atual.regras} aoSair={(v) => set({ regras: v })} podeEditar={podeEditar} linhas={4} />
              <Texto rotulo="Serviços que a oferta cobre" dica="Quais serviços entram nela." valor={atual.servicos} aoSair={(v) => set({ servicos: v })} podeEditar={podeEditar} linhas={2} />
              <CampoNumero
                rotulo="Limite de clientes"
                valor={atual.limiteClientes}
                aoMudar={(v) => podeEditar && set({ limiteClientes: v == null ? null : Math.max(0, Math.round(v)) })}
                placeholder="sem limite combinado"
              />
              <Texto rotulo="Notas" dica="Qualquer combinado, dúvida ou lembrete sobre esta campanha." valor={atual.notas} aoSair={(v) => set({ notas: v })} podeEditar={podeEditar} />
            </div>
          </Recolhivel>

          <Recolhivel id={`campanha-${atual.id}-pagina`} icone={ExternalLink} titulo="Página e anúncios" resumo={ehQuiz ? "WhatsApp, Instagram, pixel e links com campanha" : atual.paginaUrl || "Link da página"}>
            <div className="flex flex-col gap-4">
              {ehQuiz ? (
                <>
                  <p className="text-sm text-texto-suave">A página do quiz fica em /quiz. Aqui você troca WhatsApp, Instagram, códigos dos anúncios e gera os links com campanha.</p>
                  <PainelDoQuiz repo={repo} podeEditar={podeEditar} />
                </>
              ) : (
                <>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave">
                    Link da página (começa com https://)
                    <input
                      key={atual.paginaUrl}
                      disabled={!podeEditar}
                      defaultValue={atual.paginaUrl}
                      placeholder="https://"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v === atual.paginaUrl) return;
                        if (!paginaUrlValida(v)) {
                          setErro("O link da página precisa começar com https://");
                          e.target.value = atual.paginaUrl;
                          return;
                        }
                        void set({ paginaUrl: v });
                      }}
                      className="h-11 rounded-campo border border-linha bg-superficie px-3 text-sm font-normal text-texto focus:border-marca focus:outline-none disabled:opacity-60"
                    />
                  </label>
                  {atual.paginaUrl && (
                    <a href={atual.paginaUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-sm font-semibold text-marca-forte underline">
                      Abrir a página <ExternalLink size={14} aria-hidden />
                    </a>
                  )}
                </>
              )}
            </div>
          </Recolhivel>

          {ehQuiz && (
            <Recolhivel
              id={`campanha-${atual.id}-resultados`}
              icone={BarChart3}
              titulo="Resultados"
              resumo={visitas.length ? `${resumo.comecaram} começaram, ${resumo.enviaram} enviaram o contato (${resumo.taxaDeEnvio.toLocaleString("pt-BR")}%)` : "Ainda sem visitas"}
            >
              {visitas.length ? <FunilDoQuiz visitas={visitas} embutido /> : <p className="text-sm text-texto-suave">Quando as primeiras pessoas começarem o quiz, o funil aparece aqui.</p>}
            </Recolhivel>
          )}

          <p className="text-[12px] text-texto-suave">
            Tudo o que muda aqui fica registrado no <Link href="/historico" className="font-semibold text-marca-forte underline">Histórico</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={Megaphone}
        selo="Comercial"
        titulo="Campanhas"
        descricao="As páginas e ofertas que trazem gente para a Aden (o quiz, uma LP, um mês grátis). Cada uma tem a sua ficha e pode ser pausada, reativada ou arquivada."
      />
      <div className="mx-auto flex max-w-[900px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {erro && <p className="rounded-card bg-aviso-suave px-4 py-3 text-sm text-aviso">{erro}</p>}
        <Segmentado
          rotulo="Mostrar campanhas"
          valor={filtro}
          aoMudar={setFiltro}
          opcoes={[
            { valor: "ativa", rotulo: `Ativas (${contagem("ativa")})` },
            { valor: "pausada", rotulo: `Pausadas (${contagem("pausada")})` },
            { valor: "arquivada", rotulo: `Arquivadas (${contagem("arquivada")})` },
            { valor: "todas", rotulo: "Todas" },
          ]}
        />
        {podeEditar && (
          <div className="flex items-center gap-2 rounded-botao border border-linha bg-superficie px-4 focus-within:border-marca focus-within:ring-2 focus-within:ring-marca/20">
            <Plus size={15} className="text-texto-suave" />
            <input
              className="sem-contorno h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-texto-suave"
              placeholder="Nova campanha: escreva o nome e aperte Enter"
              aria-label="Nova campanha"
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && novo.trim()) {
                  const c = novaCampanha(novoId(), novo);
                  void salvar(c);
                  setNovo("");
                  setFiltro("ativa");
                  setAberta(c.id);
                }
              }}
            />
          </div>
        )}
        {mostradas.length === 0 ? (
          <Vazio icone={Megaphone} titulo="Nenhuma campanha aqui">
            Troque o filtro acima ou crie uma nova.
          </Vazio>
        ) : (
          <ul className="flex flex-col gap-2">
            {mostradas.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setAberta(c.id)}
                  className="flex w-full items-center gap-3 rounded-card border border-linha bg-superficie px-4 py-3 text-left transition-colors hover:border-marca/50"
                >
                  <Megaphone size={18} className="shrink-0 text-marca-forte" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{c.nome}</span>
                    <span className="block truncate text-[12px] text-texto-suave">{c.promete || (c.tipo === "quiz" ? "Quiz de conversão no ar em /quiz" : "Ainda sem descrição")}</span>
                  </span>
                  <Badge tom={TOM[c.status]}>{rotuloStatus(c.status)}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
