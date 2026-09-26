-- Painel do cliente (26/09/2026): um link só do cliente para ver as peças e aprovar
-- ou pedir ajuste. O cliente não tem login: o link carrega um código longo e aleatório.
-- Ele só chega aos dados pelas duas funções abaixo, que devolvem apenas o que é da peça
-- (título, legenda, arquivos, prazo). Nada de horas, valores, sócios ou outras tarefas.

alter table clientes add column painel_token text unique;

alter table tarefas
  add column visivel_cliente boolean not null default false,
  add column legenda text,
  add column arquivos jsonb not null default '[]'::jsonb,
  add column enviada_cliente_em timestamptz,
  add column rodadas int not null default 0,
  add column feedback_cliente text,
  add column feedback_em timestamptz,
  add column cliente_aprovou_em timestamptz,
  -- histórico das respostas do cliente: [{ "decisao", "texto", "em" }]
  add column respostas_cliente jsonb not null default '[]'::jsonb;

-- arquivos das peças: leitura pelo endereço (o cliente vê a arte), escrita de sócio da org
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pecas', 'pecas', true, 10485760, array['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'application/pdf'])
on conflict (id) do nothing;
create policy "pecas: membro ve" on storage.objects for select to authenticated
  using (bucket_id = 'pecas' and public.eh_membro(((storage.foldername(name))[1])::uuid));
create policy "pecas: admin envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'pecas' and public.eh_admin(((storage.foldername(name))[1])::uuid));
create policy "pecas: admin apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'pecas' and public.eh_admin(((storage.foldername(name))[1])::uuid));

-- ─── O que o cliente vê ───────────────────────────────────────────────────────
create or replace function painel_cliente(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_cli clientes;
  v_k contratos;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  select * into v_cli from clientes where painel_token = p_token and ativo;
  if not found then return null; end if;
  select * into v_k from contratos where cliente_id = v_cli.id and status = 'ativo' limit 1;
  return jsonb_build_object(
    'cliente', v_cli.nome,
    'limiteRodadas', v_k.limite_rodadas,
    'prazoAprovacaoDias', v_k.prazo_aprovacao_dias,
    'pecas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'titulo', t.titulo,
        'legenda', t.legenda,
        'arquivos', t.arquivos,
        'status', t.status,
        'vencimento', t.vencimento,
        'enviadaEm', t.enviada_cliente_em,
        'rodadas', t.rodadas,
        'feedback', t.feedback_cliente,
        'feedbackEm', t.feedback_em,
        'aprovadaEm', t.cliente_aprovou_em,
        'respostas', t.respostas_cliente
      ) order by coalesce(t.enviada_cliente_em, t.criado_em) desc)
      from tarefas t
      where t.cliente_id = v_cli.id and t.visivel_cliente
        and (t.status <> 'concluida' or t.concluida_em > now() - interval '60 days' or t.cliente_aprovou_em > now() - interval '60 days')
    ), '[]'::jsonb)
  );
end;
$$;

-- ─── O cliente responde: aprova ou pede ajuste ────────────────────────────────
create or replace function responder_peca(p_token text, p_tarefa uuid, p_decisao text, p_texto text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cli clientes;
  v_t tarefas;
begin
  if p_decisao not in ('aprovar', 'ajustar') then raise exception 'Resposta inválida.'; end if;
  if p_token is null or length(p_token) < 32 then raise exception 'Link inválido.'; end if;
  select * into v_cli from clientes where painel_token = p_token and ativo;
  if not found then raise exception 'Link inválido.'; end if;
  select * into v_t from tarefas where id = p_tarefa and cliente_id = v_cli.id and visivel_cliente for update;
  if not found then raise exception 'Peça não encontrada.'; end if;
  if v_t.status <> 'revisao' then raise exception 'Esta peça não está esperando aprovação.'; end if;
  if v_t.cliente_aprovou_em is not null then raise exception 'Esta peça já foi aprovada.'; end if;
  if p_decisao = 'ajustar' and coalesce(btrim(p_texto), '') = '' then raise exception 'Conte o que precisa ajustar.'; end if;
  if p_decisao = 'aprovar' then
    update tarefas set cliente_aprovou_em = now(),
      respostas_cliente = respostas_cliente || jsonb_build_array(jsonb_build_object('decisao', 'aprovar', 'texto', left(coalesce(btrim(p_texto), ''), 4000), 'em', now()))
      where id = v_t.id;
  else
    update tarefas set status = 'em_producao', rodadas = rodadas + 1, feedback_cliente = left(btrim(p_texto), 4000), feedback_em = now(), cliente_aprovou_em = null,
      respostas_cliente = respostas_cliente || jsonb_build_array(jsonb_build_object('decisao', 'ajustar', 'texto', left(btrim(p_texto), 4000), 'em', now()))
      where id = v_t.id;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function painel_cliente(text) from public;
revoke execute on function responder_peca(text, uuid, text, text) from public;
grant execute on function painel_cliente(text) to anon, authenticated;
grant execute on function responder_peca(text, uuid, text, text) to anon, authenticated;
