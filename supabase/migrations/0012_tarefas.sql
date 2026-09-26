-- Tarefas com o cronômetro dentro (como o "Rastrear tempo" do ClickUp).
-- Cada tarefa tem UMA medição: Start/Pausar mexem nela; concluir a tarefa conclui a medição.
-- A medição vale por `unidades` entregas (a quantidade da tarefa): a calibragem divide o tempo por elas.

create table tarefas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  titulo text not null,
  cliente_id uuid references clientes(id) on delete set null,
  tipo_entrega_id uuid references tipos_entrega(id) on delete set null,
  quantidade int not null default 1 check (quantidade > 0),
  status text not null default 'a_fazer' check (status in ('a_fazer', 'em_producao', 'revisao', 'concluida')),
  prioridade text check (prioridade in ('urgente', 'alta', 'normal', 'baixa')),
  responsavel_id uuid references pessoas(id) on delete set null,
  inicio date,
  vencimento date,
  descricao text,
  -- checklist: [{ "id", "titulo", "feita" }]
  etapas jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  concluida_em timestamptz,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table tarefas enable row level security;
create index tarefas_org_status on tarefas (org_id, status);

create trigger tarefas_carimbo before update on tarefas for each row execute function carimbar();
create trigger tarefas_auditoria after insert or update or delete on tarefas for each row execute function auditar();
create policy tarefas_leitura on tarefas for select using (eh_membro(org_id));
create policy tarefas_insercao on tarefas for insert with check (eh_admin(org_id));
create policy tarefas_edicao on tarefas for update using (eh_admin(org_id)) with check (eh_admin(org_id));
create policy tarefas_remocao on tarefas for delete using (eh_admin(org_id));

alter table medicoes
  add column tarefa_id uuid references tarefas(id) on delete set null,
  add column unidades int not null default 1 check (unidades > 0);
create unique index medicoes_uma_por_tarefa on medicoes (tarefa_id) where tarefa_id is not null;
