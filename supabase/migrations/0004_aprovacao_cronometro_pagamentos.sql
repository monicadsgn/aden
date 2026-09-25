-- ════════════════════════════════════════════════════════════════════════════
-- Aden: segunda leva
--   • regime, ordem de distribuição e calibragem na configuração
--   • horas em minutos (mais casas decimais)
--   • cronômetro (medições) e pagamentos
--   • proteção da remuneração dos sócios: pedidos de alteração e aprovações
--   • avisos para os sócios
--   • perfil "contador" preparado (só leitura do financeiro)
--   • histórico que não se apaga
-- Parte 1 de 3 (0004, 0005, 0006). Rode cada parte inteira, numa query nova, em ordem.
-- ════════════════════════════════════════════════════════════════════════════

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

-- ─── Carimbo, auditoria e RLS ───────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['medicoes', 'pagamentos'] loop
    execute format('create trigger %I before update on %I for each row execute function carimbar()', t || '_carimbo', t);
  end loop;
  foreach t in array array['medicoes', 'pagamentos', 'pedidos_alteracao', 'aprovacoes', 'avisos_socios'] loop
    execute format('create trigger %I after insert or update or delete on %I for each row execute function auditar()', t || '_auditoria', t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (eh_membro(org_id))', t || '_leitura', t);
  end loop;
  -- escrita normal (sócios) em medições e pagamentos
  foreach t in array array['medicoes', 'pagamentos'] loop
    execute format('create policy %I on %I for insert with check (eh_admin(org_id))', t || '_insercao', t);
    execute format('create policy %I on %I for update using (eh_admin(org_id)) with check (eh_admin(org_id))', t || '_edicao', t);
    execute format('create policy %I on %I for delete using (eh_admin(org_id))', t || '_remocao', t);
  end loop;
end $$;

-- avisos: sócio cria e marca como lido; ninguém apaga
create policy avisos_socios_insercao on avisos_socios for insert with check (eh_admin(org_id));
create policy avisos_socios_edicao on avisos_socios for update using (eh_admin(org_id)) with check (eh_admin(org_id));
-- pedidos e aprovações: só pelas funções abaixo (sem política de escrita)

-- contador: só leitura do financeiro (nunca piso, horas, divisão nem negociação)
create policy pagamentos_contador on pagamentos for select using (eh_financeiro(org_id));
create policy clientes_contador on clientes for select using (eh_financeiro(org_id));
create policy custos_fixos_contador on custos_fixos for select using (eh_financeiro(org_id));
create policy configuracoes_empresa_contador on configuracoes_empresa for select using (eh_financeiro(org_id));
