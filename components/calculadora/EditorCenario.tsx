"use client";

import {
  CalendarClock,
  Clapperboard,
  DoorOpen,
  Gem,
  ListChecks,
  Megaphone,
  Percent,
  Plus,
  Receipt,
  RotateCcw,
  Shapes,
  Trash2,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { novaLinhaCusto, novaLinhaEntrega, novoPontual } from "@/lib/calculo/novo";
import type {
  CategoriaCusto,
  Cenario,
  Configuracao,
  LinhaCusto,
  LinhaEntrega,
  ModeloTrafego,
  Pct,
  ProjetoPontual,
} from "@/lib/calculo/tipos";
import { formatarHoras, formatarNumero, formatarPct } from "@/lib/formato";
import { Badge, Botao, Card, CampoMoeda, CampoNumero, CampoPct, CampoTexto, Passo, Rotulo, Segmentado, Selecao, TituloCard, cx } from "../ui";

const CATEGORIAS: { valor: CategoriaCusto; rotulo: string }[] = [
  { valor: "ferramenta", rotulo: "Ferramenta" },
  { valor: "audiovisual", rotulo: "Audiovisual" },
  { valor: "terceiro", rotulo: "Terceiro" },
  { valor: "outro", rotulo: "Outro (diária, deslocamento…)" },
];

const MODELOS_TRAFEGO: { valor: ModeloTrafego; rotulo: string }[] = [
  { valor: "fixo", rotulo: "Valor fixo" },
  { valor: "por_campanha", rotulo: "Por campanha" },
  { valor: "percentual_verba", rotulo: "Percentual da verba" },
  { valor: "incluido", rotulo: "Incluído na mensalidade" },
  { valor: "sem_trafego", rotulo: "Não há tráfego neste cenário" },
];

function Diferente({ ativo }: { ativo: boolean }) {
  return ativo ? <Badge tom="aviso">diferente do padrão</Badge> : null;
}

// ─── Entregas ───────────────────────────────────────────────────────────────

function EditorEntregas({
  linhas,
  config,
  aoMudar,
  unidade,
}: {
  linhas: LinhaEntrega[];
  config: Configuracao;
  aoMudar: (l: LinhaEntrega[]) => void;
  unidade: string;
}) {
  const tipos = config.tiposEntrega.filter((t) => t.ativo);
  const opcoes = tipos.map((t) => {
    const s = config.servicos.find((x) => x.id === t.servicoId);
    return { valor: t.id, rotulo: t.nome, grupo: s?.nome };
  });
  const mudar = (id: string, patch: Partial<LinhaEntrega>) => aoMudar(linhas.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  return (
    <div className="flex flex-col gap-2">
      {tipos.length === 0 && (
        <p className="rounded-bloco bg-aviso-suave px-3 py-2 text-xs font-medium text-aviso">
          Cadastre os tipos de entrega (e as horas de cada um) em Configurações.
        </p>
      )}
      {linhas.map((l) => {
        const tipo = config.tiposEntrega.find((t) => t.id === l.tipoEntregaId);
        const video = !!tipo?.audiovisual;
        const hUn = video ? 0 : (l.horasPorUnidade ?? tipo?.horasPorUnidade ?? null);
        const total = hUn != null && l.quantidade != null ? hUn * l.quantidade : null;
        const sobreposto = !video && l.horasPorUnidade != null && l.horasPorUnidade !== tipo?.horasPorUnidade;
        return (
          <div key={l.id} className="grid grid-cols-[auto_6.5rem_1fr_auto] items-end gap-2 rounded-bloco bg-superficie-2/60 p-3 2xl:grid-cols-[1fr_auto_6.5rem_4.5rem_auto]">
            <Selecao
              className="col-span-4 2xl:col-span-1"
              rotulo="Entrega"
              valor={l.tipoEntregaId}
              vazio="Escolha o tipo…"
              opcoes={opcoes}
              aoMudar={(v) => mudar(l.id, { tipoEntregaId: v, horasPorUnidade: null })}
            />
            <div>
              <Rotulo>{unidade}</Rotulo>
              <Passo ariaLabel="quantidade" valor={l.quantidade} aoMudar={(v) => mudar(l.id, { quantidade: v })} />
            </div>
            {video ? (
              <div className="col-span-2 pb-2 2xl:col-span-2">
                <Badge tom="info" icone={Clapperboard}>
                  vídeo de terceiro · sem horas
                </Badge>
              </div>
            ) : (
              <>
                <CampoNumero
                  rotulo="h/un."
                  sufixo="h"
                  destaque={sobreposto}
                  placeholder={tipo?.horasPorUnidade != null ? formatarNumero(tipo.horasPorUnidade) : "—"}
                  valor={l.horasPorUnidade}
                  aoMudar={(v) => mudar(l.id, { horasPorUnidade: v })}
                />
                <div className="pb-2.5 text-right">
                  <span className="numero text-sm font-bold">{formatarHoras(total)}</span>
                </div>
              </>
            )}
            <Botao variante="perigo" icone={Trash2} aria-label="Remover entrega" onClick={() => aoMudar(linhas.filter((x) => x.id !== l.id))} />
            {sobreposto && (
              <p className="col-span-full -mt-1 text-[11px] font-medium text-aviso">
                Horas por entrega diferentes do padrão ({formatarHoras(tipo?.horasPorUnidade)}).{" "}
                <button type="button" className="underline" onClick={() => mudar(l.id, { horasPorUnidade: null })}>
                  Voltar ao padrão
                </button>
              </p>
            )}
          </div>
        );
      })}
      <div>
        <Botao icone={Plus} pequeno disabled={tipos.length === 0} onClick={() => aoMudar([...linhas, novaLinhaEntrega()])}>
          Adicionar entrega
        </Botao>
      </div>
    </div>
  );
}

// ─── Custos ─────────────────────────────────────────────────────────────────

function EditorCustos({
  linhas,
  config,
  aoMudar,
  pontual,
}: {
  linhas: LinhaCusto[];
  config: Configuracao;
  aoMudar: (l: LinhaCusto[]) => void;
  pontual?: boolean;
}) {
  const mudar = (id: string, patch: Partial<LinhaCusto>) => aoMudar(linhas.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const tipos = config.tiposEntrega.filter((t) => t.ativo).map((t) => ({ valor: t.id, rotulo: t.nome }));
  return (
    <div className="flex flex-col gap-2">
      {linhas.map((l) => {
        const ferramenta = l.categoria === "ferramenta";
        const porEntrega = !ferramenta && l.forma === "por_entrega";
        return (
          <div key={l.id} className="grid grid-cols-2 items-end gap-2 rounded-bloco bg-superficie-2/60 p-3 sm:grid-cols-[8.5rem_1fr_9rem_auto]">
            <Selecao
              rotulo="Tipo de custo"
              valor={l.categoria}
              opcoes={CATEGORIAS}
              aoMudar={(v) => mudar(l.id, { categoria: (v ?? "ferramenta") as CategoriaCusto, forma: v === "ferramenta" ? "fixo" : l.forma })}
            />
            <CampoTexto rotulo="Descrição" placeholder="opcional" valor={l.descricao} aoMudar={(v) => mudar(l.id, { descricao: v })} />
            <CampoMoeda
              rotulo={porEntrega ? "Valor por entrega" : pontual ? "Valor do projeto" : ferramenta ? "Valor mensal" : "Valor fixo/mês"}
              valor={l.valorCentavos}
              aoMudar={(v) => mudar(l.id, { valorCentavos: v })}
            />
            <Botao variante="perigo" icone={Trash2} aria-label="Remover custo" onClick={() => aoMudar(linhas.filter((x) => x.id !== l.id))} />
            {!ferramenta && (
              <div className="col-span-full flex flex-wrap items-end gap-2">
                <div className="w-full max-w-xs">
                  <Segmentado
                    rotulo="Forma do custo"
                    valor={l.forma}
                    aoMudar={(v) => mudar(l.id, { forma: v })}
                    opcoes={[
                      { valor: "fixo", rotulo: pontual ? "Valor fechado" : "Fixo no mês" },
                      { valor: "por_entrega", rotulo: "Por entrega" },
                    ]}
                  />
                </div>
                {porEntrega && (
                  <Selecao className="min-w-48 flex-1" ariaLabel="Entrega vinculada" valor={l.tipoEntregaId} vazio="Multiplica qual entrega?" opcoes={tipos} aoMudar={(v) => mudar(l.id, { tipoEntregaId: v })} />
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        {CATEGORIAS.map((c) => (
          <Botao key={c.valor} icone={Plus} pequeno onClick={() => aoMudar([...linhas, novaLinhaCusto(c.valor)])}>
            {c.rotulo}
          </Botao>
        ))}
      </div>
    </div>
  );
}

// ─── Editor completo ────────────────────────────────────────────────────────

function Secao({ children }: { children: ReactNode }) {
  return <div className="px-5 pb-5">{children}</div>;
}

export function EditorCenario({ cenario, config, aoMudar }: { cenario: Cenario; config: Configuracao; aoMudar: (c: Cenario) => void }) {
  const set = (patch: Partial<Cenario>) => aoMudar({ ...cenario, ...patch });
  const sob = cenario.sobreposicoes;
  const setSob = (patch: Partial<Cenario["sobreposicoes"]>) => set({ sobreposicoes: { ...sob, ...patch } });
  const socios = config.pessoas.filter((p) => p.ativo && p.socio);
  const t = cenario.trafego;
  const setT = (patch: Partial<Cenario["trafego"]>) => set({ trafego: { ...t, ...patch } });

  // serviços com horas neste cenário (inclui pontuais)
  const entrada = cenario.entrada ?? { entregas: [], custos: [], valorCobradoCentavos: null, mesesParaPagar: null };
  const setEntrada = (patch: Partial<typeof entrada>) => set({ entrada: { ...entrada, ...patch } });
  const tiposUsados = new Set(
    [...cenario.entregas, ...entrada.entregas, ...cenario.pontuais.flatMap((p) => p.entregas)].map((l) => l.tipoEntregaId),
  );
  const servicosUsados = config.servicos.filter((s) => config.tiposEntrega.some((te) => te.servicoId === s.id && tiposUsados.has(te.id)));

  const mudarPontual = (id: string, patch: Partial<ProjetoPontual>) =>
    set({ pontuais: cenario.pontuais.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  const pctPadrao = (v: Pct) => (v == null ? "vazio" : formatarPct(v));

  return (
    <div className="flex flex-col gap-4">
      {/* Modo */}
      <Card>
        <TituloCard
          icone={cenario.modo === "escopo" ? ListChecks : Wallet}
          titulo="Como calcular"
          descricao={
            cenario.modo === "escopo"
              ? "Você monta o escopo e o sistema calcula o valor mínimo que ele precisa custar."
              : "Você informa o valor e o sistema mostra o que cabe dentro dele."
          }
        />
        <Secao>
          <Segmentado
            rotulo="Modo de cálculo"
            valor={cenario.modo}
            aoMudar={(v) => set({ modo: v })}
            opcoes={[
              { valor: "escopo", rotulo: "Escopo → valor mínimo", icone: ListChecks },
              { valor: "valor", rotulo: "Valor → o que cabe", icone: Wallet },
            ]}
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Selecao
              rotulo="Cliente"
              valor={cenario.clienteId}
              vazio="Cliente novo (entra somando aos ativos)"
              opcoes={config.clientes.filter((c) => c.ativo).map((c) => ({ valor: c.id, rotulo: c.nome || "(sem nome)" }))}
              aoMudar={(v) => set({ clienteId: v })}
            />
            {cenario.modo === "valor" && (
              <CampoMoeda rotulo="Mensalidade que o cliente vai pagar" valor={cenario.mensalidadeCentavos} aoMudar={(v) => set({ mensalidadeCentavos: v })} />
            )}
          </div>
        </Secao>
      </Card>

      {/* Entregas */}
      <Card>
        <TituloCard
          icone={Shapes}
          titulo="Rotina mensal"
          descricao="O que acontece todo mês: planejamento, reunião mensal, roteiros, estáticos, criativos pontuais e extras. Quantidade × horas por entrega."
          acao={<Badge tom="marca">todo mês</Badge>}
        />
        <Secao>
          <EditorEntregas linhas={cenario.entregas} config={config} unidade="Qtd./mês" aoMudar={(entregas) => set({ entregas })} />
        </Secao>
      </Card>

      {/* Quem executa */}
      {servicosUsados.length > 0 && socios.length > 0 && (
        <Card>
          <TituloCard icone={Users} titulo="Quem executa" descricao="Divisão das horas de cada serviço entre os sócios. Vazio = usa o padrão." />
          <Secao>
            <div className="flex flex-col gap-2">
              {servicosUsados.map((s) => {
                const o = sob.divisaoServico[s.id] ?? {};
                const efetivo = (pid: string) => o[pid] ?? s.divisaoPadrao[pid] ?? 0;
                const soma = socios.reduce((a, p) => a + efetivo(p.id), 0);
                const sobreposto = socios.some((p) => o[p.id] != null && o[p.id] !== s.divisaoPadrao[p.id]);
                return (
                  <div key={s.id} className="rounded-bloco bg-superficie-2/60 p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{s.nome}</span>
                      <Diferente ativo={sobreposto} />
                      {Math.abs(soma - 100) > 0.005 && <Badge tom="erro">soma {formatarPct(soma)}</Badge>}
                      {Object.keys(o).length > 0 && (
                        <button
                          type="button"
                          className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-texto-suave hover:text-texto"
                          onClick={() => {
                            const d = { ...sob.divisaoServico };
                            delete d[s.id];
                            setSob({ divisaoServico: d });
                          }}
                        >
                          <RotateCcw size={12} /> padrão
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {socios.map((p) => (
                        <CampoPct
                          key={p.id}
                          className="w-28"
                          rotulo={p.nome}
                          placeholder={pctPadrao(s.divisaoPadrao[p.id] ?? null)}
                          destaque={o[p.id] != null && o[p.id] !== s.divisaoPadrao[p.id]}
                          valor={o[p.id] ?? null}
                          aoMudar={(v) => setSob({ divisaoServico: { ...sob.divisaoServico, [s.id]: { ...o, [p.id]: v } } })}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Secao>
        </Card>
      )}

      {/* Custos */}
      <Card>
        <TituloCard
          icone={Receipt}
          titulo="Custos da rotina"
          descricao="Ferramentas são fixas e mensais. Audiovisual é sempre terceiro pago pela empresa, fixo ou por entrega de vídeo."
        />
        <Secao>
          <EditorCustos linhas={cenario.custos} config={config} aoMudar={(custos) => set({ custos })} />
        </Secao>
      </Card>

      {/* Entrada */}
      <Card>
        <TituloCard
          icone={DoorOpen}
          titulo="Entrada do cliente"
          descricao="Acontece uma vez só: onboarding, estrutura visual e proposta de conteúdo, enxoval do perfil, primeiros estáticos e criativos. Não pesa na rotina."
          acao={<Badge tom="aviso">uma vez</Badge>}
        />
        <Secao>
          <EditorEntregas linhas={entrada.entregas} config={config} unidade="Qtd. total" aoMudar={(entregas) => setEntrada({ entregas })} />
          <p className="mt-3 mb-2 text-xs font-bold text-texto-suave">Custos da entrada</p>
          <EditorCustos pontual linhas={entrada.custos} config={config} aoMudar={(custos) => setEntrada({ custos })} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <CampoMoeda rotulo="Valor cobrado pela entrada (opcional)" valor={entrada.valorCobradoCentavos} aoMudar={(v) => setEntrada({ valorCobradoCentavos: v })} />
            <CampoNumero rotulo="Quero que se pague em (opcional)" sufixo="meses" valor={entrada.mesesParaPagar} aoMudar={(v) => setEntrada({ mesesParaPagar: v })} />
          </div>
        </Secao>
      </Card>

      {/* Tráfego */}
      <Card>
        <TituloCard icone={Megaphone} titulo="Cobrança do tráfego pago" descricao="A verba de mídia é do cliente e fica por fora. Aqui é só como a Aden cobra pela gestão." />
        <Secao>
          <Selecao
            rotulo="Modelo de cobrança"
            valor={t.modelo}
            vazio="— não definido —"
            opcoes={MODELOS_TRAFEGO.map((m) => ({ valor: m.valor, rotulo: m.rotulo }))}
            aoMudar={(v) => setT({ modelo: v as ModeloTrafego | null })}
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {t.modelo === "fixo" && <CampoMoeda rotulo="Valor fixo por mês" valor={t.valorFixoCentavos} aoMudar={(v) => setT({ valorFixoCentavos: v })} />}
            {t.modelo === "por_campanha" && (
              <>
                <CampoMoeda rotulo="Valor por campanha" valor={t.valorPorCampanhaCentavos} aoMudar={(v) => setT({ valorPorCampanhaCentavos: v })} />
                <CampoNumero rotulo="Campanhas por mês" valor={t.campanhas} aoMudar={(v) => setT({ campanhas: v })} />
              </>
            )}
            {t.modelo === "percentual_verba" && (
              <CampoPct rotulo="Percentual sobre a verba" valor={t.percentualVerba} aoMudar={(v) => setT({ percentualVerba: v })} />
            )}
          </div>
          {t.modelo !== "sem_trafego" && (
            <div className="mt-3 rounded-bloco border border-dashed border-linha bg-marca-tinta/50 p-3">
              <CampoMoeda
                className="sm:max-w-xs"
                rotulo={t.modelo === "percentual_verba" ? "Verba mensal do cliente (base do percentual)" : "Verba mensal do cliente (opcional)"}
                valor={t.verbaMensalCentavos}
                aoMudar={(v) => setT({ verbaMensalCentavos: v })}
              />
              <p className="mt-1.5 text-[11px] leading-snug text-texto-suave">
                Paga pelo cliente direto na plataforma: não passa pela conta da Aden, não é faturamento e não entra em imposto, taxa nem receita.
                {t.modelo === "percentual_verba"
                  ? " Aqui ela serve só de base: o que a Aden fatura é o percentual."
                  : " Campo só informativo, para ver o tamanho da operação."}
              </p>
            </div>
          )}
          <p className="mt-2 text-[11px] text-texto-suave">As horas de gestão do tráfego entram como entregas (ex.: um tipo de entrega mensal de gestão).</p>
        </Secao>
      </Card>

      {/* Pontuais */}
      <Card>
        <TituloCard icone={Gem} titulo="Projetos pontuais" descricao="Branding e outros projetos únicos: diluídos em X meses na mensalidade ou cobrados por fora." />
        <Secao>
          <div className="flex flex-col gap-3">
            {cenario.pontuais.map((p) => (
              <div key={p.id} className="rounded-bloco border border-linha p-3">
                <div className="flex items-end gap-2">
                  <CampoTexto className="flex-1" rotulo="Projeto" placeholder="Ex.: branding" valor={p.nome} aoMudar={(v) => mudarPontual(p.id, { nome: v })} />
                  <Botao variante="perigo" icone={Trash2} aria-label="Remover projeto" onClick={() => set({ pontuais: cenario.pontuais.filter((x) => x.id !== p.id) })} />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem]">
                  <Segmentado
                    rotulo="Forma de cobrança"
                    valor={p.forma}
                    aoMudar={(v) => mudarPontual(p.id, { forma: v })}
                    opcoes={[
                      { valor: "diluido", rotulo: "Diluído na mensalidade" },
                      { valor: "fora", rotulo: "Fora da mensalidade" },
                    ]}
                  />
                  {p.forma === "diluido" && <CampoNumero ariaLabel="Meses" sufixo="meses" placeholder="em quantos" valor={p.meses} aoMudar={(v) => mudarPontual(p.id, { meses: v })} />}
                  {p.forma === "fora" && cenario.modo === "valor" && (
                    <CampoMoeda ariaLabel="Valor cobrado pelo projeto" placeholder="valor cobrado" valor={p.valorCobradoCentavos} aoMudar={(v) => mudarPontual(p.id, { valorCobradoCentavos: v })} />
                  )}
                </div>
                <p className="mt-3 mb-2 text-xs font-bold text-texto-suave">Entregas do projeto (total)</p>
                <EditorEntregas linhas={p.entregas} config={config} unidade="Qtd. total" aoMudar={(entregas) => mudarPontual(p.id, { entregas })} />
                <p className="mt-3 mb-2 text-xs font-bold text-texto-suave">Custos do projeto</p>
                <EditorCustos pontual linhas={p.custos} config={config} aoMudar={(custos) => mudarPontual(p.id, { custos })} />
              </div>
            ))}
            <div>
              <Botao icone={Plus} pequeno onClick={() => set({ pontuais: [...cenario.pontuais, novoPontual()] })}>
                Adicionar projeto pontual
              </Botao>
            </div>
          </div>
        </Secao>
      </Card>

      {/* Percentuais */}
      <Card>
        <TituloCard icone={Percent} titulo="Percentuais deste projeto" descricao="Vazio = usa o padrão da empresa. Preencher sobrepõe só neste cenário." />
        <Secao>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["reinvestimentoPct", "Reinvestimento", config.empresa.reinvestimentoPct],
                ["impostoPct", "Imposto", config.empresa.impostoPct],
                ["taxaRecebimentoPct", "Taxa de recebimento", config.empresa.taxaRecebimentoPct],
              ] as const
            ).map(([chave, rotulo, padrao]) => (
              <CampoPct
                key={chave}
                rotulo={
                  <span className="flex items-center gap-1">
                    {rotulo}
                  </span>
                }
                placeholder={`padrão: ${pctPadrao(padrao)}`}
                destaque={sob[chave] != null && sob[chave] !== padrao}
                valor={sob[chave]}
                aoMudar={(v) => setSob({ [chave]: v })}
              />
            ))}
          </div>
          {socios.length > 0 && (
            <>
              <p className="mt-4 mb-2 flex items-center gap-1.5 text-xs font-bold text-texto-suave">
                <UserRound size={13} /> Divisão entre os sócios
              </p>
              <div className="flex flex-wrap gap-3">
                {socios.map((p) => (
                  <CampoPct
                    key={p.id}
                    className="w-36"
                    rotulo={p.nome}
                    placeholder={`padrão: ${pctPadrao(p.percentualPadrao)}`}
                    destaque={sob.percentualPessoa[p.id] != null && sob.percentualPessoa[p.id] !== p.percentualPadrao}
                    valor={sob.percentualPessoa[p.id] ?? null}
                    aoMudar={(v) => setSob({ percentualPessoa: { ...sob.percentualPessoa, [p.id]: v } })}
                  />
                ))}
              </div>
            </>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {(sob.reinvestimentoPct != null && sob.reinvestimentoPct !== config.empresa.reinvestimentoPct) ||
            (sob.impostoPct != null && sob.impostoPct !== config.empresa.impostoPct) ||
            (sob.taxaRecebimentoPct != null && sob.taxaRecebimentoPct !== config.empresa.taxaRecebimentoPct) ||
            socios.some((p) => sob.percentualPessoa[p.id] != null && sob.percentualPessoa[p.id] !== p.percentualPadrao) ? (
              <>
                <Badge tom="aviso">este projeto usa percentual diferente do padrão</Badge>
                <button
                  type="button"
                  className={cx("inline-flex items-center gap-1 text-[11px] font-semibold text-texto-suave hover:text-texto")}
                  onClick={() => setSob({ reinvestimentoPct: null, impostoPct: null, taxaRecebimentoPct: null, percentualPessoa: {} })}
                >
                  <RotateCcw size={12} /> voltar tudo ao padrão
                </button>
              </>
            ) : null}
          </div>
        </Secao>
      </Card>

      {/* Meses sem cobrança */}
      <Card>
        <TituloCard
          icone={CalendarClock}
          titulo="Meses sem cobrança"
          descricao='Só simulação do "paga depois do resultado". Não define regra: mostra o efeito no horizonte escolhido.'
        />
        <Secao>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoNumero rotulo="Meses sem cobrança" sufixo="meses" placeholder="0" valor={cenario.mesesSemCobranca} aoMudar={(v) => set({ mesesSemCobranca: v })} />
            <CampoNumero rotulo="Horizonte da simulação" sufixo="meses" valor={cenario.horizonteMeses} aoMudar={(v) => set({ horizonteMeses: v })} />
          </div>
          <div className="mt-3">
            <Rotulo>O que fica suspenso nesses meses</Rotulo>
            <Segmentado
              rotulo="O que fica suspenso"
              valor={cenario.suspensaoSemCobranca ?? null}
              aoMudar={(v) => set({ suspensaoSemCobranca: v })}
              opcoes={[
                { valor: "tudo", rotulo: "A · não paga nada" },
                { valor: "mensalidade", rotulo: "B · paga só a gestão de tráfego" },
              ]}
            />
            <p className="mt-1.5 text-[11px] text-texto-suave">As duas opções aparecem lado a lado no resultado. A escolhida é a que vale para os alertas e a comparação.</p>
          </div>
        </Secao>
      </Card>
    </div>
  );
}
