-- ════════════════════════════════════════════════════════════════════════════
-- Aden — Fase 1: núcleo (organização, membros, auditoria) + calculadora
--
-- Projeto Supabase EXCLUSIVO da Aden. Nada aqui é compartilhado com o SoftMoni
-- nem com a Mônica Design.
--
-- Convenções:
--   • dinheiro em centavos (bigint)
--   • percentuais de 0 a 100 (numeric)
--   • nenhuma coluna de negócio tem valor padrão: tudo nasce vazio (null)
--   • toda tabela tem org_id e passa por RLS
--   • toda alteração em valor, percentual e configuração vai para `auditoria`
--     por trigger — sem depender da aplicação lembrar de registrar
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Organização e membros ──────────────────────────────────────────────────

create table organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  criado_em timestamptz not null default now()
);

create table membros (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  -- admin: sócios. Os demais papéis já existem para as próximas fases.
  papel text not null check (papel in ('admin', 'colaborador', 'freelancer', 'cliente')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (org_id, user_id)
);

create or replace function eh_membro(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membros m
    where m.org_id = org and m.user_id = auth.uid() and m.ativo
      and m.papel in ('admin', 'colaborador', 'freelancer')
  );
$$;

create or replace function eh_admin(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membros m
    where m.org_id = org and m.user_id = auth.uid() and m.ativo and m.papel = 'admin'
  );
$$;

-- ─── Auditoria ──────────────────────────────────────────────────────────────

create table auditoria (
  id bigserial primary key,
  org_id uuid not null references organizacoes(id) on delete cascade,
  tabela text not null,
  registro_id text not null,
  acao text not null check (acao in ('criou', 'alterou', 'removeu')),
  antes jsonb,
  depois jsonb,
  autor_id uuid,
  autor_email text,
  em timestamptz not null default now()
);
create index auditoria_org_em on auditoria (org_id, em desc);

create or replace function auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_id text;
  v_antes jsonb;
  v_depois jsonb;
begin
  if tg_op = 'DELETE' then
    v_antes := to_jsonb(old);
  elsif tg_op = 'UPDATE' then
    v_antes := to_jsonb(old);
    v_depois := to_jsonb(new);
    -- ignora updates que não mudaram nada além dos carimbos
    if (v_antes - 'atualizado_em' - 'atualizado_por') = (v_depois - 'atualizado_em' - 'atualizado_por') then
      return new;
    end if;
  else
    v_depois := to_jsonb(new);
  end if;
  v_org := coalesce(v_depois ->> 'org_id', v_antes ->> 'org_id')::uuid;
  v_id := coalesce(v_depois ->> 'id', v_antes ->> 'id', v_depois ->> 'org_id', v_antes ->> 'org_id');
  insert into auditoria (org_id, tabela, registro_id, acao, antes, depois, autor_id, autor_email)
  values (
    v_org, tg_table_name, v_id,
    case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'alterou' else 'removeu' end,
    v_antes, v_depois, auth.uid(), auth.jwt() ->> 'email'
  );
  return coalesce(new, old);
end;
$$;

create or replace function carimbar() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

-- ─── Configuração da empresa ────────────────────────────────────────────────

create table configuracoes_empresa (
  org_id uuid primary key references organizacoes(id) on delete cascade,
  reinvestimento_pct numeric(7,4),
  imposto_pct numeric(7,4),
  taxa_recebimento_pct numeric(7,4),
  regra_rateio text check (regra_rateio in ('igual', 'proporcional')),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

-- Pessoas que produzem. Sócios hoje; colaboradores nas próximas fases.
create table pessoas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  membro_id uuid references membros(id) on delete set null,
  nome text not null,
  socio boolean not null default false,
  percentual_padrao numeric(7,4),
  piso_hora_centavos bigint,
  capacidade_horas_mes numeric(8,2),
  ativo boolean not null default true,
  ordem int not null default 0,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

create table servicos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  ordem int not null default 0,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

-- Divisão padrão das horas de um serviço entre pessoas (%)
create table servico_divisao (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  servico_id uuid not null references servicos(id) on delete cascade,
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  percentual numeric(7,4),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  unique (servico_id, pessoa_id)
);

create table tipos_entrega (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  servico_id uuid references servicos(id) on delete set null,
  nome text not null,
  horas_por_unidade numeric(8,2),
  ativo boolean not null default true,
  ordem int not null default 0,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

-- Custos fixos mensais da empresa, rateados entre clientes ativos
create table custos_fixos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  valor_mensal_centavos bigint,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

-- ─── Clientes e contratos (mínimo da Fase 1; a Fase 2 amplia) ───────────────

create table clientes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  -- a própria rede da Aden: consome horas, não gera receita
  interno boolean not null default false,
  participa_rateio boolean not null default true,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

create table contratos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  status text not null check (status in ('rascunho', 'ativo', 'encerrado')),
  valor_mensal_centavos bigint,
  inicio date,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index contratos_cliente on contratos (cliente_id);

-- ─── Simulações da calculadora ──────────────────────────────────────────────

create table simulacoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  cliente_id uuid references clientes(id) on delete set null,
  -- lead_id entra na fase de CRM
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

create table simulacao_cenarios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  simulacao_id uuid not null references simulacoes(id) on delete cascade,
  ordem int not null,
  nome text not null,
  entradas jsonb not null,
  -- fotografia do resultado e da configuração usada no momento do salvamento
  resultado jsonb,
  config_snapshot jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index simulacao_cenarios_sim on simulacao_cenarios (simulacao_id, ordem);

-- ─── Triggers de carimbo e auditoria ────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'configuracoes_empresa', 'pessoas', 'servicos', 'servico_divisao', 'tipos_entrega',
    'custos_fixos', 'clientes', 'contratos', 'simulacoes', 'simulacao_cenarios'
  ] loop
    execute format('create trigger %I before update on %I for each row execute function carimbar()', t || '_carimbo', t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function auditar()', t || '_auditoria', t);
  end loop;
end $$;

create trigger membros_auditoria after insert or update or delete on membros
  for each row execute function auditar();

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Leitura: membros da equipe. Escrita: administradores (sócios).
-- Clientes (papel 'cliente') não enxergam nada destas tabelas.

alter table organizacoes enable row level security;
alter table membros enable row level security;
alter table auditoria enable row level security;

create policy org_leitura on organizacoes for select using (eh_membro(id));
create policy org_admin on organizacoes for update using (eh_admin(id)) with check (eh_admin(id));

create policy membros_leitura on membros for select using (eh_membro(org_id) or user_id = auth.uid());
create policy membros_admin on membros for all using (eh_admin(org_id)) with check (eh_admin(org_id));

-- auditoria: só leitura, e só para admins. Inserção apenas via trigger.
create policy auditoria_leitura on auditoria for select using (eh_admin(org_id));

do $$
declare t text;
begin
  foreach t in array array[
    'configuracoes_empresa', 'pessoas', 'servicos', 'servico_divisao', 'tipos_entrega',
    'custos_fixos', 'clientes', 'contratos', 'simulacoes', 'simulacao_cenarios'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (eh_membro(org_id))', t || '_leitura', t);
    execute format('create policy %I on %I for insert with check (eh_admin(org_id))', t || '_insercao', t);
    execute format('create policy %I on %I for update using (eh_admin(org_id)) with check (eh_admin(org_id))', t || '_edicao', t);
    execute format('create policy %I on %I for delete using (eh_admin(org_id))', t || '_remocao', t);
  end loop;
end $$;

-- ─── Primeiro acesso ────────────────────────────────────────────────────────
-- Rode no SQL Editor (como dono do projeto) depois de criar os usuários em
-- Authentication → Users. Ver docs/SETUP.md.

create or replace function vincular_socio(p_org uuid, p_email text, p_nome text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_membro uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then
    raise exception 'Usuário % não existe em Authentication → Users', p_email;
  end if;
  insert into membros (org_id, user_id, nome, email, papel)
  values (p_org, v_user, p_nome, p_email, 'admin')
  on conflict (org_id, user_id) do update set papel = 'admin', ativo = true, nome = excluded.nome
  returning id into v_membro;
  return v_membro;
end;
$$;
revoke execute on function vincular_socio(uuid, text, text) from public, anon, authenticated;
