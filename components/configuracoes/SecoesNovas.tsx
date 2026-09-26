"use client";

// Abas de Configurações: Terceiros, Pacotes e Metas.
// Nenhum número vem pronto: tudo começa vazio e os sócios preenchem.

import { ArrowDown, ArrowUp, Package, Plus, Star, Trash2, Trophy, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Botao, CampoMoeda, CampoNumero, CampoPct, CampoTexto, Interruptor, Selecao, Vazio, cx } from "../ui";
import { CRITERIOS, unidadeDoCriterio } from "@/lib/calculo/metas";
import { novoId } from "@/lib/calculo/novo";
import { precoDoPacote } from "@/lib/calculo/pacotes";
import type { Configuracao, ItemPacote, Meta, Pacote, Terceiro } from "@/lib/calculo/tipos";
import { formatarDuracao, formatarMoeda } from "@/lib/formato";

type Props = { rascunho: Configuracao; set: (patch: Partial<Configuracao>) => void };

function atualizar<T extends { id: string }>(lista: T[], id: string, patch: Partial<T>): T[] {
  return lista.map((x) => (x.id === id ? { ...x, ...patch } : x));
}

const areaTexto =
  "min-h-16 w-full rounded-campo border border-linha bg-superficie px-3 py-2 text-sm placeholder:text-texto-suave/70 focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20";

// ─── Terceiros ────────────────────────────────────────────────────────────────

export function SecaoTerceiros({ rascunho, set }: Props) {
  const lista = rascunho.terceiros ?? [];
  const setLista = (terceiros: Terceiro[]) => set({ terceiros });
  const usadoPor = (id: string) => rascunho.tiposEntrega.filter((t) => t.terceiroId === id).map((t) => t.nome);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-texto-suave">
        Serviço terceirizado cobrado <strong>por saída</strong> (ex.: audiovisual: a pessoa vai ao cliente, grava, edita e entrega). O custo de cada cliente é
        saídas por mês × (valor por saída + deslocamento). É custo só do cliente que recebe a gravação, nunca dividido entre todos. Mudou o valor aqui, todos os pacotes
        e escopos recalculam. Ligue o terceiro a um tipo de entrega em <strong>Tipos de entrega</strong>.
      </p>
      {lista.length === 0 && (
        <Vazio icone={Truck} titulo="Nenhum terceiro cadastrado">
          Ex.: Audiovisual (gravação e edição).
        </Vazio>
      )}
      {lista.map((t) => {
        const tipos = usadoPor(t.id);
        return (
          <div key={t.id} className="flex flex-col gap-3 rounded-bloco bg-superficie-2/60 p-3">
            <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[1.2fr_1.4fr_1fr_1fr_auto]">
              <CampoTexto className="col-span-2 sm:col-span-1" rotulo="Serviço" placeholder="Ex.: Audiovisual" valor={t.nome} aoMudar={(v) => setLista(atualizar(lista, t.id, { nome: v }))} />
              <CampoTexto className="col-span-2 sm:col-span-1" rotulo="O que inclui" placeholder="Ex.: gravação e edição" valor={t.inclui} aoMudar={(v) => setLista(atualizar(lista, t.id, { inclui: v }))} />
              <CampoMoeda rotulo="Valor por saída" valor={t.valorPorSaidaCentavos} aoMudar={(v) => setLista(atualizar(lista, t.id, { valorPorSaidaCentavos: v }))} />
              <CampoMoeda rotulo="Deslocamento médio" valor={t.deslocamentoMedioCentavos} aoMudar={(v) => setLista(atualizar(lista, t.id, { deslocamentoMedioCentavos: v }))} />
              <Botao className="mt-5" variante="perigo" icone={Trash2} aria-label={`Remover ${t.nome}`} onClick={() => setLista(lista.filter((x) => x.id !== t.id))} />
            </div>
            <CampoTexto
              rotulo="O que o cliente lê na proposta (nunca o valor)"
              placeholder="Ex.: gravação e edição mensal inclusa"
              valor={t.fraseCliente}
              aoMudar={(v) => setLista(atualizar(lista, t.id, { fraseCliente: v }))}
            />
            <p className="text-[11px] text-texto-suave">
              {tipos.length ? `Usado em: ${tipos.join(", ")}.` : "Ainda não está ligado a nenhum tipo de entrega."}
              {t.valorPorSaidaCentavos != null && ` Cada saída custa ${formatarMoeda(t.valorPorSaidaCentavos + (t.deslocamentoMedioCentavos ?? 0))} com o deslocamento médio.`}
            </p>
          </div>
        );
      })}
      <div>
        <Botao
          icone={Plus}
          pequeno
          onClick={() =>
            setLista([...lista, { id: novoId(), nome: "", inclui: "", fraseCliente: "", valorPorSaidaCentavos: null, deslocamentoMedioCentavos: null, ativo: true }])
          }
        >
          Adicionar terceiro
        </Botao>
      </div>
    </div>
  );
}

// ─── Pacotes ──────────────────────────────────────────────────────────────────

function ItensDoPacote({
  titulo,
  itens,
  config,
  aoMudar,
  explica,
}: {
  titulo: string;
  itens: ItemPacote[];
  config: Configuracao;
  aoMudar: (i: ItemPacote[]) => void;
  explica: ReactNode;
}) {
  const tipos = config.tiposEntrega.filter((t) => t.ativo);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold">{titulo}</p>
      <p className="-mt-1 text-[11px] text-texto-suave">{explica}</p>
      {itens.map((i, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
          <Selecao
            ariaLabel="Entrega"
            valor={i.tipoEntregaId}
            opcoes={tipos.map((t) => ({ valor: t.id, rotulo: t.nome, grupo: config.servicos.find((s) => s.id === t.servicoId)?.nome }))}
            aoMudar={(v) => v && aoMudar(itens.map((x, j) => (j === idx ? { ...x, tipoEntregaId: v } : x)))}
          />
          <CampoNumero ariaLabel="Quantidade" placeholder="a confirmar" valor={i.quantidade} aoMudar={(v) => aoMudar(itens.map((x, j) => (j === idx ? { ...x, quantidade: v } : x)))} />
          <Botao variante="perigo" icone={Trash2} aria-label="Tirar do pacote" onClick={() => aoMudar(itens.filter((_, j) => j !== idx))} />
        </div>
      ))}
      <div>
        <Botao icone={Plus} pequeno disabled={!tipos.length} onClick={() => aoMudar([...itens, { tipoEntregaId: tipos[0].id, quantidade: null }])}>
          Adicionar entrega
        </Botao>
      </div>
    </div>
  );
}

function PrecoCalculado({ config, pacote }: { config: Configuracao; pacote: Pacote }) {
  const p = precoDoPacote(config, pacote);
  const horas = p.resultado.mes?.horasTotais;
  const horasEntrada = p.resultado.entrada?.horasTotais;
  return (
    <div className="grid gap-2 rounded-bloco bg-marca-tinta p-3 sm:grid-cols-2">
      <div>
        <p className="text-[11px] font-semibold text-texto-suave">Manutenção mensal (calculada)</p>
        <p className="numero text-xl font-extrabold">{p.mensalCentavos != null ? formatarMoeda(p.mensalCentavos) : "—"}</p>
        <p className="text-[11px] text-texto-suave">{horas != null ? `${formatarDuracao(horas)} de trabalho por mês` : (p.motivo ?? "")}</p>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-texto-suave">Primeiro mês · entrada (calculada)</p>
        <p className="numero text-xl font-extrabold">{p.entradaAConfirmar ? "a confirmar" : p.entradaCentavos != null ? formatarMoeda(p.entradaCentavos) : "—"}</p>
        <p className="text-[11px] text-texto-suave">
          {p.entradaAConfirmar ? "Faltam as quantidades do primeiro mês." : horasEntrada != null ? `${formatarDuracao(horasEntrada)} de trabalho, uma vez só` : "Sem entrada."}
        </p>
      </div>
      <p className="text-[10px] text-texto-suave sm:col-span-2">
        Ninguém digita preço: sai do tempo de cada entrega, do piso de cada sócio, dos custos (terceiros inclusos) e do rateio. Mudou a configuração, o preço muda junto.
      </p>
    </div>
  );
}

export function SecaoPacotes({ rascunho, set }: Props) {
  const lista = rascunho.pacotes ?? [];
  const setLista = (pacotes: Pacote[]) => set({ pacotes });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-texto-suave">
        Pacotes fechados para a negociação. O cliente vê só o nome, as frases do que está incluso e o valor; nunca quantidades nem horas. As quantidades ficam aqui, para
        o sistema calcular.
      </p>
      {lista.length === 0 && (
        <Vazio icone={Package} titulo="Nenhum pacote cadastrado">
          Ex.: Social media padrão.
        </Vazio>
      )}
      {lista.map((p) => (
        <div key={p.id} className={cx("flex flex-col gap-4 rounded-bloco border p-4", p.padrao ? "border-marca bg-marca-tinta/40" : "border-linha bg-superficie-2/40")}>
          <div className="grid items-start gap-3 sm:grid-cols-[1fr_auto]">
            <CampoTexto rotulo="Nome do pacote" placeholder="Ex.: Social media padrão" valor={p.nome} aoMudar={(v) => setLista(atualizar(lista, p.id, { nome: v }))} />
            <Botao className="mt-5" variante="perigo" icone={Trash2} aria-label={`Remover ${p.nome}`} onClick={() => setLista(lista.filter((x) => x.id !== p.id))} />
          </div>
          <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave">
            Descrição para o cliente
            <textarea
              className={areaTexto}
              placeholder="Em linguagem de cliente: o que esse pacote resolve."
              value={p.descricao}
              onChange={(e) => setLista(atualizar(lista, p.id, { descricao: e.target.value }))}
            />
          </label>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold">O que está incluso (o cliente lê isto)</p>
            {p.itensCliente.map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2">
                <CampoTexto
                  ariaLabel={`Frase ${i + 1}`}
                  placeholder="Ex.: posts em dias alternados, intercalando fotos e vídeos"
                  valor={f}
                  aoMudar={(v) => setLista(atualizar(lista, p.id, { itensCliente: p.itensCliente.map((x, j) => (j === i ? v : x)) }))}
                />
                <Botao variante="perigo" icone={Trash2} aria-label="Tirar frase" onClick={() => setLista(atualizar(lista, p.id, { itensCliente: p.itensCliente.filter((_, j) => j !== i) }))} />
              </div>
            ))}
            <div>
              <Botao icone={Plus} pequeno onClick={() => setLista(atualizar(lista, p.id, { itensCliente: [...p.itensCliente, ""] }))}>
                Adicionar frase
              </Botao>
            </div>
            <p className="text-[11px] text-texto-suave">A frase de cada terceiro usado (ex.: gravação e edição) entra sozinha.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ItensDoPacote
              titulo="Manutenção mensal"
              explica="O que acontece todo mês."
              itens={p.rotina}
              config={rascunho}
              aoMudar={(rotina) => setLista(atualizar(lista, p.id, { rotina }))}
            />
            <ItensDoPacote
              titulo="Primeiro mês (entrada)"
              explica="Uma vez só: onboarding, enxoval do perfil, estrutura visual. Vazio = a confirmar."
              itens={p.entrada}
              config={rascunho}
              aoMudar={(entrada) => setLista(atualizar(lista, p.id, { entrada }))}
            />
          </div>
          <PrecoCalculado config={rascunho} pacote={p} />
          <div className="flex flex-wrap gap-4">
            <Interruptor
              ligado={p.padrao}
              rotulo="Pacote padrão (a tela Mês conta quantos deste ainda cabem)"
              aoMudar={(v) => setLista(lista.map((x) => (x.id === p.id ? { ...x, padrao: v } : v ? { ...x, padrao: false } : x)))}
            />
            <Interruptor ligado={p.ativo} rotulo="Aparece na negociação" aoMudar={(v) => setLista(atualizar(lista, p.id, { ativo: v }))} />
          </div>
        </div>
      ))}
      <div>
        <Botao
          icone={Plus}
          pequeno
          onClick={() =>
            setLista([...lista, { id: novoId(), nome: "", descricao: "", itensCliente: [], rotina: [], entrada: [], padrao: lista.length === 0, ativo: true }])
          }
        >
          Adicionar pacote
        </Botao>
      </div>
    </div>
  );
}

// ─── Metas ────────────────────────────────────────────────────────────────────

function CampoAlvo({ meta, aoMudar }: { meta: Meta; aoMudar: (v: number | null) => void }) {
  if (!meta.criterio) return <CampoNumero rotulo="Valor alvo" placeholder="escolha o critério" valor={null} aoMudar={() => {}} />;
  const u = unidadeDoCriterio(meta.criterio);
  if (u === "moeda") return <CampoMoeda rotulo="Valor alvo" valor={meta.alvo} aoMudar={aoMudar} />;
  if (u === "pct") return <CampoPct rotulo="Valor alvo" valor={meta.alvo} aoMudar={aoMudar} />;
  return <CampoNumero rotulo="Valor alvo" sufixo="clientes" valor={meta.alvo} aoMudar={aoMudar} />;
}

export function SecaoMetas({ rascunho, set }: Props) {
  const lista = rascunho.metas ?? [];
  const setLista = (metas: Meta[]) => set({ metas });
  const mover = (i: number, d: number) => {
    const l = [...lista];
    const [x] = l.splice(i, 1);
    l.splice(i + d, 0, x);
    setLista(l);
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-texto-suave">
        A trilha de crescimento da Aden, em degraus, na ordem em que vocês querem chegar. Cada degrau tem um critério, um alvo e o que fazer quando chegar lá. Aparece
        no topo da tela Mês. Degrau batido fica marcado como conquistado, com a data.
      </p>
      {lista.length === 0 && (
        <Vazio icone={Trophy} titulo="Nenhuma meta ainda">
          Os sócios definem juntos. Ex.: &quot;Faturamento mensal de R$ X → primeira terceirização&quot;.
        </Vazio>
      )}
      {lista.map((m, i) => (
        <div key={m.id} className="flex flex-col gap-3 rounded-bloco bg-superficie-2/60 p-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-marca text-xs font-bold text-sobre-marca">{i + 1}</span>
            <CampoTexto className="flex-1" ariaLabel="Nome do degrau" placeholder="Nome do degrau" valor={m.nome} aoMudar={(v) => setLista(atualizar(lista, m.id, { nome: v }))} />
            {m.conquistadaEm && (
              <Badge tom="ok" icone={Star}>
                conquistada em {new Date(m.conquistadaEm).toLocaleDateString("pt-BR")}
              </Badge>
            )}
            <Botao variante="fantasma" icone={ArrowUp} aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)} />
            <Botao variante="fantasma" icone={ArrowDown} aria-label="Descer" disabled={i === lista.length - 1} onClick={() => mover(i, 1)} />
            <Botao variante="perigo" icone={Trash2} aria-label={`Remover ${m.nome}`} onClick={() => setLista(lista.filter((x) => x.id !== m.id))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Selecao
              rotulo="Critério"
              valor={m.criterio}
              vazio="Escolha"
              opcoes={CRITERIOS.map((c) => ({ valor: c.valor, rotulo: c.rotulo }))}
              aoMudar={(v) => setLista(atualizar(lista, m.id, { criterio: v as Meta["criterio"], alvo: null }))}
            />
            <CampoAlvo meta={m} aoMudar={(v) => setLista(atualizar(lista, m.id, { alvo: v }))} />
          </div>
          <CampoTexto
            rotulo="Ação ligada a este degrau"
            placeholder="Ex.: primeira terceirização, contratar alguém pra equipe"
            valor={m.acao}
            aoMudar={(v) => setLista(atualizar(lista, m.id, { acao: v }))}
          />
        </div>
      ))}
      <div>
        <Botao icone={Plus} pequeno onClick={() => setLista([...lista, { id: novoId(), nome: "", criterio: null, alvo: null, acao: "", conquistadaEm: null }])}>
          Adicionar degrau
        </Botao>
      </div>
    </div>
  );
}
