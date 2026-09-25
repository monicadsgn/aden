"use client";

import { Calculator, FileDown, Landmark, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CabecalhoPagina } from "@/components/Shell";
import { Card, Rotulo, Selecao, TituloCard } from "@/components/ui";
import { pdfsPermitidos } from "@/lib/acesso";
import { configVazia } from "@/lib/calculo/novo";
import type { Configuracao } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";
import { competenciaAtual } from "@/lib/dados/repositorio";

function CampoMes({ valor, aoMudar }: { valor: string; aoMudar: (v: string) => void }) {
  return (
    <div>
      <Rotulo>Mês</Rotulo>
      <input
        type="month"
        value={valor}
        onChange={(e) => e.target.value && aoMudar(e.target.value)}
        className="h-10 w-full rounded-campo border border-linha bg-superficie px-3 text-sm focus:border-marca focus:outline-none"
      />
    </div>
  );
}

const botao = "inline-flex h-10 items-center gap-1.5 rounded-botao bg-marca px-4 text-sm font-semibold text-sobre-marca hover:bg-marca-forte";

export default function Pdfs() {
  const { repo, usuario } = useDados();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [mesContador, setMesContador] = useState(competenciaAtual);
  const [mesSocio, setMesSocio] = useState(competenciaAtual);
  const [pessoa, setPessoa] = useState<string | null>(null);
  const permitidos = pdfsPermitidos(usuario?.papel ?? "");

  useEffect(() => {
    repo.carregarConfig().then((c) => {
      setConfig(c);
      setPessoa(usuario?.pessoaId ?? c.pessoas.find((p) => p.socio && p.ativo)?.id ?? null);
    });
  }, [repo, usuario]);

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={FileDown}
        selo="Financeiro"
        titulo="PDFs e relatórios"
        descricao="Cada PDF mostra só o que faz sentido para quem vai receber. As cores e a fonte seguem a identidade do sistema e trocam junto com ela."
      />
      <div className="mx-auto grid max-w-[1100px] gap-4 px-4 py-6 sm:px-6 md:grid-cols-3 lg:px-8">
        {permitidos.includes("proposta") && (
          <Card>
            <TituloCard icone={Calculator} titulo="Proposta para o cliente" descricao="Entregas, quantidades e um valor. Nunca piso, horas, divisão entre sócios nem custo interno." />
            <div className="flex flex-col gap-3 px-5 pb-5 text-xs text-texto-suave">
              <p>Sai da calculadora (cartão “Para o cliente”) ou da negociação ao vivo, com a versão escolhida. Abaixo do piso de um sócio, só com a aprovação dele.</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/calculadora" className={botao}>
                  Calculadora
                </Link>
                <Link href="/negociacao" className={botao}>
                  Negociação
                </Link>
              </div>
            </div>
          </Card>
        )}
        {permitidos.includes("contador") && (
          <Card>
            <TituloCard icone={Landmark} titulo="Resumo para o contador" descricao="Recebimentos do mês por cliente, custos fixos, imposto do MEI e posição no teto." />
            <div className="flex flex-col gap-3 px-5 pb-5">
              <CampoMes valor={mesContador} aoMudar={setMesContador} />
              <div>
                <Link href={`/imprimir/contador?mes=${mesContador}`} className={botao}>
                  <FileDown size={16} /> Gerar
                </Link>
              </div>
            </div>
          </Card>
        )}
        {permitidos.includes("socio") && (
          <Card>
            <TituloCard icone={UserRound} titulo="Relatório do sócio" descricao="Interno: quanto recebeu no mês, de quais clientes, e as horas." />
            <div className="flex flex-col gap-3 px-5 pb-5">
              <Selecao rotulo="Sócio" valor={pessoa} opcoes={config.pessoas.filter((p) => p.socio && p.ativo).map((p) => ({ valor: p.id, rotulo: p.nome }))} aoMudar={setPessoa} />
              <CampoMes valor={mesSocio} aoMudar={setMesSocio} />
              <div>
                <Link href={pessoa ? `/imprimir/socio?mes=${mesSocio}&pessoa=${pessoa}` : "#"} className={botao}>
                  <FileDown size={16} /> Gerar
                </Link>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
