-- Aden · planejamento mensal, datas comemorativas e atalhos do painel (pedido da Moni, 30/09/2026).
-- Só acréscimo, com cópia de segurança antes (backup_20260930b.*_antes_0027).
--
-- A) Planejamento mensal: cada tarefa pode ter a rede (Instagram…) e o lote que agrupa o calendário
--    ("Calendário Outubro — Olinda"). Os dois são internos: não saem pelo painel do cliente.
-- B) Datas comemorativas: a data (do ano certo) e, para cada cliente, os dias de antecedência da campanha e uma nota
--    de ideia. A conta de "o que entra no planejamento do mês" fica em lib/calculo/datas.ts (pura e testada).
-- C) Atalhos do painel do cliente: PDF do planejamento do mês (com rótulo), pasta de fotos, pasta da identidade visual
--    e o texto "O que está incluso". Links só https. Saem pelo painel_cliente.

-- ─── A. Planejamento ─────────────────────────────────────────────────────────
alter table tarefas add column if not exists rede text;
alter table tarefas add column if not exists lote text;
create index if not exists tarefas_lote on tarefas (org_id, lote) where lote is not null;

-- ─── B. Datas comemorativas ──────────────────────────────────────────────────
create table if not exists datas_comemorativas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null check (length(btrim(nome)) > 0),
  data date not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index if not exists datas_comemorativas_data on datas_comemorativas (org_id, data);

create table if not exists datas_do_cliente (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  data_id uuid not null references datas_comemorativas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  -- quantos dias antes da data a campanha começa (vazio = só o post do dia)
  dias_antecedencia integer check (dias_antecedencia is null or dias_antecedencia >= 0),
  nota text,
  escondida boolean not null default false,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  unique (data_id, cliente_id)
);

alter table datas_comemorativas enable row level security;
alter table datas_do_cliente enable row level security;

drop policy if exists datas_leitura on datas_comemorativas;
create policy datas_leitura on datas_comemorativas for select using (eh_membro(org_id));
drop policy if exists datas_escrita on datas_comemorativas;
create policy datas_escrita on datas_comemorativas for all using (eh_admin(org_id)) with check (eh_admin(org_id));

drop policy if exists datas_cliente_leitura on datas_do_cliente;
create policy datas_cliente_leitura on datas_do_cliente for select using (eh_membro(org_id));
drop policy if exists datas_cliente_escrita on datas_do_cliente;
create policy datas_cliente_escrita on datas_do_cliente for all using (eh_admin(org_id)) with check (eh_admin(org_id));

drop trigger if exists datas_comemorativas_carimbo on datas_comemorativas;
create trigger datas_comemorativas_carimbo before update on datas_comemorativas for each row execute function carimbar();
drop trigger if exists datas_comemorativas_auditoria on datas_comemorativas;
create trigger datas_comemorativas_auditoria after insert or update or delete on datas_comemorativas for each row execute function auditar();
drop trigger if exists datas_do_cliente_carimbo on datas_do_cliente;
create trigger datas_do_cliente_carimbo before update on datas_do_cliente for each row execute function carimbar();
drop trigger if exists datas_do_cliente_auditoria on datas_do_cliente;
create trigger datas_do_cliente_auditoria after insert or update or delete on datas_do_cliente for each row execute function auditar();

-- ─── C. Atalhos do painel ────────────────────────────────────────────────────
alter table clientes add column if not exists painel_planejamento_url text;
alter table clientes add column if not exists painel_planejamento_rotulo text;
alter table clientes add column if not exists painel_fotos_url text;
alter table clientes add column if not exists painel_identidade_url text;
alter table clientes add column if not exists painel_incluso text;
do $$ begin
  alter table clientes add constraint clientes_painel_links_https check (
    (painel_planejamento_url is null or painel_planejamento_url ~ '^https://')
    and (painel_fotos_url is null or painel_fotos_url ~ '^https://')
    and (painel_identidade_url is null or painel_identidade_url ~ '^https://')
  );
exception when duplicate_object then null; end $$;

create or replace function public.painel_cliente(p_token text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_cli clientes;
  v_k contratos;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  select * into v_cli from clientes where painel_token = p_token and ativo;
  if not found then return null; end if;
  select * into v_k from contratos where cliente_id = v_cli.id and status = 'ativo' limit 1;
  return jsonb_build_object(
    'cliente', v_cli.nome,
    'limiteRodadas', v_k.limite_rodadas,
    'prazoAprovacaoDias', v_k.prazo_aprovacao_dias,
    'atalhos', jsonb_build_object(
      'planejamentoUrl', v_cli.painel_planejamento_url,
      'planejamentoRotulo', v_cli.painel_planejamento_rotulo,
      'fotosUrl', v_cli.painel_fotos_url,
      'identidadeUrl', v_cli.painel_identidade_url,
      'inclusoTexto', v_cli.painel_incluso
    ),
    'pecas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'titulo', titulo_para_cliente(t.titulo),
        'legenda', t.legenda,
        'arquivos', t.arquivos,
        'status', t.status,
        'vencimento', t.vencimento,
        'enviadaEm', t.enviada_cliente_em,
        'rodadas', t.rodadas,
        'feedback', t.feedback_cliente,
        'feedbackEm', t.feedback_em,
        'aprovadaEm', t.cliente_aprovou_em,
        'respostas', t.respostas_cliente,
        'publicarEm', t.publicar_em,
        'publicadaEm', t.publicada_em,
        'textoArte', t.texto_arte,
        'agendadaEm', t.agendada_em,
        'tipo', (select coalesce(nullif(btrim(te.nome_cliente), ''), te.nome) from tipos_entrega te where te.id = t.tipo_entrega_id)
      ) order by coalesce(t.enviada_cliente_em, t.criado_em) desc)
      from tarefas t
      where t.cliente_id = v_cli.id and t.visivel_cliente
        and (t.status <> 'concluida' or t.concluida_em > now() - interval '60 days' or t.cliente_aprovou_em > now() - interval '60 days')
    ), '[]'::jsonb)
  );
end;
$function$;

-- a porta também passa a devolver rede e lote (só leitura; nada do que já existia muda)
create or replace function public.porta_tarefa_json(t tarefas) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'id', t.id, 'titulo', t.titulo, 'status', t.status,
    'cliente', (select nome from clientes where id = t.cliente_id),
    'entrega', (select nome from tipos_entrega where id = t.tipo_entrega_id),
    'quantidade', t.quantidade, 'prioridade', t.prioridade,
    'inicio', t.inicio, 'vencimento', t.vencimento, 'descricao', t.descricao, 'checklist', t.etapas,
    'legenda', t.legenda, 'publicarEm', t.publicar_em, 'publicadaEm', t.publicada_em,
    'criadaEm', t.criado_em, 'concluidaEm', t.concluida_em,
    'etapa', case
      when t.publicada_em is not null then 'publicada'
      when t.cliente_aprovou_em is not null then case when t.agendada_em is not null then 'agendada' else 'aprovada' end
      when t.status = 'revisao' then 'aguardando'
      when t.status = 'concluida' then 'entregue'
      when t.feedback_em is not null and (t.enviada_cliente_em is null or t.feedback_em > t.enviada_cliente_em) then 'ajuste'
      when t.status = 'a_fazer' and t.publicar_em is not null then 'planejado'
      else 'producao'
    end,
    'aprovadaEm', t.cliente_aprovou_em,
    'agendadaEm', t.agendada_em,
    'enviadaClienteEm', t.enviada_cliente_em,
    'rede', t.rede,
    'lote', t.lote
  );
$$;
