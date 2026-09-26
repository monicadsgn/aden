"use client";

// Conectar o Google Agenda pelo "endereço secreto no formato iCal" (só leitura).
// Cada pessoa conecta a sua; ninguém mais vê o endereço.

import { CalendarPlus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "../Modal";
import { Botao, CampoTexto } from "../ui";
import { useDados } from "@/lib/dados/contexto";

export function ConectarAgenda({ aberto, aoFechar, aoMudar }: { aberto: boolean; aoFechar: () => void; aoMudar: () => void }) {
  const { repo } = useDados();
  const [agendas, setAgendas] = useState<{ id: string; nome: string; endereco: string }[]>([]);
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => repo.listarAgendas().then(setAgendas).catch(() => {}), [repo]);
  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  const salvar = async () => {
    setErro(null);
    try {
      await repo.salvarAgenda(nome, endereco);
      setNome("");
      setEndereco("");
      await carregar();
      aoMudar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para conectar.");
    }
  };

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Google Agenda" subtitulo="Seus compromissos no calendário e na Visão do dia. Só você vê a sua agenda.">
      <div className="flex flex-col gap-4 text-sm">
        {agendas.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold text-texto-suave">Conectadas</p>
            {agendas.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-item bg-superficie-2/60 px-3 py-2">
                <CalendarPlus size={14} className="text-info" />
                <span className="flex-1 font-semibold">{a.nome}</span>
                <span className="hidden text-[11px] text-texto-suave sm:inline">…{a.endereco.slice(-18)}</span>
                <Botao
                  pequeno
                  variante="perigo"
                  icone={Trash2}
                  aria-label={`Desconectar ${a.nome}`}
                  onClick={async () => {
                    await repo.removerAgenda(a.id);
                    await carregar();
                    aoMudar();
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <ol className="flex list-decimal flex-col gap-1 rounded-bloco bg-marca-tinta px-6 py-3 text-[13px]">
          <li>
            No computador, abra o <strong>Google Agenda</strong> e clique na engrenagem → <strong>Configurações</strong>.
          </li>
          <li>Na esquerda, em &quot;Configurações das minhas agendas&quot;, clique na sua agenda.</li>
          <li>
            Desça até <strong>Integrar agenda</strong> e copie o <strong>Endereço secreto no formato iCal</strong>.
          </li>
          <li>Cole abaixo. Esse endereço dá acesso à sua agenda: não mande para ninguém.</li>
        </ol>
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <CampoTexto rotulo="Nome" placeholder="Ex.: Pessoal, Aden" valor={nome} aoMudar={setNome} />
          <CampoTexto rotulo="Endereço secreto (iCal)" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" valor={endereco} aoMudar={setEndereco} />
        </div>
        {erro && <p className="text-xs text-erro">{erro}</p>}
        <div>
          <Botao variante="primario" icone={CalendarPlus} disabled={!endereco.trim()} onClick={() => void salvar()}>
            Conectar
          </Botao>
        </div>
        <p className="text-[11px] text-texto-suave">
          Por enquanto o Aden só lê a agenda: os compromissos aparecem aqui, mas criar evento continua sendo no Google. Mudanças podem levar alguns minutos para aparecer.
        </p>
      </div>
    </Modal>
  );
}
