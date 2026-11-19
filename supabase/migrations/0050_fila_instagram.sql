-- Aden · fila de publicação no Instagram (19/11/2026). Só acréscimo; nasce desligada.
--
-- Pedido da Moni: quando o cliente aprova a peça no painel, ela já fica agendada e sai sozinha no dia e hora de
-- "Vai ao ar em" (como no MLabs). Como funciona:
--   1. Cada cliente tem a chave "Agendar sozinho o que o cliente aprovar" (conexoes_meta.agendar_ativo, nasce false).
--   2. Com a chave ligada (e a conexão pronta e "Permitir publicar" ligado), aprovar a peça (pelo painel ou
--      registrada de fora) marca a peça como agendada e coloca na fila (publicacoes_meta). Só peça aprovada DEPOIS de
--      ligar a chave entra; o que já estava agendado à mão no Instagram nunca é publicado de novo.
--   3. A rota /api/meta/fila (chamada a cada 5 minutos, com o mesmo segredo CRON_SECRET do aviso diário) pega o que
--      já passou da hora, publica foto ou carrossel na ordem das artes e dá baixa na peça.
-- Peça sem hora (meia-noite exata) não sai sozinha; passou mais de 1 dia da hora, também não (fica visível).

alter table conexoes_meta add column if not exists agendar_ativo boolean not null default false;

create table if not exists publicacoes_meta (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  estado text not null default 'na_fila' check (estado in ('na_fila', 'publicando', 'publicada', 'falhou')),
  tentativas int not null default 0,
  erro text check (erro is null or length(erro) <= 500),
  post_id text,
  link text,
  tentou_em timestamptz,
  publicada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create unique index if not exists publicacoes_meta_uma_por_peca on publicacoes_meta (tarefa_id);
create index if not exists publicacoes_meta_org_estado on publicacoes_meta (org_id, estado);

alter table publicacoes_meta enable row level security;
drop policy if exists publicacoes_meta_leitura on publicacoes_meta;
create policy publicacoes_meta_leitura on publicacoes_meta for select using (eh_membro(org_id));
drop policy if exists publicacoes_meta_escrita on publicacoes_meta;
create policy publicacoes_meta_escrita on publicacoes_meta for all using (eh_admin(org_id)) with check (eh_admin(org_id));
drop trigger if exists publicacoes_meta_carimbo on publicacoes_meta;
create trigger publicacoes_meta_carimbo before update on publicacoes_meta for each row execute function carimbar();
drop trigger if exists publicacoes_meta_auditoria on publicacoes_meta;
create trigger publicacoes_meta_auditoria after insert or update or delete on publicacoes_meta for each row execute function auditar();

-- Aprovou (painel ou fora do painel) → agenda e entra na fila, se o cliente liberou.
create or replace function public.agendar_meta_ao_aprovar() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.cliente_aprovou_em is not null and old.cliente_aprovou_em is null
     and new.publicar_em is not null and new.publicada_em is null and new.cliente_id is not null
     and exists (
       select 1 from conexoes_meta c
       where c.cliente_id = new.cliente_id and c.agendar_ativo and c.publicar_ativo and c.status = 'conectado'
     ) then
    new.agendada_em := coalesce(new.agendada_em, now());
    insert into publicacoes_meta (org_id, tarefa_id, cliente_id)
    values (new.org_id, new.id, new.cliente_id)
    on conflict (tarefa_id) do update
      set estado = 'na_fila', tentativas = 0, erro = null
      where publicacoes_meta.estado in ('na_fila', 'falhou');
  end if;
  return new;
end;
$$;
drop trigger if exists tarefas_agendar_meta on tarefas;
create trigger tarefas_agendar_meta before update of cliente_aprovou_em on tarefas
  for each row execute function public.agendar_meta_ao_aprovar();

-- A rota pega o que está na hora (no máximo 5 por vez) e já marca "publicando", para ninguém publicar duas vezes.
-- p_contas: @ liberados na Vercel (vazio = qualquer conta).
create or replace function public.meta_fila_pegar(p_segredo text, p_contas text[] default '{}') returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_saida jsonb;
begin
  if not public.aviso_segredo_ok(p_segredo) then raise exception 'Sem permissão.'; end if;
  with pegar as (
    select p.id
    from publicacoes_meta p
    join tarefas t on t.id = p.tarefa_id
    join conexoes_meta c on c.cliente_id = p.cliente_id
    where (p.estado = 'na_fila' or (p.estado = 'falhou' and p.tentativas < 3 and p.tentou_em < now() - interval '10 minutes'))
      and c.agendar_ativo and c.publicar_ativo and c.status = 'conectado' and c.instagram_id is not null
      and (coalesce(array_length(p_contas, 1), 0) = 0 or lower(c.instagram_usuario) = any (p_contas))
      and t.agendada_em is not null and t.cliente_aprovou_em is not null and t.publicada_em is null
      and t.publicar_em is not null and t.publicar_em <= now() and t.publicar_em > now() - interval '1 day'
      and (t.publicar_em at time zone 'America/Sao_Paulo')::time <> time '00:00'
    order by t.publicar_em
    limit 5
    for update of p skip locked
  ), marcadas as (
    update publicacoes_meta p set estado = 'publicando', tentou_em = now()
    from pegar where p.id = pegar.id
    returning p.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'tarefaId', t.id, 'clienteId', t.cliente_id, 'titulo', t.titulo, 'legenda', t.legenda, 'arquivos', t.arquivos,
    'publicarEm', t.publicar_em, 'instagramId', c.instagram_id, 'instagramUsuario', c.instagram_usuario
  ) order by t.publicar_em), '[]'::jsonb)
  into v_saida
  from marcadas m
  join tarefas t on t.id = m.tarefa_id
  join conexoes_meta c on c.cliente_id = m.cliente_id;
  return v_saida;
end;
$$;

-- Resultado de cada tentativa. Deu certo: a peça fica publicada e a tarefa concluída. Deu errado: guarda o motivo;
-- "definitivo" (ex.: imagem que não serve) não tenta de novo sozinho.
create or replace function public.meta_fila_resultado(
  p_segredo text, p_tarefa uuid, p_ok boolean, p_post_id text, p_link text, p_erro text, p_definitivo boolean default false
) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.aviso_segredo_ok(p_segredo) then raise exception 'Sem permissão.'; end if;
  if p_ok then
    update publicacoes_meta set estado = 'publicada', post_id = left(p_post_id, 100), link = left(p_link, 500), erro = null, publicada_em = now()
      where tarefa_id = p_tarefa;
    update tarefas set publicada_em = now(), status = 'concluida', concluida_em = coalesce(concluida_em, now())
      where id = p_tarefa and publicada_em is null;
  else
    update publicacoes_meta
      set estado = 'falhou', tentativas = case when p_definitivo then 3 else tentativas + 1 end, erro = left(coalesce(p_erro, 'Não deu para publicar.'), 500)
      where tarefa_id = p_tarefa;
  end if;
end;
$$;

revoke execute on function public.meta_fila_pegar(text, text[]) from public;
revoke execute on function public.meta_fila_resultado(text, uuid, boolean, text, text, text, boolean) from public;
grant execute on function public.meta_fila_pegar(text, text[]) to anon, authenticated;
grant execute on function public.meta_fila_resultado(text, uuid, boolean, text, text, text, boolean) to anon, authenticated;
