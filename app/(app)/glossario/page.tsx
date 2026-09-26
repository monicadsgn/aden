"use client";

import { BookOpen, Search } from "lucide-react";
import { useState } from "react";
import { CabecalhoPagina } from "@/components/Shell";
import { Card } from "@/components/ui";
import { GLOSSARIO } from "@/lib/ajuda";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Glossario() {
  const [busca, setBusca] = useState("");
  const q = semAcento(busca.trim());
  const termos = GLOSSARIO.filter((t) => !q || semAcento(`${t.termo} ${t.frase}`).includes(q));
  return (
    <div className="pb-16">
      <CabecalhoPagina icone={BookOpen} selo="Ajuda" titulo="Glossário" descricao="As palavras que o sistema usa, cada uma com uma frase e um exemplo." />
      <div className="mx-auto flex max-w-[900px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <label className="relative">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-texto-suave" aria-hidden />
          <input
            className="h-11 w-full rounded-botao border border-linha bg-superficie pr-4 pl-10 text-sm placeholder:text-texto-suave focus:border-marca focus:outline-none"
            placeholder="Procurar uma palavra…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Procurar no glossário"
          />
        </label>
        {termos.length === 0 && <p className="text-sm text-texto-suave">Nenhuma palavra encontrada.</p>}
        {termos.map((t) => (
          <Card key={t.id} id={t.id} className="scroll-mt-6 target:ring-2 target:ring-marca">
            <div className="flex flex-col gap-2 p-5">
              <h2 className="text-base font-bold">{t.termo}</h2>
              <p className="text-sm leading-relaxed">{t.frase}</p>
              <p className="rounded-bloco bg-marca-tinta px-3 py-2 text-[13px] leading-relaxed">
                <strong>Exemplo:</strong> {t.exemplo}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
