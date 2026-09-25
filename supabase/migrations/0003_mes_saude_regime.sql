-- Aden: visão do mês, saúde do cliente e regime (MEI).
-- Nenhuma coluna de negócio tem valor padrão: tudo nasce vazio.

-- ─── Configuração da empresa: regime, taxas e avisos ────────────────────────
alter table configuracoes_empresa
  add column imposto_fixo_mensal_centavos bigint,        -- ex.: DAS do MEI (entra no rateio)
  add column taxa_recebimento_fixa_centavos bigint,      -- tarifa fixa por recebimento
  add column teto_faturamento_anual_centavos bigint,     -- teto do regime
  add column aviso_teto_pct numeric(7,4),                -- avisar a partir deste % do teto
  add column ociosidade_pct numeric(7,4),                -- uso abaixo deste % = folga sobrando
  add column arredondamento_proposta_centavos bigint;    -- arredondar proposta em múltiplos de

-- ─── Escopo contratado do cliente (cenário da calculadora) ──────────────────
alter table contratos add column escopo jsonb;

-- ─── Registro mensal por cliente: quanto entrou e quantas horas custou ──────
create table mes_cliente (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  competencia date not null,                 -- sempre o dia 1 do mês
  valor_recebido_centavos bigint,            -- vazio = considera o valor do contrato
  observacao text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  unique (cliente_id, competencia)
);

create table horas_realizadas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  competencia date not null,
  horas numeric(8,2),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  unique (cliente_id, pessoa_id, competencia)
);

do $$
declare t text;
begin
  foreach t in array array['mes_cliente', 'horas_realizadas'] loop
    execute format('create trigger %I before update on %I for each row execute function carimbar()', t || '_carimbo', t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function auditar()', t || '_auditoria', t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (eh_membro(org_id))', t || '_leitura', t);
    execute format('create policy %I on %I for insert with check (eh_admin(org_id))', t || '_insercao', t);
    execute format('create policy %I on %I for update using (eh_admin(org_id)) with check (eh_admin(org_id))', t || '_edicao', t);
    execute format('create policy %I on %I for delete using (eh_admin(org_id))', t || '_remocao', t);
  end loop;
end $$;
