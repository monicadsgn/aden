-- Acessos da equipe (26/09/2026). Cada pessoa vê só o que é dela.
--
-- Papéis:
--   admin       = sócio: vê e faz tudo
--   contador    = só o financeiro (regras eh_financeiro, já existentes)
--   colaborador = equipe: vê e mexe em TODAS as tarefas, cria tarefas; nada de valores
--   freelancer  = vê e mexe só nas tarefas em que é responsável
--
-- Antes, a leitura geral (eh_membro) incluía colaborador e freelancer. Agora é só dos
-- sócios; a equipe ganha regras próprias, só nas tabelas de que precisa. Nomes de pessoas
-- e clientes chegam à equipe por uma função que devolve só nome e foto (nunca piso,
-- percentual, valor do contrato ou link do painel).

create or replace function eh_membro(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membros m
    where m.org_id = org and m.user_id = auth.uid() and m.ativo and m.papel = 'admin'
  );
$$;

create or replace function meu_papel(org uuid) returns text
language sql stable security definer set search_path = public as $$
  select papel from membros where org_id = org and user_id = auth.uid() and ativo limit 1;
$$;
revoke execute on function meu_papel(uuid) from public, anon;
grant execute on function meu_papel(uuid) to authenticated;

-- ─── Tarefas ──────────────────────────────────────────────────────────────────
create policy tarefas_equipe_leitura on tarefas for select using (
  meu_papel(org_id) = 'colaborador' or (meu_papel(org_id) = 'freelancer' and responsavel_id = minha_pessoa(org_id))
);
create policy tarefas_equipe_insercao on tarefas for insert with check (meu_papel(org_id) = 'colaborador');
create policy tarefas_equipe_edicao on tarefas for update
  using (meu_papel(org_id) = 'colaborador' or (meu_papel(org_id) = 'freelancer' and responsavel_id = minha_pessoa(org_id)))
  with check (meu_papel(org_id) = 'colaborador' or (meu_papel(org_id) = 'freelancer' and responsavel_id = minha_pessoa(org_id)));

-- ─── Tempo medido: cada um o seu ──────────────────────────────────────────────
create policy medicoes_equipe on medicoes for all
  using (meu_papel(org_id) in ('colaborador', 'freelancer') and pessoa_id = minha_pessoa(org_id))
  with check (meu_papel(org_id) in ('colaborador', 'freelancer') and pessoa_id = minha_pessoa(org_id));

-- ─── Tipos de entrega e serviços (para as tarefas; sem valores) ───────────────
create policy tipos_entrega_equipe on tipos_entrega for select using (meu_papel(org_id) in ('colaborador', 'freelancer'));
create policy servicos_equipe on servicos for select using (meu_papel(org_id) in ('colaborador', 'freelancer'));

-- artes das peças: a equipe também sobe
create policy "pecas: equipe envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'pecas' and public.meu_papel(((storage.foldername(name))[1])::uuid) in ('colaborador', 'freelancer'));

-- ─── Nomes para a equipe (sem nada sensível) ──────────────────────────────────
create or replace function equipe_nomes(org uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when meu_papel(org) is null then null else jsonb_build_object(
    'pessoas', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'socio', socio, 'ativo', ativo, 'fotoUrl', foto_url) order by ordem)
                         from pessoas where org_id = org), '[]'::jsonb),
    'clientes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'ativo', ativo) order by nome)
                          from clientes where org_id = org), '[]'::jsonb)
  ) end;
$$;
revoke execute on function equipe_nomes(uuid) from public, anon;
grant execute on function equipe_nomes(uuid) to authenticated;

-- ─── Convites ─────────────────────────────────────────────────────────────────
create table convites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  email text not null check (email = lower(email)),
  nome text not null,
  papel text not null check (papel in ('admin', 'contador', 'colaborador', 'freelancer')),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  aceito_em timestamptz,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table convites enable row level security;
create unique index convites_um_aberto on convites (org_id, email) where aceito_em is null;
create trigger convites_carimbo before update on convites for each row execute function carimbar();
create trigger convites_auditoria after insert or update or delete on convites for each row execute function auditar();
create policy convites_admin on convites for all using (eh_admin(org_id)) with check (eh_admin(org_id));

-- Quem entra com um e-mail convidado vira membro com o papel do convite. Equipe e
-- freelancer ganham também uma "pessoa" (não sócia), para receber tarefas.
create or replace function aceitar_convite() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_c convites;
  v_membro uuid;
begin
  if auth.uid() is null or v_email is null then return null; end if;
  if exists (select 1 from membros where user_id = auth.uid() and ativo) then return 'ja_membro'; end if;
  select * into v_c from convites where email = v_email and aceito_em is null order by criado_em desc limit 1;
  if not found then return null; end if;
  insert into membros (org_id, user_id, nome, email, papel) values (v_c.org_id, auth.uid(), v_c.nome, v_email, v_c.papel)
    returning id into v_membro;
  if v_c.papel in ('colaborador', 'freelancer') then
    insert into pessoas (org_id, nome, socio, ativo, membro_id) values (v_c.org_id, v_c.nome, false, true, v_membro);
  end if;
  update convites set aceito_em = now() where id = v_c.id;
  return v_c.papel;
end;
$$;
revoke execute on function aceitar_convite() from public, anon;
grant execute on function aceitar_convite() to authenticated;
