-- Aden · Fase 5, passo 5: onboarding do cliente. Só acréscimo.
-- O texto é da Moni (aprovado em 30/09/2026), guardado aqui para os sócios editarem em Configurações → Onboarding.
-- O PDF de cada cliente junta esse texto com o pacote, os serviços contratados, a garantia e o contrato da ficha.

create table if not exists onboarding_modelo (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references organizacoes(id) on delete cascade,
  -- [{ "chave": "livre|incluso|servicos|prazos|contato", "titulo": "...", "texto": "..." }], na ordem do documento
  secoes jsonb not null default '[]'::jsonb check (jsonb_typeof(secoes) = 'array'),
  -- { "<servico_id>": "como funciona" }
  texto_servico jsonb not null default '{}'::jsonb check (jsonb_typeof(texto_servico) = 'object'),
  texto_garantia text,
  whatsapp text,
  instagram text,
  email text,
  atendimento text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

alter table onboarding_modelo enable row level security;
drop policy if exists onboarding_modelo_leitura on onboarding_modelo;
create policy onboarding_modelo_leitura on onboarding_modelo for select using (eh_membro(org_id));
drop policy if exists onboarding_modelo_escrita on onboarding_modelo;
create policy onboarding_modelo_escrita on onboarding_modelo for all using (eh_admin(org_id)) with check (eh_admin(org_id));

drop trigger if exists onboarding_modelo_carimbo on onboarding_modelo;
create trigger onboarding_modelo_carimbo before update on onboarding_modelo for each row execute function carimbar();
drop trigger if exists onboarding_modelo_auditoria on onboarding_modelo;
create trigger onboarding_modelo_auditoria after insert or update or delete on onboarding_modelo for each row execute function auditar();
