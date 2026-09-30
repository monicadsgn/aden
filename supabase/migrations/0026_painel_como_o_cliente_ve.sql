-- Aden · painel do cliente: título e formato como o cliente vê (pedido da Moni, 30/09/2026).
-- Só acréscimo. Dentro do sistema nada muda; só o que sai pelo painel_cliente:
-- - título sem a etiqueta interna do começo ("[CLIENTE] - …") e sem o "Tráfego:" dos criativos;
-- - formato (tipo de entrega) pelo "como o cliente vê" do tipo, quando preenchido (ex.: "Post").
-- A regra do título espelha lib/calculo/painel.ts (tituloParaCliente): mudou lá, muda aqui.

alter table tipos_entrega add column if not exists nome_cliente text;

create or replace function public.titulo_para_cliente(p_titulo text) returns text
language sql immutable set search_path to 'public' as $$
  select case when x = '' then btrim(p_titulo) else upper(left(x, 1)) || substr(x, 2) end
  from (
    select btrim(regexp_replace(regexp_replace(coalesce(p_titulo, ''), '^\s*\[[^\]]*\]\s*[-–—:]?\s*', ''), '^\s*tr[aá]fego\s*:\s*', '', 'i')) as x
  ) s;
$$;

create or replace function public.painel_cliente(p_token text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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
        'titulo', titulo_para_cliente(t.titulo),
        'legenda', t.legenda,
        'arquivos', t.arquivos,
        'status', t.status,
        'vencimento', t.vencimento,
        'enviadaEm', t.enviada_cliente_em,
        'rodadas', t.rodadas,
        'feedback', t.feedback_cliente,
        'feedbackEm', t.feedback_em,
        'aprovadaEm', t.cliente_aprovou_em,
        'respostas', t.respostas_cliente,
        'publicarEm', t.publicar_em,
        'publicadaEm', t.publicada_em,
        'textoArte', t.texto_arte,
        'agendadaEm', t.agendada_em,
        'tipo', (select coalesce(nullif(btrim(te.nome_cliente), ''), te.nome) from tipos_entrega te where te.id = t.tipo_entrega_id)
      ) order by coalesce(t.enviada_cliente_em, t.criado_em) desc)
      from tarefas t
      where t.cliente_id = v_cli.id and t.visivel_cliente
        and (t.status <> 'concluida' or t.concluida_em > now() - interval '60 days' or t.cliente_aprovou_em > now() - interval '60 days')
    ), '[]'::jsonb)
  );
end;
$function$;
