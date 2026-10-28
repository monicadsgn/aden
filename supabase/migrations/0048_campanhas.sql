-- Aden · área de Campanhas (28/10/2026). Só acréscimo: nada do que existe é apagado.
--
-- Cada campanha (página de captação, oferta, anúncio) tem ficha própria: status (ativa, pausada, arquivada),
-- o que promete, quem pode entrar, regras, serviços, limite de clientes, link da página e notas.
-- Os textos são livres de propósito: as regras da oferta (ex.: mês grátis) ainda vão ser definidas pelos sócios.
-- Nenhum número de negócio mora aqui: o limite de clientes começa vazio e só vale o que a pessoa digitar.
-- Nada se apaga: campanha encerrada vira "arquivada" e continua consultável.
-- O quiz de conversão que já existe vira a primeira campanha (tipo 'quiz'); a configuração dele continua em quiz_config.

create table if not exists campanhas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  tipo text not null default 'outra' check (tipo in ('quiz', 'outra')),
  status text not null default 'ativa' check (status in ('ativa', 'pausada', 'arquivada')),
  promete text not null default '' check (length(promete) <= 4000),
  quem_entra text not null default '' check (length(quem_entra) <= 4000),
  regras text not null default '' check (length(regras) <= 4000),
  servicos text not null default '' check (length(servicos) <= 2000),
  limite_clientes integer check (limite_clientes is null or limite_clientes >= 0),
  pagina_url text not null default '' check (length(pagina_url) <= 300),
  notas text not null default '' check (length(notas) <= 8000),
  criado_em timestamptz not null default now(),
  arquivada_em timestamptz,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create unique index if not exists campanhas_um_quiz_por_org on campanhas (org_id) where tipo = 'quiz';
create index if not exists campanhas_org_status on campanhas (org_id, status);

alter table campanhas enable row level security;
drop policy if exists campanhas_leitura on campanhas;
create policy campanhas_leitura on campanhas for select using (eh_membro(org_id));
drop policy if exists campanhas_escrita on campanhas;
create policy campanhas_escrita on campanhas for all using (eh_admin(org_id)) with check (eh_admin(org_id));
drop trigger if exists campanhas_carimbo on campanhas;
create trigger campanhas_carimbo before update on campanhas for each row execute function carimbar();
drop trigger if exists campanhas_auditoria on campanhas;
create trigger campanhas_auditoria after insert or update or delete on campanhas for each row execute function auditar();

-- O quiz que já está no ar vira a primeira campanha de cada organização.
insert into campanhas (org_id, nome, tipo, status)
select o.id, 'Quiz de conversão', 'quiz', 'ativa' from organizacoes o
where not exists (select 1 from campanhas c where c.org_id = o.id and c.tipo = 'quiz');
