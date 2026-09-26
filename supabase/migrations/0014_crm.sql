-- CRM: leads no funil e o histórico de conversa com cada um (26/09/2026).
-- Etapas iguais às do SoftMoni (referência da Moni): lead recebido → contato feito →
-- proposta enviada → ganho ou perdido. Nenhum número de negócio: valor estimado vem do
-- pacote/proposta ou do que a pessoa digita; "lead parado" só acende se configurado.

create table leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  contato text,
  telefone text,
  email text,
  instagram text,
  origem text,
  etapa text not null default 'lead_recebido'
    check (etapa in ('lead_recebido', 'contato_feito', 'proposta_enviada', 'ganho', 'perdido')),
  entrou_na_etapa_em timestamptz not null default now(),
  pacote_id uuid references pacotes(id) on delete set null,
  simulacao_id uuid references simulacoes(id) on delete set null,
  valor_estimado_centavos bigint check (valor_estimado_centavos is null or valor_estimado_centavos >= 0),
  responsavel_id uuid references pessoas(id) on delete set null,
  proximo_contato date,
  proxima_acao text,
  observacoes text,
  motivo_perda text,
  cliente_id uuid references clientes(id) on delete set null,
  criado_em timestamptz not null default now(),
  fechado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table leads enable row level security;
create index leads_org_etapa on leads (org_id, etapa);

create table lead_interacoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  tipo text not null default 'nota' check (tipo in ('nota', 'ligacao', 'whatsapp', 'reuniao', 'email', 'proposta')),
  texto text not null,
  em timestamptz not null default now(),
  autor_nome text,
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table lead_interacoes enable row level security;
create index lead_interacoes_lead on lead_interacoes (lead_id, em desc);

alter table configuracoes_empresa add column dias_lead_parado int check (dias_lead_parado is null or dias_lead_parado > 0);

create trigger leads_carimbo before update on leads for each row execute function carimbar();
create trigger lead_interacoes_carimbo before update on lead_interacoes for each row execute function carimbar();
create trigger leads_auditoria after insert or update or delete on leads for each row execute function auditar();
create trigger lead_interacoes_auditoria after insert or update or delete on lead_interacoes for each row execute function auditar();

create policy leads_leitura on leads for select using (eh_membro(org_id));
create policy leads_escrita on leads for all using (eh_admin(org_id)) with check (eh_admin(org_id));
create policy lead_interacoes_leitura on lead_interacoes for select using (eh_membro(org_id));
create policy lead_interacoes_escrita on lead_interacoes for all using (eh_admin(org_id)) with check (eh_admin(org_id));
