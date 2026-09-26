"use client";

// Conteúdo das janelas que abrem ao clicar no título de cada bloco da calculadora:
// o que é, o que já está cadastrado (com os números da configuração), um exemplo e atalhos.

import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { termo } from "@/lib/ajuda";
import type { Configuracao, ResultadoMes, SecaoConfig } from "@/lib/calculo/tipos";
import { formatarDuracao, formatarMoeda, formatarPct } from "@/lib/formato";
import { linkConfig } from "@/lib/navegacao";

type Atalho = { rotulo: string; secao: SecaoConfig; campo?: string };

export function Detalhe({
  oQueE,
  exemplo,
  children,
  atalhos = [],
  termos = [],
}: {
  oQueE: ReactNode;
  exemplo?: ReactNode;
  children?: ReactNode;
  atalhos?: Atalho[];
  termos?: string[];
}) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="leading-relaxed">{oQueE}</p>
      {children && (
        <div>
          <p className="mb-1.5 text-[11px] font-bold tracking-wide text-texto-suave uppercase">O que já está cadastrado</p>
          {children}
        </div>
      )}
      {exemplo && (
        <div className="rounded-bloco bg-marca-tinta px-3 py-2.5 text-[13px] leading-relaxed">
          <span className="font-bold">Exemplo: </span>
          {exemplo}
        </div>
      )}
      {(atalhos.length > 0 || termos.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-linha pt-3">
          {atalhos.map((a) => (
            <Link
              key={a.rotulo}
              href={linkConfig(a.secao, a.campo)}
              className="inline-flex items-center gap-1 rounded-botao bg-marca px-3 py-1.5 text-xs font-semibold text-sobre-marca hover:bg-marca-forte"
            >
              {a.rotulo} <ArrowRight size={12} />
            </Link>
          ))}
          {termos.map((id) => {
            const t = termo(id);
            return t ? (
              <Link
                key={id}
                href={`/glossario#${id}`}
                className="inline-flex items-center gap-1 rounded-botao bg-superficie-2 px-2.5 py-1 text-[11px] font-semibold text-texto-suave hover:text-texto"
              >
                <BookOpen size={11} /> {t.termo}
              </Link>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

function Tabela({ linhas, vazio }: { linhas: [ReactNode, ReactNode][]; vazio: string }) {
  if (!linhas.length) return <p className="rounded-bloco bg-superficie-2/60 px-3 py-2 text-xs text-texto-suave">{vazio}</p>;
  return (
    <div className="divide-y divide-linha rounded-bloco border border-linha">
      {linhas.map(([a, b], i) => (
        <div key={i} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-[13px]">
          <span className="min-w-0">{a}</span>
          <span className="numero shrink-0 font-semibold">{b}</span>
        </div>
      ))}
    </div>
  );
}

const pct = (v: number | null | undefined) => (v == null ? "vazio" : formatarPct(v));
const moeda = (v: number | null | undefined) => (v == null ? "vazio" : formatarMoeda(v));

export function DetalhesComoCalcular() {
  return (
    <Detalhe
      oQueE={
        <>
          Há dois jeitos de usar a calculadora. <strong>Escopo → valor mínimo:</strong> você diz o que vai entregar e o sistema calcula o menor
          valor que paga os custos e deixa cada sócio no piso. <strong>Valor → o que cabe:</strong> você diz quanto o cliente quer pagar e o sistema
          mostra se vale a pena e quantas entregas cabem.
        </>
      }
      exemplo="O cliente pediu 12 posts e 4 carrosséis: use o primeiro modo para saber quanto cobrar. O cliente disse que só pode pagar R$ 1.500: use o segundo para ver o que dá para entregar."
      termos={["escopo", "piso"]}
    />
  );
}

export function DetalhesRotina({ config }: { config: Configuracao }) {
  const tipos = config.tiposEntrega.filter((t) => t.ativo);
  const servico = (id: string | null) => config.servicos.find((s) => s.id === id)?.nome ?? "sem serviço";
  return (
    <Detalhe
      oQueE="A rotina é o que se repete todo mês. Cada entrega tem um tempo cadastrado; quantidade × tempo dá as horas do mês, e é com elas que o sistema calcula quanto vale cada hora."
      exemplo="12 posts de 20 min + 4 carrosséis de 40 min = 4 h + 2 h 40 min = 6 h 40 min de trabalho por mês."
      atalhos={[{ rotulo: "Editar os tipos de entrega", secao: "tipos" }]}
      termos={["tempo-por-entrega", "escopo", "calibragem"]}
    >
      <Tabela
        vazio="Nenhum tipo de entrega cadastrado ainda."
        linhas={tipos.map((t) => [
          <>
            {t.nome} <span className="text-[11px] text-texto-suave">· {servico(t.servicoId)}</span>
          </>,
          t.audiovisual ? "terceiro (só custo)" : t.horasPorUnidade != null ? formatarDuracao(t.horasPorUnidade) : "sem tempo",
        ])}
      />
    </Detalhe>
  );
}

export function DetalhesQuemExecuta({ config }: { config: Configuracao }) {
  const socios = config.pessoas.filter((p) => p.ativo && p.socio);
  return (
    <Detalhe
      oQueE="Diz quem faz cada serviço e em que proporção. As horas de cada entrega vão para as pessoas nessa divisão. Aqui você pode mudar só para este cliente; o padrão fica em Configurações."
      exemplo="Social Media com 100% Moni: as 6 h de posts são todas dela. Tráfego com 100% Áleff: as horas de gestão são dele."
      atalhos={[{ rotulo: "Editar a divisão padrão", secao: "servicos" }]}
    >
      <Tabela
        vazio="Nenhum serviço cadastrado ainda."
        linhas={config.servicos
          .filter((s) => s.ativo)
          .map((s) => [s.nome, socios.map((p) => `${p.nome} ${pct(s.divisaoPadrao[p.id])}`).join(" · ") || "—"])}
      />
    </Detalhe>
  );
}

export function DetalhesCustos({ config, m }: { config: Configuracao; m: ResultadoMes | null }) {
  const fixos = config.custosFixos.filter((c) => c.ativo);
  const totalFixo = fixos.reduce((a, c) => a + (c.valorMensalCentavos ?? 0), 0) + (config.empresa.impostoFixoMensalCentavos ?? 0);
  return (
    <Detalhe
      oQueE={
        <>
          Aqui entram os custos <strong>só deste cliente</strong> (ex.: edição de vídeo por terceiro, banco de imagens para ele). Os custos fixos
          da empresa, como as ferramentas, <strong>não</strong> precisam ser lançados aqui: eles já entram sozinhos pelo rateio, divididos entre
          todos os clientes.
        </>
      }
      exemplo="Editor de vídeo cobra R$ 80 por reels e são 4 por mês: lance R$ 80 por entrega de vídeo. O sistema soma R$ 320 no mês."
      atalhos={[
        { rotulo: "Ver custos fixos", secao: "custos" },
        { rotulo: "Regra de rateio", secao: "regras", campo: "regraRateio" },
      ]}
      termos={["rateio"]}
    >
      <Tabela
        vazio="Nenhum custo fixo cadastrado."
        linhas={[
          ...fixos.map((c): [ReactNode, ReactNode] => [c.nome, moeda(c.valorMensalCentavos)]),
          ...(config.empresa.impostoFixoMensalCentavos ? [["Imposto fixo (DAS)", formatarMoeda(config.empresa.impostoFixoMensalCentavos)] as [ReactNode, ReactNode]] : []),
          [<strong key="t">Total fixo por mês</strong>, formatarMoeda(totalFixo)],
          ...(m ? [["Parte deste cliente (rateio)", formatarMoeda(m.rateio.quotaCentavos)] as [ReactNode, ReactNode]] : []),
        ]}
      />
      {m?.rateio.explicacao && <p className="mt-1.5 text-[11px] text-texto-suave">{m.rateio.explicacao}</p>}
    </Detalhe>
  );
}

export function DetalhesEntrada() {
  return (
    <Detalhe
      oQueE="É o trabalho que acontece uma vez só, no começo do contrato: arrumar o perfil, identidade visual, primeiros posts. Fica separado para não deixar a mensalidade mais cara para sempre. Você escolhe se cobra à parte ou em quantos meses quer que se pague."
      exemplo="Entrada com 10 h de trabalho e R$ 200 de custos, cobrada por R$ 900 à parte, ou diluída para se pagar em 3 meses."
      termos={["entrada"]}
    />
  );
}

export function DetalhesTrafego() {
  return (
    <Detalhe
      oQueE="A verba de anúncios é do cliente: ele paga direto para a plataforma e ela não entra no faturamento da Aden. Aqui é só como a Aden cobra pelo trabalho de gerenciar os anúncios."
      exemplo="Verba de R$ 3.000 no Meta (do cliente) + gestão cobrada pela Aden: um valor fixo por mês, ou um % da verba, conforme o modelo escolhido."
    />
  );
}

export function DetalhesPontuais() {
  return (
    <Detalhe
      oQueE="Projetos que acontecem uma vez, como um branding completo. Podem ser diluídos em alguns meses dentro da mensalidade, ou cobrados por fora (aí não levam parte dos custos fixos)."
      exemplo="Branding de R$ 3.000 diluído em 6 meses soma R$ 500 à mensalidade nesse período."
    />
  );
}

export function DetalhesPercentuais({ config }: { config: Configuracao }) {
  const e = config.empresa;
  return (
    <Detalhe
      oQueE="Os percentuais da empresa valem para todos os clientes. Aqui dá para trocar só neste cenário, sem mexer no padrão (ex.: uma negociação especial). Deixe vazio para usar o padrão."
      exemplo="Reinvestimento padrão de 10%, mas neste cliente estratégico vocês topam 0%: preencha 0 aqui."
      atalhos={[{ rotulo: "Editar o padrão da empresa", secao: "regras" }]}
      termos={["reinvestimento"]}
    >
      <Tabela
        vazio=""
        linhas={[
          ["Regime", e.regime === "mei" ? "MEI" : (e.regime ?? "vazio")],
          ["Reinvestimento", pct(e.reinvestimentoPct)],
          ...(e.regime === "mei"
            ? [["Imposto fixo por mês", moeda(e.impostoFixoMensalCentavos)] as [ReactNode, ReactNode]]
            : [["Imposto sobre faturamento", pct(e.impostoPct)] as [ReactNode, ReactNode]]),
          ["Taxa de recebimento", pct(e.taxaRecebimentoPct)],
        ]}
      />
    </Detalhe>
  );
}

export function DetalhesSemCobranca() {
  return (
    <Detalhe
      oQueE="Serve para simular meses em que o cliente não paga (ex.: férias, pausa combinada). O sistema mostra a média do período, para você ver se o cliente continua valendo a pena."
      exemplo="Horizonte de 12 meses com 1 mês sem cobrança: a hora de cada sócio é a média dos 12 meses, contando o mês sem receita."
    />
  );
}

export function DetalhesSocios({ config }: { config: Configuracao }) {
  const socios = config.pessoas.filter((p) => p.ativo && p.socio);
  return (
    <Detalhe
      oQueE="Quanto cada sócio recebe por mês deste cliente e quanto isso dá por hora trabalhada. Verde quando a hora fica acima do piso; vermelho quando fica abaixo."
      exemplo="A Moni recebe R$ 900 e trabalha 15 h neste cliente: dá R$ 60/h. Com piso de R$ 50/h, está acima."
      atalhos={[{ rotulo: "Editar os sócios", secao: "socios" }]}
      termos={["piso", "valor-por-hora", "capacidade"]}
    >
      <Tabela
        vazio="Nenhum sócio cadastrado."
        linhas={socios.map((p) => [
          p.nome,
          `${pct(p.percentualPadrao)} da sobra · piso ${p.pisoHoraCentavos != null ? `${formatarMoeda(p.pisoHoraCentavos)}/h` : "vazio"} · ${p.capacidadeHorasMes != null ? `${p.capacidadeHorasMes} h/mês` : "capacidade vazia"}`,
        ])}
      />
    </Detalhe>
  );
}

export function DetalhesIndicadores() {
  return (
    <Detalhe
      oQueE="Os números do projeto divididos pelas horas de trabalho. Ajudam a comparar clientes de tamanhos diferentes."
      exemplo="Cliente de R$ 2.000 com 20 h: cobra R$ 100 por hora. Se os custos são R$ 400, o custo por hora é R$ 20."
      termos={["valor-por-hora"]}
    />
  );
}

export function DetalhesEncaixe() {
  return (
    <Detalhe
      oQueE="Mostra quantas entregas cabem no valor. Cada entrega a mais toma horas; o limite é o piso (o valor não paga mais horas) ou a capacidade (a pessoa não tem mais horas no mês). Use os botões + e − para testar."
      exemplo={"\"+3 cabem\" em posts quer dizer que dá para colocar mais 3 posts sem ninguém ficar abaixo do piso nem passar da capacidade."}
      termos={["piso", "capacidade"]}
    />
  );
}

export function DetalhesCascata() {
  return (
    <Detalhe
      oQueE="O caminho do dinheiro, de cima para baixo: o que o cliente paga, menos imposto, taxas e custos, dá a sobra. Da sobra sai o reinvestimento, e o resto é dividido entre os sócios."
      exemplo="R$ 2.000 − R$ 90 (imposto) − R$ 60 (taxa) − R$ 400 (custos) = R$ 1.450 de sobra. Com 10% de reinvestimento, R$ 1.305 são divididos."
      termos={["sobra", "reinvestimento", "rateio"]}
    />
  );
}

export function DetalhesDestaque({ modo }: { modo: "escopo" | "valor" }) {
  return modo === "escopo" ? (
    <Detalhe
      oQueE="É o menor valor mensal que paga todos os custos e ainda deixa cada sócio com horas no cliente ganhando pelo menos o piso. Abaixo disso, alguém trabalha no prejuízo."
      exemplo="Se o mínimo é R$ 1.800 e você propõe R$ 2.000, sobram R$ 200 de folga para negociar."
      termos={["piso", "sobra", "escopo"]}
    />
  ) : (
    <Detalhe
      oQueE="É o que sobra por mês deste cliente depois de tirar custos, imposto e taxas. Embaixo aparece o valor mínimo para o mesmo escopo, e quanto você está acima ou abaixo dele."
      exemplo="Cliente paga R$ 2.000 e a sobra é R$ 1.400. Se o mínimo para esse escopo é R$ 1.800, você está R$ 200 acima."
      termos={["sobra", "piso"]}
    />
  );
}

export function DetalhesProposta() {
  return (
    <Detalhe
      oQueE="É o valor que vai para o cliente: um número só, com tudo embutido (ferramentas, estrutura, imposto). O cliente nunca vê custos nem a divisão entre sócios. Daqui você copia o texto, gera o PDF ou guarda como escopo contratado."
      exemplo={"\"Gestão de social media: R$ 2.000 por mês.\" A verba de anúncios, se houver, aparece separada, porque é paga direto à plataforma."}
      termos={["escopo"]}
    />
  );
}
