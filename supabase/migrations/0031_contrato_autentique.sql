-- Aden · Fase 5, passo 3: contrato com assinatura eletrônica (Autentique).
-- Só acréscimo, com cópia de segurança antes (backup_20260930b.*_antes_0031).
--
-- - Ficha do cliente ganha o que o contrato pede e ainda não tinha: nome no documento (razão social), CPF/CNPJ e endereço.
-- - contrato_modelo: o que é igual em todo contrato da Aden (dados da contratada, quem assina por ela, obrigações e
--   disposições gerais). Tudo começa vazio: é texto dos sócios, o sistema não escreve cláusula.
-- - contratos_assinatura: cada contrato mandado para a Autentique, com a situação da última conferência.
--   Quem enviou vem do banco (o site ou o Claude com o código do sócio).

alter table clientes add column if not exists razao_social text;
alter table clientes add column if not exists documento text;
alter table clientes add column if not exists endereco text;

create table if not exists contrato_modelo (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references organizacoes(id) on delete cascade,
  contratada_nome text,
  contratada_documento text,
  contratada_endereco text,
  obrigacoes text,
  disposicoes text,
  -- [{ "nome": "...", "email": "..." }]
  signatarios_aden jsonb not null default '[]'::jsonb check (jsonb_typeof(signatarios_aden) = 'array'),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

create table if not exists contratos_assinatura (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  autentique_id text not null unique,
  nome text not null,
  situacao text not null default 'enviado' check (situacao in ('enviado', 'assinado', 'recusado', 'cancelado')),
  signatarios jsonb not null default '[]'::jsonb,
  faltam jsonb not null default '[]'::jsonb,
  enviado_em timestamptz not null default now(),
  enviado_por_nome text,
  pelo_claude boolean not null default false,
  assinado_em timestamptz,
  conferido_em timestamptz,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index if not exists contratos_assinatura_cliente on contratos_assinatura (cliente_id);

alter table contrato_modelo enable row level security;
alter table contratos_assinatura enable row level security;

drop policy if exists contrato_modelo_leitura on contrato_modelo;
create policy contrato_modelo_leitura on contrato_modelo for select using (eh_membro(org_id));
drop policy if exists contrato_modelo_escrita on contrato_modelo;
create policy contrato_modelo_escrita on contrato_modelo for all using (eh_admin(org_id)) with check (eh_admin(org_id));
drop policy if exists contratos_assinatura_leitura on contratos_assinatura;
create policy contratos_assinatura_leitura on contratos_assinatura for select using (eh_membro(org_id));
drop policy if exists contratos_assinatura_escrita on contratos_assinatura;
create policy contratos_assinatura_escrita on contratos_assinatura for all using (eh_admin(org_id)) with check (eh_admin(org_id));

-- quem enviou vem do banco; o que foi enviado não muda depois
create or replace function public.contrato_assinatura_autor() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare q record;
begin
  if tg_op = 'INSERT' then
    select * into q from quem_age(new.org_id);
    new.enviado_em := now();
    new.enviado_por_nome := q.nome;
    new.pelo_claude := coalesce(q.pelo_claude, false);
  else
    new.org_id := old.org_id;
    new.cliente_id := old.cliente_id;
    new.autentique_id := old.autentique_id;
    new.nome := old.nome;
    new.signatarios := old.signatarios;
    new.enviado_em := old.enviado_em;
    new.enviado_por_nome := old.enviado_por_nome;
    new.pelo_claude := old.pelo_claude;
  end if;
  return new;
end;
$$;

drop trigger if exists contratos_assinatura_autor on contratos_assinatura;
create trigger contratos_assinatura_autor before insert or update on contratos_assinatura for each row execute function contrato_assinatura_autor();

drop trigger if exists contrato_modelo_carimbo on contrato_modelo;
create trigger contrato_modelo_carimbo before update on contrato_modelo for each row execute function carimbar();
drop trigger if exists contrato_modelo_auditoria on contrato_modelo;
create trigger contrato_modelo_auditoria after insert or update or delete on contrato_modelo for each row execute function auditar();
drop trigger if exists contratos_assinatura_carimbo on contratos_assinatura;
create trigger contratos_assinatura_carimbo before update on contratos_assinatura for each row execute function carimbar();
drop trigger if exists contratos_assinatura_auditoria on contratos_assinatura;
create trigger contratos_assinatura_auditoria after insert or update or delete on contratos_assinatura for each row execute function auditar();
