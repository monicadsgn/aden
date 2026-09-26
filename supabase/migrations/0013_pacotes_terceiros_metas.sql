-- Pacotes fechados, terceiros cobrados por saída e trilha de metas (26/09/2026).
-- Nenhum número de negócio aqui: tudo começa vazio e os sócios preenchem.

-- ─── Terceiros (ex.: audiovisual: vai ao cliente, grava, edita e entrega) ───
create table terceiros (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  inclui text,
  frase_cliente text,
  valor_por_saida_centavos bigint check (valor_por_saida_centavos is null or valor_por_saida_centavos >= 0),
  deslocamento_medio_centavos bigint check (deslocamento_medio_centavos is null or deslocamento_medio_centavos >= 0),
  ativo boolean not null default true,
  ordem int not null default 0,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table terceiros enable row level security;
alter table tipos_entrega add column terceiro_id uuid references terceiros(id) on delete set null;

-- ─── Pacotes (o que é entregue; horas e preço saem do cálculo) ──────────────
create table pacotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  descricao text,
  itens_cliente jsonb not null default '[]'::jsonb,
  rotina jsonb not null default '[]'::jsonb,
  entrada jsonb not null default '[]'::jsonb,
  padrao boolean not null default false,
  ativo boolean not null default true,
  ordem int not null default 0,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table pacotes enable row level security;
create unique index pacotes_um_padrao on pacotes (org_id) where padrao;

-- ─── Trilha de metas ─────────────────────────────────────────────────────────
create table metas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  criterio text check (criterio in ('faturamento_mensal', 'clientes', 'recebido_socio', 'uso_capacidade')),
  alvo numeric(14,2) check (alvo is null or alvo > 0),
  acao text,
  ordem int not null default 0,
  conquistada_em timestamptz,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table metas enable row level security;

create trigger terceiros_carimbo before update on terceiros for each row execute function carimbar();
create trigger pacotes_carimbo before update on pacotes for each row execute function carimbar();
create trigger metas_carimbo before update on metas for each row execute function carimbar();
create trigger terceiros_auditoria after insert or update or delete on terceiros for each row execute function auditar();
create trigger pacotes_auditoria after insert or update or delete on pacotes for each row execute function auditar();
create trigger metas_auditoria after insert or update or delete on metas for each row execute function auditar();

create policy terceiros_leitura on terceiros for select using (eh_membro(org_id));
create policy terceiros_escrita on terceiros for all using (eh_admin(org_id)) with check (eh_admin(org_id));
create policy pacotes_leitura on pacotes for select using (eh_membro(org_id));
create policy pacotes_escrita on pacotes for all using (eh_admin(org_id)) with check (eh_admin(org_id));
create policy metas_leitura on metas for select using (eh_membro(org_id));
create policy metas_escrita on metas for all using (eh_admin(org_id)) with check (eh_admin(org_id));
