-- Aden · Conexão com a Meta (Instagram e Facebook), etapa 1: só leitura (19/11/2026). Só acréscimo.
--
-- Uma linha por cliente: qual Página do Facebook e qual Instagram são dele e em que estado está a conexão.
-- NUNCA guarda token: o acesso da Aden à Meta mora só na Vercel (META_ACCESS_TOKEN).
-- publicar_ativo e metricas_ativas nascem desligados e só as etapas futuras (publicar, métricas) vão usá-los;
-- quem liga é um sócio, cliente por cliente.
-- Leitura: só sócio (eh_membro, que desde a 0018 é só sócio). Escrita: só sócio (eh_admin).
-- O cliente final nunca lê esta tabela (o painel dele usa só as funções do painel).

create table if not exists conexoes_meta (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  pagina_id text check (pagina_id is null or pagina_id ~ '^[0-9]{1,30}$'),
  pagina_nome text check (pagina_nome is null or length(pagina_nome) <= 200),
  instagram_id text check (instagram_id is null or instagram_id ~ '^[0-9]{1,30}$'),
  instagram_usuario text check (instagram_usuario is null or length(instagram_usuario) <= 60),
  status text not null default 'nao_conectado' check (status in ('nao_conectado', 'conectando', 'conectado', 'com_problema', 'pausado')),
  publicar_ativo boolean not null default false,
  metricas_ativas boolean not null default false,
  ultima_conferencia timestamptz,
  ultimo_erro text check (ultimo_erro is null or length(ultimo_erro) <= 500),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create unique index if not exists conexoes_meta_um_por_cliente on conexoes_meta (cliente_id);
create index if not exists conexoes_meta_org_status on conexoes_meta (org_id, status);

-- o cliente da linha tem que ser da mesma organização
create or replace function conexoes_meta_mesma_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from clientes c where c.id = new.cliente_id and c.org_id = new.org_id) then
    raise exception 'Cliente de outra organização.';
  end if;
  return new;
end;
$$;
drop trigger if exists conexoes_meta_org on conexoes_meta;
create trigger conexoes_meta_org before insert or update on conexoes_meta for each row execute function conexoes_meta_mesma_org();

alter table conexoes_meta enable row level security;
drop policy if exists conexoes_meta_leitura on conexoes_meta;
create policy conexoes_meta_leitura on conexoes_meta for select using (eh_membro(org_id));
drop policy if exists conexoes_meta_escrita on conexoes_meta;
create policy conexoes_meta_escrita on conexoes_meta for all using (eh_admin(org_id)) with check (eh_admin(org_id));
drop trigger if exists conexoes_meta_carimbo on conexoes_meta;
create trigger conexoes_meta_carimbo before update on conexoes_meta for each row execute function carimbar();
drop trigger if exists conexoes_meta_auditoria on conexoes_meta;
create trigger conexoes_meta_auditoria after insert or update or delete on conexoes_meta for each row execute function auditar();
