-- Aden · Fase 4 (aprovada em 30/09/2026): os dois sócios pelo Claude.
--
-- 1) Código pessoal do conector. Cada sócio gera o seu (Configurações → Equipe → Seu Claude). O servidor do conector
--    manda o código no cabeçalho "x-aden-conector" de cada chamada ao banco; o banco confere o código (só o hash fica
--    guardado) e passa a assinar em nome do dono:
--    - Histórico (auditoria) e carimbos no nome do sócio, marcados "pelo Claude";
--    - pedido de alteração protegida: se só afeta o dono do código, vale na hora (igual no site); se afeta o outro
--      sócio, vira pedido para ele. APROVAR/RECUSAR continua só pelo site: decidir_pedido não olha o código.
--    Sem cabeçalho (ou com código inválido) nada muda: vale o login, como antes.
-- 2) Memória de contexto do cliente: anotações por cliente (decisão, preferência, pendência, nota) com quem anotou.
--    Não se apagam: são marcadas como resolvidas e saem da lista principal. Só os sócios leem e escrevem.

-- ─── 1. Código pessoal do conector ───────────────────────────────────────────
alter table portas add column if not exists uso text not null default 'porta';
do $$ begin
  alter table portas add constraint portas_uso check (uso in ('porta', 'conector'));
exception when duplicate_object then null; end $$;

alter table auditoria add column if not exists pelo_claude boolean not null default false;

-- a porta genérica só aceita código de porta (o do conector não abre a porta, e vice-versa)
create or replace function public.porta_dono(p_codigo text, out org_id uuid, out pessoa_id uuid, out user_id uuid, out email text)
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v portas;
begin
  if p_codigo is null or length(p_codigo) < 20 then raise exception 'Código inválido.'; end if;
  select * into v from portas where hash = encode(digest(p_codigo, 'sha256'), 'hex') and cancelado_em is null and uso = 'porta';
  if not found then raise exception 'Código inválido.'; end if;
  select m.org_id, p.id, m.user_id, m.email into org_id, pessoa_id, user_id, email
  from membros m join pessoas p on p.membro_id = m.id
  where m.id = v.membro_id and m.ativo and p.ativo limit 1;
  if pessoa_id is null then raise exception 'Código inválido.'; end if;
  update portas set usado_em = now() where id = v.id;
  perform set_config('aden.autor_id', user_id::text, true);
  perform set_config('aden.autor_email', coalesce(email, ''), true);
end;
$$;

-- quem está agindo pelo Claude nesta chamada (vazio se não veio código válido).
-- Só vale quando quem está logado é sócio da mesma Aden (o usuário do conector).
create or replace function public.conector_agente(out org_id uuid, out pessoa_id uuid, out user_id uuid, out email text, out nome text, out porta_id uuid)
language plpgsql stable security definer set search_path to 'public', 'extensions' as $$
declare v_codigo text;
begin
  v_codigo := nullif(current_setting('request.headers', true), '')::json ->> 'x-aden-conector';
  if v_codigo is null or length(v_codigo) < 20 then return; end if;
  select pt.org_id, p.id, m.user_id, m.email, p.nome, pt.id
    into org_id, pessoa_id, user_id, email, nome, porta_id
  from portas pt
  join membros m on m.id = pt.membro_id and m.ativo
  join pessoas p on p.membro_id = m.id and p.ativo
  where pt.hash = encode(digest(v_codigo, 'sha256'), 'hex') and pt.uso = 'conector' and pt.cancelado_em is null
    and eh_admin(pt.org_id)
  limit 1;
end;
$$;
revoke all on function public.conector_agente() from public, anon;
grant execute on function public.conector_agente() to authenticated;

-- o servidor do conector confere o código no começo de cada chamada; marca o uso (no máximo uma vez por hora)
create or replace function public.conector_quem() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare a record;
begin
  select * into a from conector_agente();
  if a.pessoa_id is null then return null; end if;
  update portas set usado_em = now() where id = a.porta_id and (usado_em is null or usado_em < now() - interval '1 hour');
  return jsonb_build_object('pessoaId', a.pessoa_id, 'nome', a.nome, 'userId', a.user_id);
end;
$$;
revoke all on function public.conector_quem() from public, anon;
grant execute on function public.conector_quem() to authenticated;

-- gera um código de conector para quem está logado; devolve o código uma única vez
create or replace function public.conector_gerar(p_org uuid) returns text
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_membro uuid; v_codigo text;
begin
  if not eh_admin(p_org) then raise exception 'Só os sócios geram código do Claude.'; end if;
  v_membro := meu_membro(p_org);
  if minha_pessoa(p_org) is null then raise exception 'Seu login não está ligado a um sócio (Configurações → Sócios).'; end if;
  v_codigo := 'aden_' || encode(gen_random_bytes(24), 'hex');
  insert into portas (org_id, membro_id, hash, inicio, uso)
  values (p_org, v_membro, encode(digest(v_codigo, 'sha256'), 'hex'), left(v_codigo, 11), 'conector');
  return v_codigo;
end;
$$;
revoke all on function public.conector_gerar(uuid) from public, anon;
grant execute on function public.conector_gerar(uuid) to authenticated;

-- quem dos sócios já usa o código do Claude (para saber quando dá para desligar o endereço antigo)
create or replace function public.conector_uso(p_org uuid) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select case when eh_admin(p_org) then coalesce(jsonb_agg(jsonb_build_object(
    'pessoaId', p.id, 'nome', p.nome,
    'temCodigo', exists (select 1 from portas pt where pt.membro_id = m.id and pt.uso = 'conector' and pt.cancelado_em is null),
    'ultimoUso', (select max(pt.usado_em) from portas pt where pt.membro_id = m.id and pt.uso = 'conector' and pt.cancelado_em is null)
  ) order by p.ordem, p.nome), '[]'::jsonb) end
  from pessoas p join membros m on m.id = p.membro_id and m.ativo
  where p.org_id = p_org and p.socio and p.ativo;
$$;
revoke all on function public.conector_uso(uuid) from public, anon;
grant execute on function public.conector_uso(uuid) to authenticated;

-- nome de quem está agindo, para gravar em textos ("Mônica" no site, "Mônica (pelo Claude)" pelo conector)
create or replace function public.quem_age(p_org uuid, out pessoa_id uuid, out nome text, out pelo_claude boolean)
language plpgsql stable security definer set search_path to 'public' as $$
declare a record;
begin
  select * into a from conector_agente();
  if a.pessoa_id is not null and a.org_id = p_org then
    pessoa_id := a.pessoa_id; nome := a.nome || ' (pelo Claude)'; pelo_claude := true;
    return;
  end if;
  pelo_claude := false;
  pessoa_id := minha_pessoa(p_org);
  select coalesce((select p.nome from pessoas p where p.id = pessoa_id), m.nome) into nome
  from membros m where m.org_id = p_org and m.user_id = auth.uid() limit 1;
end;
$$;
revoke all on function public.quem_age(uuid) from public, anon;
grant execute on function public.quem_age(uuid) to authenticated;

create or replace function public.carimbar() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := coalesce((select a.user_id from conector_agente() a), auth.uid(), nullif(current_setting('aden.autor_id', true), '')::uuid);
  return new;
end;
$$;

create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_org uuid;
  v_id text;
  v_antes jsonb;
  v_depois jsonb;
  a record;
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
  select * into a from conector_agente();
  insert into auditoria (org_id, tabela, registro_id, acao, antes, depois, autor_id, autor_email, pelo_claude)
  values (
    v_org, tg_table_name, v_id,
    case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'alterou' else 'removeu' end,
    v_antes, v_depois,
    coalesce(a.user_id, auth.uid(), nullif(current_setting('aden.autor_id', true), '')::uuid),
    coalesce(a.email, auth.jwt() ->> 'email', nullif(current_setting('aden.autor_email', true), '')),
    a.user_id is not null
  );
  return coalesce(new, old);
end;
$$;

-- pedido de alteração: quem pede é o dono do código (quando vem pelo Claude); a aprovação automática dele vale só
-- para a parte que afeta ele mesmo
create or replace function public.criar_pedido(p_org uuid, p_tipo text, p_descricao text, p_itens jsonb, p_afetados uuid[], p_impacto jsonb, p_dados jsonb, p_assinatura text, p_cliente uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_autor uuid; v_nome text; v_pendentes uuid[]; v_status text := 'pendente'; q record;
begin
  if not eh_admin(p_org) then
    raise exception 'Só sócios podem pedir alteração.';
  end if;
  select * into q from quem_age(p_org);
  v_autor := q.pessoa_id;
  v_nome := case when q.pelo_claude then q.nome else (select nome from membros where org_id = p_org and user_id = auth.uid() limit 1) end;
  insert into pedidos_alteracao (org_id, tipo, descricao, itens, dados, assinatura, cliente_id, afetados, impacto, autor_nome, autor_pessoa_id)
  values (p_org, p_tipo, p_descricao, coalesce(p_itens, '[]'), p_dados, p_assinatura, p_cliente, p_afetados, p_impacto, v_nome, v_autor)
  returning id into v_id;
  if v_autor is not null and v_autor = any(p_afetados) then
    insert into aprovacoes (org_id, pedido_id, pessoa_id, decisao, automatica) values (p_org, v_id, v_autor, 'aprovado', true);
  end if;
  v_pendentes := array(select unnest(p_afetados) except select v_autor where v_autor is not null);
  if coalesce(array_length(v_pendentes, 1), 0) = 0 then
    v_status := concluir_pedido(v_id);
  end if;
  return jsonb_build_object('pedido_id', v_id, 'status', v_status, 'aguardando', to_jsonb(v_pendentes));
end;
$$;

-- ─── 2. Memória de contexto do cliente ───────────────────────────────────────
create table if not exists contexto_cliente (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  tipo text not null check (tipo in ('decisao', 'preferencia', 'pendencia', 'nota')),
  texto text not null check (length(trim(texto)) > 0),
  autor_pessoa_id uuid references pessoas(id) on delete set null,
  autor_nome text,
  pelo_claude boolean not null default false,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por_nome text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index if not exists contexto_cliente_cliente on contexto_cliente (cliente_id, resolvido_em);
alter table contexto_cliente enable row level security;

drop policy if exists contexto_leitura on contexto_cliente;
create policy contexto_leitura on contexto_cliente for select using (eh_membro(org_id));
drop policy if exists contexto_insercao on contexto_cliente;
create policy contexto_insercao on contexto_cliente for insert with check (eh_membro(org_id));
drop policy if exists contexto_edicao on contexto_cliente;
create policy contexto_edicao on contexto_cliente for update using (eh_membro(org_id)) with check (eh_membro(org_id));
-- sem política de exclusão: anotação não se apaga, é marcada como resolvida

-- quem anotou e quem resolveu vêm do banco (nunca do que o app manda)
create or replace function public.contexto_autor() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare q record;
begin
  select * into q from quem_age(new.org_id);
  if tg_op = 'INSERT' then
    new.autor_pessoa_id := q.pessoa_id;
    new.autor_nome := q.nome;
    new.pelo_claude := coalesce(q.pelo_claude, false);
    new.criado_em := now();
    new.resolvido_por_nome := case when new.resolvido_em is not null then q.nome end;
  else
    new.org_id := old.org_id;
    new.cliente_id := old.cliente_id;
    new.autor_pessoa_id := old.autor_pessoa_id;
    new.autor_nome := old.autor_nome;
    new.pelo_claude := old.pelo_claude;
    new.criado_em := old.criado_em;
    if new.resolvido_em is not null and old.resolvido_em is null then
      new.resolvido_em := now();
      new.resolvido_por_nome := q.nome;
    elsif new.resolvido_em is null then
      new.resolvido_por_nome := null;
    else
      new.resolvido_em := old.resolvido_em;
      new.resolvido_por_nome := old.resolvido_por_nome;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists contexto_cliente_autor on contexto_cliente;
create trigger contexto_cliente_autor before insert or update on contexto_cliente for each row execute function contexto_autor();
drop trigger if exists contexto_cliente_carimbo on contexto_cliente;
create trigger contexto_cliente_carimbo before update on contexto_cliente for each row execute function carimbar();
drop trigger if exists contexto_cliente_auditoria on contexto_cliente;
create trigger contexto_cliente_auditoria after insert or update or delete on contexto_cliente for each row execute function auditar();
