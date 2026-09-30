-- Aden · Fase 3, passo 2: porta genérica com código pessoal (exceção aprovada em 29/09/2026).
-- Um sócio gera o próprio código e entrega a outro sistema, que usa a porta para ver e mexer nas tarefas desse sócio.
-- O Aden não sabe quem está do outro lado: não guarda nome, endereço nem nada do outro sistema.
--
-- - O código aparece uma vez só, na hora de gerar; aqui fica só o hash (sha-256) e o começo, para reconhecer.
-- - Só o dono vê e cancela os próprios códigos.
-- - Tudo o que chega pela porta fica no Histórico em nome do dono do código (carimbar/auditar leem "aden.autor_*").
-- - A porta só mexe nas tarefas em que o dono é o responsável; lê nomes de clientes e tipos de entrega, nada de valores.
-- - O relógio da tarefa segue a mesma regra do site (lib/calculo/tarefas.ts, espelhada em lib/calculo/porta.ts).

-- ─── Autor vindo da porta (quando não há login) ──────────────────────────────
create or replace function public.carimbar() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := coalesce(auth.uid(), nullif(current_setting('aden.autor_id', true), '')::uuid);
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
    v_antes, v_depois,
    coalesce(auth.uid(), nullif(current_setting('aden.autor_id', true), '')::uuid),
    coalesce(auth.jwt() ->> 'email', nullif(current_setting('aden.autor_email', true), ''))
  );
  return coalesce(new, old);
end;
$$;

-- ─── Códigos ─────────────────────────────────────────────────────────────────
create table if not exists portas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  membro_id uuid not null references membros(id) on delete cascade,
  hash text not null unique,
  inicio text not null,
  criado_em timestamptz not null default now(),
  usado_em timestamptz,
  cancelado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table portas enable row level security;
drop trigger if exists portas_carimbo on portas;
create trigger portas_carimbo before update on portas for each row execute function carimbar();
drop trigger if exists portas_auditoria on portas;
create trigger portas_auditoria after insert or update or delete on portas for each row execute function auditar();

drop policy if exists portas_dono on portas;
create policy portas_dono on portas for select using (membro_id = meu_membro(org_id));

-- gera um código novo para quem está logado; devolve o código uma única vez
create or replace function public.porta_gerar(p_org uuid) returns text
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_membro uuid; v_codigo text;
begin
  v_membro := meu_membro(p_org);
  if v_membro is null then raise exception 'Só quem é da Aden gera código.'; end if;
  if minha_pessoa(p_org) is null then raise exception 'Seu login não está ligado a um sócio (Configurações → Sócios).'; end if;
  v_codigo := 'aden_' || encode(gen_random_bytes(24), 'hex');
  insert into portas (org_id, membro_id, hash, inicio)
  values (p_org, v_membro, encode(digest(v_codigo, 'sha256'), 'hex'), left(v_codigo, 11));
  return v_codigo;
end;
$$;

create or replace function public.porta_cancelar(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  update portas set cancelado_em = now()
  where id = p_id and cancelado_em is null and membro_id = meu_membro(org_id);
  if not found then raise exception 'Código não encontrado.'; end if;
end;
$$;

-- quem é o dono do código (e marca o uso). Interna: não é chamada de fora.
create or replace function public.porta_dono(p_codigo text, out org_id uuid, out pessoa_id uuid, out user_id uuid, out email text)
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v portas;
begin
  if p_codigo is null or length(p_codigo) < 20 then raise exception 'Código inválido.'; end if;
  select * into v from portas where hash = encode(digest(p_codigo, 'sha256'), 'hex') and cancelado_em is null;
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

-- ─── O que a porta faz ───────────────────────────────────────────────────────
create or replace function public.porta_tarefa_json(t tarefas) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'id', t.id, 'titulo', t.titulo, 'status', t.status,
    'cliente', (select nome from clientes where id = t.cliente_id),
    'entrega', (select nome from tipos_entrega where id = t.tipo_entrega_id),
    'quantidade', t.quantidade, 'prioridade', t.prioridade,
    'inicio', t.inicio, 'vencimento', t.vencimento, 'descricao', t.descricao, 'checklist', t.etapas,
    'legenda', t.legenda, 'publicarEm', t.publicar_em, 'publicadaEm', t.publicada_em,
    'criadaEm', t.criado_em, 'concluidaEm', t.concluida_em
  );
$$;

create or replace function public.porta_ler(p_codigo text, p_concluidas boolean default false) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare d record;
begin
  select * into d from porta_dono(p_codigo);
  return jsonb_build_object(
    'pessoa', (select nome from pessoas where id = d.pessoa_id),
    'tarefas', coalesce((
      select jsonb_agg(porta_tarefa_json(t) order by t.vencimento nulls last, t.criado_em)
      from tarefas t
      where t.org_id = d.org_id and t.responsavel_id = d.pessoa_id
        and (p_concluidas or t.status <> 'concluida')
    ), '[]'::jsonb),
    'clientes', coalesce((select jsonb_agg(nome order by nome) from clientes where org_id = d.org_id and ativo), '[]'::jsonb),
    'entregas', coalesce((select jsonb_agg(nome order by nome) from tipos_entrega where org_id = d.org_id and ativo), '[]'::jsonb)
  );
end;
$$;

-- cria (sem id) ou edita (com id) uma tarefa do dono. Só os campos enviados mudam.
create or replace function public.porta_salvar_tarefa(p_codigo text, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare d record; v tarefas; v_cli uuid; v_tipo uuid; v_id uuid;
begin
  select * into d from porta_dono(p_codigo);
  if p_dados ? 'cliente' and nullif(p_dados ->> 'cliente', '') is not null then
    select id into v_cli from clientes where org_id = d.org_id and (id::text = p_dados ->> 'cliente' or lower(nome) = lower(p_dados ->> 'cliente')) limit 1;
    if v_cli is null then raise exception 'Cliente não encontrado: %', p_dados ->> 'cliente'; end if;
  end if;
  if p_dados ? 'entrega' and nullif(p_dados ->> 'entrega', '') is not null then
    select id into v_tipo from tipos_entrega where org_id = d.org_id and (id::text = p_dados ->> 'entrega' or lower(nome) = lower(p_dados ->> 'entrega')) limit 1;
    if v_tipo is null then raise exception 'Tipo de entrega não encontrado: %', p_dados ->> 'entrega'; end if;
  end if;

  if nullif(p_dados ->> 'id', '') is null then
    if nullif(trim(p_dados ->> 'titulo'), '') is null then raise exception 'Informe o título.'; end if;
    insert into tarefas (org_id, titulo, responsavel_id, status, quantidade, etapas, criado_em)
    values (d.org_id, trim(p_dados ->> 'titulo'), d.pessoa_id, 'a_fazer', 1, '[]'::jsonb, now())
    returning id into v_id;
  else
    select id into v_id from tarefas where id::text = p_dados ->> 'id' and org_id = d.org_id and responsavel_id = d.pessoa_id;
    if v_id is null then raise exception 'Tarefa não encontrada.'; end if;
  end if;

  update tarefas set
    titulo = coalesce(nullif(trim(p_dados ->> 'titulo'), ''), titulo),
    cliente_id = case when p_dados ? 'cliente' then v_cli else cliente_id end,
    tipo_entrega_id = case when p_dados ? 'entrega' then v_tipo else tipo_entrega_id end,
    quantidade = case when p_dados ? 'quantidade' then greatest(1, (p_dados ->> 'quantidade')::int) else quantidade end,
    prioridade = case when p_dados ? 'prioridade' then nullif(p_dados ->> 'prioridade', '') else prioridade end,
    inicio = case when p_dados ? 'inicio' then nullif(p_dados ->> 'inicio', '')::date else inicio end,
    vencimento = case when p_dados ? 'vencimento' then nullif(p_dados ->> 'vencimento', '')::date else vencimento end,
    descricao = case when p_dados ? 'descricao' then nullif(p_dados ->> 'descricao', '') else descricao end,
    etapas = case when p_dados ? 'checklist' then (
      select coalesce(jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'titulo', e ->> 'titulo', 'feita', coalesce((e ->> 'feita')::boolean, false))), '[]'::jsonb)
      from jsonb_array_elements(p_dados -> 'checklist') e
    ) else etapas end,
    legenda = case when p_dados ? 'legenda' then nullif(p_dados ->> 'legenda', '') else legenda end,
    publicar_em = case when p_dados ? 'publicarEm' then nullif(p_dados ->> 'publicarEm', '')::timestamptz else publicar_em end
  where id = v_id
  returning * into v;
  return porta_tarefa_json(v);
end;
$$;

-- muda o status (a_fazer, em_producao, concluida) ou marca como publicada; o relógio segue a regra do site
create or replace function public.porta_status(p_codigo text, p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare d record; v tarefas; m medicoes; v_publicada boolean;
begin
  select * into d from porta_dono(p_codigo);
  if p_status not in ('a_fazer', 'em_producao', 'concluida', 'publicada', 'nao_publicada') then
    raise exception 'Status inválido: %', p_status;
  end if;
  select * into v from tarefas where id = p_id and org_id = d.org_id and responsavel_id = d.pessoa_id;
  if not found then raise exception 'Tarefa não encontrada.'; end if;
  v_publicada := case p_status when 'publicada' then true when 'nao_publicada' then false else null end;
  if v_publicada is not null then p_status := case when v_publicada then 'concluida' else 'em_producao' end; end if;

  update tarefas set
    status = p_status,
    concluida_em = case when p_status = 'concluida' then coalesce(concluida_em, now()) else null end,
    publicada_em = case when v_publicada is true then now() when v_publicada is false then null else publicada_em end
  where id = v.id
  returning * into v;

  select * into m from medicoes where tarefa_id = v.id limit 1;
  if found then
    if p_status = 'concluida' then
      update medicoes set
        acumulado_segundos = acumulado_segundos + case when estado = 'rodando' and retomado_em is not null then extract(epoch from now() - retomado_em) else 0 end,
        estado = 'concluido', retomado_em = null, fim = coalesce(fim, now()), unidades = greatest(1, v.quantidade)
      where id = m.id and estado <> 'concluido';
    elsif m.estado = 'concluido' then
      update medicoes set estado = 'pausado', fim = null where id = m.id;
    end if;
  end if;
  return porta_tarefa_json(v);
end;
$$;

-- quem chama o quê
revoke execute on function public.porta_dono(text) from public, anon, authenticated;
revoke execute on function public.porta_tarefa_json(tarefas) from public, anon, authenticated;
revoke execute on function public.porta_gerar(uuid) from public, anon;
revoke execute on function public.porta_cancelar(uuid) from public, anon;
grant execute on function public.porta_gerar(uuid) to authenticated;
grant execute on function public.porta_cancelar(uuid) to authenticated;
revoke execute on function public.porta_ler(text, boolean) from public;
revoke execute on function public.porta_salvar_tarefa(text, jsonb) from public;
revoke execute on function public.porta_status(text, uuid, text) from public;
grant execute on function public.porta_ler(text, boolean) to anon, authenticated;
grant execute on function public.porta_salvar_tarefa(text, jsonb) to anon, authenticated;
grant execute on function public.porta_status(text, uuid, text) to anon, authenticated;
