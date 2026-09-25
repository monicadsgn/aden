-- Aden · segunda leva (aprovação dos sócios, cronômetro, pagamentos, perfis)
-- Parte 2 de 6. Rode cada parte inteira, numa query nova, em ordem.
-- (Dividida em partes pequenas porque colar um arquivo grande cortava o texto.)

-- ─── Pedidos de alteração e aprovações ──────────────────────────────────────
create table pedidos_alteracao (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  -- campos: mudança em campo protegido. excecao: escopo/proposta abaixo do piso
  tipo text not null check (tipo in ('campos', 'excecao')),
  descricao text not null,
  itens jsonb not null default '[]',
  dados jsonb,                               -- exceção: cenário, cliente, perda por sócio
  assinatura text,                           -- exceção: conteúdo exato que foi aprovado
  cliente_id uuid references clientes(id) on delete set null,
  afetados uuid[] not null,
  impacto jsonb,                             -- pessoa → quanto muda no bolso por mês (centavos)
  status text not null default 'pendente' check (status in ('pendente', 'aplicado', 'recusado', 'cancelado')),
  motivo text,
  autor_id uuid default auth.uid(),
  autor_nome text,
  autor_pessoa_id uuid references pessoas(id) on delete set null,
  criado_em timestamptz not null default now(),
  decidido_em timestamptz
);
alter table pedidos_alteracao enable row level security;
create index pedidos_org on pedidos_alteracao (org_id, criado_em desc);

create table aprovacoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  pedido_id uuid not null references pedidos_alteracao(id) on delete cascade,
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  decisao text not null check (decisao in ('aprovado', 'recusado')),
  automatica boolean not null default false, -- quem pediu é o próprio afetado
  por uuid default auth.uid(),
  em timestamptz not null default now(),
  unique (pedido_id, pessoa_id)
);
alter table aprovacoes enable row level security;

-- ─── Avisos para os sócios ──────────────────────────────────────────────────
create table avisos_socios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  titulo text not null,
  texto text not null,
  antes jsonb,
  depois jsonb,
  impacto_centavos bigint,                   -- quanto muda no bolso por mês
  autor_nome text,
  pedido_id uuid references pedidos_alteracao(id) on delete set null,
  criado_em timestamptz not null default now(),
  lido_em timestamptz
);
alter table avisos_socios enable row level security;
create index avisos_pessoa on avisos_socios (org_id, pessoa_id, criado_em desc);
