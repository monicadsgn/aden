-- Aden · segunda leva (aprovação dos sócios, cronômetro, pagamentos, perfis)
-- Parte 1 de 6. Rode cada parte inteira, numa query nova, em ordem.
-- (Dividida em partes pequenas porque colar um arquivo grande cortava o texto.)

-- ─── Configuração da empresa ────────────────────────────────────────────────
alter table configuracoes_empresa
  add column regime text check (regime in ('mei', 'outro')),
  add column ordem_distribuicao text check (ordem_distribuicao in ('custo_primeiro', 'proporcional')),
  -- 5 medições: número pedido pela Moni (25/09/2026), editável na tela
  add column medicoes_calibragem int default 5 check (medicoes_calibragem is null or medicoes_calibragem > 0),
  add column diferenca_sugerir_pct numeric(7,4);
update configuracoes_empresa set medicoes_calibragem = 5 where medicoes_calibragem is null;

-- ─── Horas em minutos: mais casas para 20 min = 0,333333 h ──────────────────
alter table tipos_entrega alter column horas_por_unidade type numeric(12,6);
alter table horas_realizadas alter column horas type numeric(12,6);
-- 0,33 h vira 20 min exatos; 0,67 h vira 40 min (arredonda para o minuto)
update tipos_entrega set horas_por_unidade = round(horas_por_unidade * 60) / 60.0
  where horas_por_unidade is not null and horas_por_unidade * 60 <> round(horas_por_unidade * 60);
alter table tipos_entrega add column calibrar_desde timestamptz;

-- ─── Perfis: contador (só leitura do financeiro) ────────────────────────────
alter table membros drop constraint membros_papel_check;
alter table membros add constraint membros_papel_check
  check (papel in ('admin', 'contador', 'colaborador', 'freelancer', 'cliente'));

create or replace function eh_financeiro(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membros m
    where m.org_id = org and m.user_id = auth.uid() and m.ativo and m.papel in ('admin', 'contador')
  );
$$;

-- pessoa (sócio) ligada ao login de quem está chamando
create or replace function minha_pessoa(org uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select p.id from pessoas p join membros m on m.id = p.membro_id
  where m.org_id = org and m.user_id = auth.uid() and m.ativo
  limit 1;
$$;

-- ─── Cronômetro ─────────────────────────────────────────────────────────────
create table medicoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  tipo_entrega_id uuid not null references tipos_entrega(id) on delete cascade,
  pessoa_id uuid references pessoas(id) on delete set null,
  estado text not null check (estado in ('rodando', 'pausado', 'concluido')),
  acumulado_segundos numeric(12,2) not null default 0,
  retomado_em timestamptz,
  fim timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table medicoes enable row level security;
create index medicoes_tipo on medicoes (org_id, tipo_entrega_id);

-- ─── Pagamentos (cada um que cai; vários por mês) ───────────────────────────
create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  competencia date not null,                 -- mês de referência (dia 1)
  valor_centavos bigint not null check (valor_centavos > 0),
  recebido_em date not null,
  observacao text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table pagamentos enable row level security;
create index pagamentos_mes on pagamentos (org_id, competencia);
