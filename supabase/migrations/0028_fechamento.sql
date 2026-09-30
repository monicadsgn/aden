-- Aden · Fase 5, passo 1 (aprovado em 30/09/2026): o fechamento do cliente.
-- Só acréscimo, com cópia de segurança antes (backup_20260930b.*_antes_0028).
--
-- - CRM: duas etapas do processo do Áleff entram no funil, sem tirar nenhuma: pesquisa de nicho e reunião comercial.
-- - Checklist de fechamento por cliente, na ordem combinada: onboarding → contrato → link de pagamento → pasta no
--   Drive → briefing → kickoff → link do painel. Cada passo guarda quando foi feito e quem fez (o banco preenche).
--   O link do painel não entra aqui: ele se confere sozinho pelo link criado na ficha.
-- - Mês do onboarding cobra mensalidade? Fica configurável (vazio = a definir entre os sócios).

alter table leads drop constraint if exists leads_etapa_check;
alter table leads add constraint leads_etapa_check
  check (etapa in ('lead_recebido', 'pesquisa', 'contato_feito', 'reuniao', 'proposta_enviada', 'ganho', 'perdido'));

alter table configuracoes_empresa add column if not exists mensalidade_no_onboarding boolean;

-- quando o fechamento começou (o lead virou cliente); vazio = cliente antigo, sem checklist
alter table clientes add column if not exists fechamento_iniciado_em timestamptz;

create table if not exists fechamento_passos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  passo text not null check (passo in ('onboarding', 'contrato', 'pagamento', 'pasta_drive', 'briefing', 'kickoff')),
  feito_em timestamptz,
  feito_por_nome text,
  pelo_claude boolean not null default false,
  -- link do que foi feito (pasta, contrato, link de pagamento) e data combinada (kickoff)
  link text check (link is null or link ~ '^https://'),
  data date,
  observacao text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  unique (cliente_id, passo)
);
alter table fechamento_passos enable row level security;

drop policy if exists fechamento_leitura on fechamento_passos;
create policy fechamento_leitura on fechamento_passos for select using (eh_membro(org_id));
drop policy if exists fechamento_escrita on fechamento_passos;
create policy fechamento_escrita on fechamento_passos for all using (eh_admin(org_id)) with check (eh_admin(org_id));

-- quem fez vem do banco (o site ou o Claude com o código do sócio)
create or replace function public.fechamento_autor() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare q record;
begin
  if tg_op = 'UPDATE' then
    new.org_id := old.org_id;
    new.cliente_id := old.cliente_id;
  end if;
  if new.feito_em is null then
    new.feito_por_nome := null;
    new.pelo_claude := false;
  elsif tg_op = 'INSERT' or old.feito_em is null then
    select * into q from quem_age(new.org_id);
    new.feito_em := now();
    new.feito_por_nome := q.nome;
    new.pelo_claude := coalesce(q.pelo_claude, false);
  else
    new.feito_em := old.feito_em;
    new.feito_por_nome := old.feito_por_nome;
    new.pelo_claude := old.pelo_claude;
  end if;
  return new;
end;
$$;

drop trigger if exists fechamento_passos_autor on fechamento_passos;
create trigger fechamento_passos_autor before insert or update on fechamento_passos for each row execute function fechamento_autor();
drop trigger if exists fechamento_passos_carimbo on fechamento_passos;
create trigger fechamento_passos_carimbo before update on fechamento_passos for each row execute function carimbar();
drop trigger if exists fechamento_passos_auditoria on fechamento_passos;
create trigger fechamento_passos_auditoria after insert or update or delete on fechamento_passos for each row execute function auditar();
