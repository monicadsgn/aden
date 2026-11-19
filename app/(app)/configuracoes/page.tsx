"use client";

import {
  FileQuestion,
  FileSignature,
  Handshake,
  History,
  KeyRound,
  
  Package,
  Trophy,
  Truck,
  Building2,
  
  
  SlidersHorizontal,
  Layers,
  Lock,
  
  RotateCcw,
  Save,
  Scale,
  Settings2,
  Shapes,
  ShieldCheck,
  
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState  } from "react";
import {  } from "@/components/Avatar";
import {  } from "@/components/Alertas";
import { SERVICOS_CITADOS, TIPOS_CITADOS } from "@/components/configuracoes/auxiliares";
import type { ContextoConfig } from "@/components/configuracoes/contexto";
import { SecaoCustos } from "@/components/configuracoes/SecaoCustos";
import { SecaoLimites } from "@/components/configuracoes/SecaoLimites";
import { SecaoRegras } from "@/components/configuracoes/SecaoRegras";
import { SecaoServicos } from "@/components/configuracoes/SecaoServicos";
import { SecaoSocios } from "@/components/configuracoes/SecaoSocios";
import { SecaoTipos } from "@/components/configuracoes/SecaoTipos";
import { SecaoBriefing } from "@/components/configuracoes/SecaoBriefing";
import { SecaoContrato } from "@/components/configuracoes/SecaoContrato";
import { SecaoOnboarding } from "@/components/configuracoes/SecaoOnboarding";
import { SecaoEquipe } from "@/components/configuracoes/SecaoEquipe";
import { SecaoMetas, SecaoPacotes, SecaoTerceiros } from "@/components/configuracoes/SecoesNovas";
import { CabecalhoPagina } from "@/components/Shell";
import {  } from "@/components/Recolhivel";
import {
  
  Botao,
  Card,
  
  
  
  
  
  
  
  
  TituloCard,
  
  cx,
  useParametro,
} from "@/components/ui";
import { verificarImpostoEmDobro } from "@/lib/calculo/motor";
import { configVazia, novoId } from "@/lib/calculo/novo";
import type { Configuracao, SecaoConfig } from "@/lib/calculo/tipos";
import {  } from "@/lib/dados/acoes";
import { useDados } from "@/lib/dados/contexto";
import { diferenca, temAlteracoes, type AlteracoesConfig, type Membro, type Pedido } from "@/lib/dados/repositorio";
import {  } from "@/lib/formato";
import { REGRAS_PROTECAO, type ItemProtegido } from "@/lib/regras/aprovacao";
import { pendencias as calcularPendencias, SEM_O_OBRIGATORIO } from "@/lib/regras/pendencias";
import { COM_VOLUME } from "@/lib/recursos";

const SECOES: { id: SecaoConfig; rotulo: string; icone: LucideIcon; frase: string }[] = [
  { id: "socios", rotulo: "Sócios", icone: Users, frase: "Quem divide o resultado, o piso por hora de cada um e quantas horas cada um tem no mês." },
  { id: "servicos", rotulo: "Serviços", icone: Layers, frase: "O que a Aden vende e quem executa as horas de cada serviço." },
  { id: "tipos", rotulo: "Tipos de entrega", icone: Shapes, frase: "Quanto tempo leva cada entrega (post, carrossel, roteiro…). É a base de todas as horas." },
  { id: "custos", rotulo: "Custos fixos", icone: Building2, frase: "O que a empresa paga todo mês, tenha cliente ou não. É dividido entre os clientes." },
  { id: "terceiros", rotulo: "Terceiros", icone: Truck, frase: "Serviços terceirizados cobrados por saída (ex.: audiovisual). Custo só do cliente que recebe." },
  { id: "pacotes", rotulo: "Pacotes", icone: Package, frase: "Pacotes fechados para a Proposta. O preço sai do cálculo, nunca digitado." },
  { id: "briefing", rotulo: "Briefing", icone: FileQuestion, frase: "As perguntas do briefing que o Áleff e a Moni respondem na ficha de cada cliente." },
  { id: "onboarding", rotulo: "Onboarding", icone: Handshake, frase: "O texto que o cliente recebe ao fechar: boas-vindas, como funciona cada serviço, próximos passos e contato." },
  { id: "contrato", rotulo: "Contrato", icone: FileSignature, frase: "O que é igual em todo contrato da Aden: dados da contratada, quem assina e o texto das obrigações e disposições." },
  { id: "metas", rotulo: "Metas", icone: Trophy, frase: "A trilha de crescimento em degraus, com a ação de cada degrau. Aparece na tela Mês." },
  { id: "equipe", rotulo: "Equipe e acessos", icone: KeyRound, frase: "Quem entra no Aden e o que cada um vê: sócios, equipe, freelancers e contador." },
  { id: "regras", rotulo: "Regras da empresa", icone: Scale, frase: "Regime e imposto, como dividir o custo fixo, reinvestimento, taxas e como distribuir cada pagamento." },
  { id: "limites", rotulo: "Limites e avisos", icone: SlidersHorizontal, frase: "Quando o sistema acende um alerta. Vazio = sem aviso." },
];

// G5 da auditoria (01/10/2026): configurações do sistema × configurações comerciais, na ordem de preenchimento
// (o número na aba). Metas e Limites são opcionais e ficam sem número. Datas comemorativas foram para o Calendário.
const GRUPOS_SECOES: { titulo: string; frase: string; ids: SecaoConfig[]; ordem: SecaoConfig[] }[] = [
  {
    titulo: "Sistema",
    frase: "Sócios, dinheiro da empresa e quem acessa.",
    ids: ["socios", "custos", "regras", "equipe", "metas", "limites"],
    ordem: ["socios", "custos", "regras", "equipe"],
  },
  {
    titulo: "Comercial",
    frase: "O que a Aden vende e os documentos do cliente.",
    ids: ["servicos", "tipos", "terceiros", "pacotes", "contrato", "onboarding", "briefing"],
    ordem: ["servicos", "tipos", "terceiros", "pacotes", "contrato", "onboarding", "briefing"],
  },
];
/** seções com campo protegido (cadeado): só nelas aparece a explicação da proteção */
const COM_CADEADO: SecaoConfig[] = ["socios", "servicos", "tipos", "regras"];

export default function Configuracoes() {
  const { repo, usuario, atualizarUsuario } = useDados();
  const [original, setOriginal] = useState<Configuracao>(configVazia());
  const [rascunho, setRascunho] = useState<Configuracao>(configVazia());
  const [membros, setMembros] = useState<Membro[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro" | "aviso"; texto: string } | null>(null);
  const router = useRouter();
  const secaoUrl = useParametro("secao") as SecaoConfig | null;
  const campoUrl = useParametro("campo");
  const [secao, setSecao] = useState<SecaoConfig>("socios");

  useEffect(() => {
    // os dados do cliente moram só na ficha (grave 5 da auditoria): o endereço antigo leva para lá
    if (secaoUrl === "clientes") {
      router.replace("/clientes");
      return;
    }
    // datas comemorativas moram no Calendário (G5)
    if ((secaoUrl as string) === "datas") {
      router.replace("/calendario?aba=datas");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a seção vem da URL (botões dos avisos)
    if (secaoUrl && SECOES.some((s) => s.id === secaoUrl)) setSecao(secaoUrl);
  }, [secaoUrl, router]);
  const [temMedicao, setTemMedicao] = useState(false);
  useEffect(() => {
    repo.listarMedicoes().then((m) => setTemMedicao(m.length > 0)).catch(() => {});
  }, [repo]);

  const carregar = useCallback(async () => {
    try {
      const c = await repo.carregarConfig();
      setOriginal(c);
      setRascunho(structuredClone(c));
      setMembros(await repo.listarMembros().catch(() => []));
      setPedidos(await repo.listarPedidos().catch(() => []));
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

  // leva até o campo que o aviso mandou resolver
  useEffect(() => {
    if (!carregado || !campoUrl) return;
    const t = setTimeout(() => {
      const alvos = [...document.querySelectorAll<HTMLElement>(`[data-campo="${campoUrl}"]`)];
      if (!alvos.length) return;
      const vazio = alvos.find((a) => a.querySelector("input")?.value === "") ?? alvos[0];
      vazio.scrollIntoView({ behavior: "smooth", block: "center" });
      for (const a of alvos) a.classList.add("destaque-alvo");
      vazio.querySelector("input")?.focus({ preventScroll: true });
      setTimeout(() => alvos.forEach((a) => a.classList.remove("destaque-alvo")), 2200);
    }, 150);
    return () => clearTimeout(t);
  }, [carregado, campoUrl, secao]);

  const irPara = (s: SecaoConfig) => {
    setSecao(s);
    try {
      window.history.replaceState(null, "", `/configuracoes?secao=${s}`);
    } catch {}
  };

  const alteracoes: AlteracoesConfig = useMemo(
    () => ({
      empresa: JSON.stringify(original.empresa) !== JSON.stringify(rascunho.empresa) ? rascunho.empresa : undefined,
      pessoas: diferenca(original.pessoas, rascunho.pessoas),
      servicos: diferenca(original.servicos, rascunho.servicos),
      tiposEntrega: diferenca(original.tiposEntrega, rascunho.tiposEntrega),
      custosFixos: diferenca(original.custosFixos, rascunho.custosFixos),
      clientes: diferenca(original.clientes, rascunho.clientes),
      terceiros: diferenca(original.terceiros ?? [], rascunho.terceiros ?? []),
      pacotes: diferenca(original.pacotes ?? [], rascunho.pacotes ?? []),
      metas: diferenca(original.metas ?? [], rascunho.metas ?? []),
    }),
    [original, rascunho],
  );
  const sujo = temAlteracoes(alteracoes);
  const pendencias = useMemo(() => calcularPendencias(rascunho), [rascunho]);
  const pendentes = pedidos.filter((p) => p.status === "pendente" && p.tipo === "campos");
  const itemPendente = (campo: ItemProtegido["campo"], registroId: string, pessoaId?: string) =>
    pendentes.flatMap((p) => p.itens).find((i) => i.campo === campo && i.registroId === registroId && (pessoaId == null || i.pessoaId === pessoaId)) ?? null;
  const nomePessoa = (id: string) => original.pessoas.find((p) => p.id === id)?.nome ?? "sócio";
  const nomes = (ids: string[]) => ids.map(nomePessoa).join(" e ");

  const salvar = async () => {
    setSalvando(true);
    setMensagem(null);
    try {
      const r = await repo.salvarConfig(alteracoes);
      await carregar();
      if (r.pedido?.status === "pendente")
        setMensagem({
          tom: "aviso",
          texto: `Salvo. ${r.itensProtegidos.length} mudança(s) protegida(s) esperando a aprovação de ${nomes(r.pedido.aguardando)}. Até lá vale o valor antigo.`,
        });
      else if (r.pedido?.status === "aplicado") setMensagem({ tom: "ok", texto: "Salvo. A mudança protegida valeu na hora, porque você é o único sócio afetado. Ficou no histórico." });
      else setMensagem({ tom: "ok", texto: "Configurações salvas. A alteração ficou registrada no histórico." });
    } catch (e) {
      setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSalvando(false);
    }
  };

  const set = (patch: Partial<Configuracao>) => setRascunho((r) => ({ ...r, ...patch }));
  const socios = rascunho.pessoas.filter((p) => p.socio);
  const somaSocios = socios.filter((p) => p.ativo).reduce((a, p) => a + (p.percentualPadrao ?? 0), 0);
  const totalFixo = rascunho.custosFixos.filter((c) => c.ativo).reduce((a, c) => a + (c.valorMensalCentavos ?? 0), 0);
  const e = rascunho.empresa;
  const setE = (patch: Partial<Configuracao["empresa"]>) => set({ empresa: { ...e, ...patch } });
  const dobro = verificarImpostoEmDobro(rascunho);
  const loginsUsados = new Set(rascunho.pessoas.map((p) => p.membroId).filter(Boolean));

  const adicionarCitados = () => {
    const servicos = [...rascunho.servicos];
    for (const nome of SERVICOS_CITADOS)
      if (!servicos.some((s) => s.nome.toLowerCase() === nome.toLowerCase())) servicos.push({ id: novoId(), nome, divisaoPadrao: {}, ativo: true });
    const tipos = [...rascunho.tiposEntrega];
    for (const nome of TIPOS_CITADOS)
      if (!tipos.some((t) => t.nome.toLowerCase() === nome.toLowerCase())) tipos.push({ id: novoId(), nome, servicoId: null, horasPorUnidade: null, audiovisual: false, ativo: true });
    set({ servicos, tiposEntrega: tipos });
  };

  if (!carregado) return null;
  const e0 = rascunho.empresa;
  const ctx: ContextoConfig = { original, rascunho, membros, pedidos, set, socios, somaSocios, totalFixo, e, e0, setE, dobro, loginsUsados, adicionarCitados, itemPendente, pendentes, nomePessoa, nomes, temMedicao, usuario, atualizarUsuario, repo, irPara, setOriginal };
  const atual = SECOES.find((s) => s.id === secao)!;
  // Fase 1: com poucos clientes, Metas e Limites ficam fora das abas até terem uso (ou se a URL pedir).
  const usa: Partial<Record<SecaoConfig, boolean>> = {
    metas: COM_VOLUME.secaoMetas || (rascunho.metas ?? []).length > 0,
    limites:
      COM_VOLUME.secaoLimites ||
      [e0.tetoFaturamentoAnualCentavos, e0.avisoTetoPct, e0.ociosidadePct, e0.arredondamentoPropostaCentavos, e0.diferencaSugerirPct, e0.diasLeadParado, e0.prazoMinimoPedidoDiasUteis].some(
        (v) => v != null,
      ),
  };
  const secoesVisiveis = SECOES.filter((s) => usa[s.id] !== false || s.id === secao);

  return (
    <div className="pb-28">
      <CabecalhoPagina
        icone={Settings2}
        selo="Ajustes"
        titulo="Configurações"
        descricao="Regras padrão da empresa, uma seção de cada vez. Nada aqui vem preenchido. Toda alteração fica registrada com autor e data."
        acoes={
          <Link href="/historico" className="inline-flex items-center gap-1.5 rounded-botao border border-linha bg-superficie px-3 py-2 text-xs font-semibold hover:border-marca">
            <History size={14} /> Histórico de alterações
          </Link>
        }
      />

      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <p className="px-1 text-[12px] text-texto-suave">
          Tudo aqui se configura uma vez e muda pouco: preencha na ordem dos números. O que mexe todo mês fica no dia a dia (datas comemorativas no
          Calendário, atalhos do painel na ficha do cliente).
          {pendentes.length > 0 && (
            <>
              {" "}
              <Link href="/aprovacoes" className="font-bold text-marca-forte underline">
                {pendentes.length} pedido(s) esperando aprovação.
              </Link>
            </>
          )}
        </p>

        {/* abas em dois grupos (G5): sistema e comercial, com o número da ordem de preenchimento */}
        <div className="flex flex-col gap-3 md:flex-row md:gap-6" role="tablist" aria-label="Seções das configurações">
          {GRUPOS_SECOES.map((g) => (
            <div key={g.titulo} className="flex min-w-0 flex-col gap-1.5">
              <p className="px-1 text-[11px] font-bold tracking-wide text-texto-suave uppercase">
                Configurações {g.titulo === "Sistema" ? "do sistema" : "comerciais"} <span className="font-medium normal-case tracking-normal">· {g.frase}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {g.ids
                  .flatMap((id) => secoesVisiveis.filter((s) => s.id === id))
                  .map((s) => {
                    const Ic = s.icone;
                    const n = pendencias[s.id].obrigatorio.length;
                    const sel = s.id === secao;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="tab"
                        aria-selected={sel}
                        onClick={() => irPara(s.id)}
                        className={cx(
                          "flex min-h-10 shrink-0 items-center gap-1.5 rounded-botao border px-3.5 py-2 text-xs font-bold transition-all pointer-coarse:min-h-11",
                          sel ? "border-marca bg-marca-cheio text-sobre-marca shadow-card" : "border-linha bg-superficie text-texto hover:border-marca/50",
                        )}
                      >
                        {g.ordem.includes(s.id) ? (
                          <span className={cx("numero inline-flex size-4 items-center justify-center rounded-full text-[10px]", sel ? "bg-sobre-marca/25" : "bg-marca-suave text-marca-forte")} aria-label={`passo ${g.ordem.indexOf(s.id) + 1}`}>
                            {g.ordem.indexOf(s.id) + 1}
                          </span>
                        ) : (
                          <Ic size={14} />
                        )}
                        {s.rotulo}
                        {!g.ordem.includes(s.id) && <span className="text-[10px] font-medium opacity-70">opcional</span>}
                        {n > 0 && (
                          <span className={cx("rounded-botao px-1.5 py-px text-[9px] font-bold uppercase", sel ? "bg-sobre-marca/25" : "bg-aviso-suave text-aviso")} title={`Obrigatório: ${pendencias[s.id].obrigatorio.join(", ")}`}>
                            falta preencher
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        <Card>
          <TituloCard icone={atual.icone} titulo={atual.rotulo} descricao={atual.frase} />
          {/* D2: estas seções gravam cada mudança na hora; as outras usam a barra Salvar embaixo */}
          {(["equipe", "briefing", "onboarding", "contrato"] as SecaoConfig[]).includes(secao) && (
            <p className="-mt-2 px-5 pb-3 text-[12px] text-texto-suave">Esta seção salva sozinha, a cada mudança: não precisa do botão Salvar.</p>
          )}
          <div className="px-5 pb-5">
            {pendencias[secao].obrigatorio.length > 0 && (
              <p className="mb-2 rounded-bloco bg-aviso-suave px-3 py-2 text-[12px] font-medium text-aviso">
                <strong>Obrigatório:</strong> {pendencias[secao].obrigatorio.join(", ")}
                {SEM_O_OBRIGATORIO[secao] ? ` (sem isso, ${SEM_O_OBRIGATORIO[secao]}).` : "."}
              </p>
            )}
            {pendencias[secao].opcional.length > 0 && (
              <p className="mb-3 px-1 text-[12px] leading-snug text-texto-suave">
                <strong className="text-texto">Opcional, pode ficar vazio:</strong> {pendencias[secao].opcional.map((o) => `${o.campo} (vazio = ${o.vazio})`).join("; ")}.
              </p>
            )}
            {COM_CADEADO.includes(secao) && (
              <details className="mb-3 rounded-bloco bg-marca-tinta px-3 py-2 text-[12px] leading-relaxed">
                <summary className="flex min-h-8 cursor-pointer items-center gap-1.5 font-semibold text-marca-forte">
                  <ShieldCheck size={14} /> Os campos com <Lock size={11} className="inline" /> protegem a remuneração dos sócios. Como funciona?
                </summary>
                <p className="mt-1">{REGRAS_PROTECAO}</p>
              </details>
            )}

            {secao === "socios" && <SecaoSocios ctx={ctx} />}

            {secao === "servicos" && <SecaoServicos ctx={ctx} />}

            {secao === "tipos" && <SecaoTipos ctx={ctx} />}

            {secao === "custos" && <SecaoCustos ctx={ctx} />}

            {secao === "terceiros" && <SecaoTerceiros rascunho={rascunho} set={set} />}
            {secao === "pacotes" && <SecaoPacotes rascunho={rascunho} set={set} />}
            {secao === "metas" && <SecaoMetas rascunho={rascunho} set={set} />}
            {secao === "equipe" && <SecaoEquipe />}
            {secao === "briefing" && <SecaoBriefing servicos={rascunho.servicos} />}
            {secao === "onboarding" && <SecaoOnboarding servicos={rascunho.servicos} />}
            {secao === "contrato" && <SecaoContrato />}

            {secao === "regras" && <SecaoRegras ctx={ctx} />}

            {secao === "limites" && <SecaoLimites ctx={ctx} />}

          </div>
        </Card>

        {usuario?.pessoaId == null && repo.modo === "supabase" && usuario?.papel === "admin" && (
          <p className="text-[12px] text-texto-suave">
            Seu login ainda não está ligado a um sócio: mudanças em campos protegidos que você fizer vão esperar a aprovação de todos os afetados. Ligue em Sócios → Login deste sócio.
          </p>
        )}
      </div>

      {/* barra de salvar */}
      {(sujo || mensagem) && (
        <div className="nao-imprimir fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4 lg:pl-64">
          <div className="flex w-full max-w-2xl flex-wrap items-center gap-3 vidro rounded-card border bg-superficie px-4 py-2 shadow-forte">
            <p className={cx("flex-1 text-xs font-semibold", mensagem?.tom === "erro" ? "text-erro" : mensagem?.tom === "aviso" ? "text-aviso" : sujo ? "text-texto" : "text-ok")}>
              {sujo ? "Há alterações não salvas." : mensagem?.texto}
              {sujo && mensagem?.tom === "erro" && <span className="block text-erro">{mensagem.texto}</span>}
            </p>
            {sujo && (
              <>
                <Botao pequeno variante="fantasma" icone={RotateCcw} onClick={() => setRascunho(structuredClone(original))}>
                  Descartar
                </Botao>
                <Botao pequeno variante="primario" icone={Save} disabled={salvando} onClick={salvar}>
                  {salvando ? "Salvando…" : "Salvar"}
                </Botao>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
