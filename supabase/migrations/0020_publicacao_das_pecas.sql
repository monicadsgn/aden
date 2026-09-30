-- Aden · Fase 3, passo 1: etapas de publicação das peças (planejado, agendada, publicada)
-- Decisão dos sócios (29/09/2026): a aprovação de conteúdo vem para o Aden, com as etapas de publicação.
-- Só acréscimo: duas datas na tarefa. O status da tarefa não muda (a reorganização de tarefas do ROADMAP, seção 2,
-- continua guardada). A etapa da peça é calculada (lib/calculo/tarefas.ts, situacaoPeca):
--   planejado = a fazer, com data para ir ao ar;  agendada = aprovada, com data;  publicada = foi ao ar.

alter table tarefas
  add column if not exists publicar_em timestamptz,
  add column if not exists publicada_em timestamptz;

-- o painel do cliente passa a mostrar quando a peça vai ao ar e quando foi (nada interno)
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
        'publicadaEm', t.publicada_em
      ) order by coalesce(t.enviada_cliente_em, t.criado_em) desc)
      from tarefas t
      where t.cliente_id = v_cli.id and t.visivel_cliente
        and (t.status <> 'concluida' or t.concluida_em > now() - interval '60 days' or t.cliente_aprovou_em > now() - interval '60 days')
    ), '[]'::jsonb)
  );
end;
$function$;
