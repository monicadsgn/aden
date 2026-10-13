-- Aden · aviso por e-mail ao cliente (decisão da Moni, 11/10/2026).
-- Um e-mail por cliente por dia, de manhã, SÓ se houve peça enviada para aprovar ou ajuste devolvido
-- desde o último aviso. Nada de "sem novidade".
-- Quem chama é a rota diária do site (sem usuário logado), então as duas funções abaixo conferem um segredo:
-- só a impressão digital (sha-256) dele fica aqui; o segredo de verdade fica na Vercel (CRON_SECRET).

alter table clientes
  add column aviso_email boolean not null default true,
  add column aviso_email_em timestamptz;

comment on column clientes.aviso_email is 'Liga/desliga o e-mail que avisa o cliente de peça nova ou ajuste pronto.';
comment on column clientes.aviso_email_em is 'Até que momento o cliente já foi avisado (só as peças enviadas depois disso entram no próximo e-mail).';

create or replace function public.aviso_segredo_ok(p_segredo text) returns boolean
language sql immutable as $$
  select coalesce(p_segredo, '') <> '' and encode(sha256(convert_to(p_segredo, 'utf8')), 'hex') = 'b5f4b3e6ecbbffa2afd1453028316b4e24899e24d84c8ca0872baabf0c4ab071';
$$;

-- Lista, por cliente, o que está esperando aviso. Peça nova = enviada para aprovar e nunca teve ajuste pedido.
-- Ajuste = o cliente já tinha pedido ajuste e a peça voltou para ele. Só clientes com link do painel, e-mail e aviso ligado.
create or replace function public.avisos_cliente_pendentes(p_segredo text) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_ate timestamptz := now();
  v_saida jsonb;
begin
  if not public.aviso_segredo_ok(p_segredo) then raise exception 'Sem permissão.'; end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_saida from (
    select jsonb_build_object(
      'clienteId', c.id, 'cliente', c.nome, 'contato', c.contato, 'email', c.email, 'token', c.painel_token,
      'ate', v_ate,
      'prazoAprovacaoDias', (select k.prazo_aprovacao_dias from contratos k where k.cliente_id = c.id and k.status = 'ativo' limit 1),
      'pecas', (
        select jsonb_agg(jsonb_build_object(
          'titulo', t.titulo,
          'formato', (select coalesce(nullif(btrim(te.nome_cliente), ''), te.nome) from tipos_entrega te where te.id = t.tipo_entrega_id),
          'dia', (t.publicar_em at time zone 'America/Sao_Paulo')::date,
          'ajuste', t.feedback_em is not null,
          'pedido', case when t.feedback_em is not null then t.feedback_cliente end
        ) order by t.publicar_em nulls last, t.criado_em)
        from tarefas t
        where t.cliente_id = c.id and t.visivel_cliente and t.status = 'revisao' and t.cliente_aprovou_em is null
          and t.enviada_cliente_em is not null and t.enviada_cliente_em <= v_ate
          and (c.aviso_email_em is null or t.enviada_cliente_em > c.aviso_email_em)
      )
    ) as x
    from clientes c
    where c.ativo and not c.interno and c.aviso_email and c.painel_token is not null and btrim(coalesce(c.email, '')) <> ''
  ) s where x -> 'pecas' is not null and x -> 'pecas' <> 'null'::jsonb;
  return v_saida;
end;
$$;

-- Depois de enviar, carimba até onde o cliente foi avisado (só anda para frente).
create or replace function public.avisos_cliente_marcar(p_segredo text, p_cliente uuid, p_ate timestamptz) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.aviso_segredo_ok(p_segredo) then raise exception 'Sem permissão.'; end if;
  update clientes set aviso_email_em = p_ate where id = p_cliente and (aviso_email_em is null or aviso_email_em < p_ate);
end;
$$;

revoke execute on function public.aviso_segredo_ok(text) from public;
revoke execute on function public.avisos_cliente_pendentes(text) from public;
revoke execute on function public.avisos_cliente_marcar(text, uuid, timestamptz) from public;
grant execute on function public.avisos_cliente_pendentes(text) to anon, authenticated;
grant execute on function public.avisos_cliente_marcar(text, uuid, timestamptz) to anon, authenticated;

-- Quem já existe começa "avisado até agora": o primeiro e-mail só fala do que for enviado a partir daqui.
update clientes set aviso_email_em = now();
