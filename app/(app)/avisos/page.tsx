"use client";

import { Bell, Check } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Botao, Card, Vazio, cx } from "@/components/ui";
import { configVazia } from "@/lib/calculo/novo";
import type { Configuracao } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";
import type { AvisoSocio } from "@/lib/dados/repositorio";
import { formatarMoeda } from "@/lib/formato";

export default function Avisos() {
  const { repo, usuario } = useDados();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [avisos, setAvisos] = useState<AvisoSocio[]>([]);
  const [todos, setTodos] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const local = repo.modo === "local";

  const carregar = useCallback(async () => {
    try {
      setConfig(await repo.carregarConfig());
      setAvisos(await repo.listarAvisos());
    } finally {
      setCarregado(true);
    }
  }, [repo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const meu = (a: AvisoSocio) => local || a.pessoaId === usuario?.pessoaId;
  const lista = avisos.filter((a) => todos || meu(a));
  const nome = (id: string) => config.pessoas.find((p) => p.id === id)?.nome ?? "sócio";

  if (!carregado) return null;

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={Bell}
        selo="Sócios"
        titulo="Avisos"
        descricao="Tudo o que mudou quanto um sócio recebe: quem mudou, o que era, o que ficou e quanto muda no bolso por mês."
        acoes={
          !local && (
            <Botao pequeno variante={todos ? "primario" : "secundario"} onClick={() => setTodos(!todos)}>
              {todos ? "Mostrando os dois sócios" : "Ver também os do outro sócio"}
            </Botao>
          )
        }
      />
      <div className="mx-auto flex max-w-[900px] flex-col gap-3 px-4 py-6 sm:px-6 lg:px-8">
        {!local && usuario?.pessoaId == null && (
          <p className="rounded-card bg-aviso-suave px-4 py-3 text-xs text-aviso">Seu login não está ligado a um sócio. Os avisos são por sócio: ligue em Configurações → Sócios.</p>
        )}
        {lista.length === 0 && (
          <Vazio icone={Bell} titulo="Nenhum aviso">
            Quando alguém mudar algo que mexe no quanto você recebe, aparece aqui.
          </Vazio>
        )}
        {lista.map((a) => (
          <Card key={a.id} className={cx(!a.lidoEm && meu(a) && "border-marca/60")}>
            <div className="flex flex-col gap-1.5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 text-sm font-bold">{a.titulo}</p>
                {(todos || local) && <Badge tom="marca">para {nome(a.pessoaId)}</Badge>}
                {a.impactoCentavos != null && Math.abs(a.impactoCentavos) >= 1 && (
                  <Badge tom={a.impactoCentavos >= 0 ? "ok" : "erro"}>
                    {a.impactoCentavos >= 0 ? "+" : "−"}
                    {formatarMoeda(Math.abs(a.impactoCentavos))}/mês
                  </Badge>
                )}
              </div>
              <p className="text-xs leading-relaxed">{a.texto}</p>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-texto-suave">
                <span>{new Date(a.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                {a.pedidoId && (
                  <Link href="/aprovacoes" className="font-semibold text-marca-forte underline">
                    Ver o pedido
                  </Link>
                )}
                {!a.lidoEm && meu(a) ? (
                  <Botao
                    pequeno
                    variante="fantasma"
                    icone={Check}
                    onClick={async () => {
                      await repo.marcarAvisoLido(a.id);
                      await carregar();
                    }}
                  >
                    Marcar como lido
                  </Botao>
                ) : (
                  a.lidoEm && <span>lido</span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
