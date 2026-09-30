-- Aden · Fase 3: painel do cliente no formato de quadro (colunas que deslizam para o lado).
-- Só acréscimo:
-- - "texto da arte" na tarefa (o que vai escrito dentro da arte; o cliente lê antes da legenda). Antes ficava
--   misturado na descrição, que é interna.
-- - o painel passa a dizer o formato da peça (nome do tipo de entrega, ex.: Reels) e o texto da arte.
-- Nada interno: nem horas, nem valores, nem a descrição da tarefa.

-- - "agendada em": quando a equipe programou o post no Instagram. Aprovada sem isso = aprovada; com isso = agendada
--   (antes, qualquer aprovada com data virava agendada, e o cliente não via a diferença).

alter table tarefas add column if not exists texto_arte text;
alter table tarefas add column if not exists agendada_em timestamptz;

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
        'respostas', t.respostas_cliente,
        'publicarEm', t.publicar_em,
        'publicadaEm', t.publicada_em,
        'textoArte', t.texto_arte,
        'agendadaEm', t.agendada_em,
        'tipo', (select te.nome from tipos_entrega te where te.id = t.tipo_entrega_id)
      ) order by coalesce(t.enviada_cliente_em, t.criado_em) desc)
      from tarefas t
      where t.cliente_id = v_cli.id and t.visivel_cliente
        and (t.status <> 'concluida' or t.concluida_em > now() - interval '60 days' or t.cliente_aprovou_em > now() - interval '60 days')
    ), '[]'::jsonb)
  );
end;
$function$;
