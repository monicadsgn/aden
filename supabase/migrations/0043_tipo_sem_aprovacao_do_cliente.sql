-- Aden · tipo de entrega "sem aprovação do cliente" (11/10/2026). Só acréscimo.
-- Pedido da Moni: Card de jogo sai no dia, não espera o cliente aprovar. Coluna nova (padrão false) no tipo de
-- entrega; peça desse tipo marcada como agendada já conta como agendada. painel_cliente devolve 'semAprovacao'
-- por peça (igual à 0042 + um campo) e porta_tarefa_json espelha a regra (igual à 0041 + um caso).

alter table tipos_entrega add column if not exists sem_aprovacao_cliente boolean not null default false;

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
    'atalhos', jsonb_build_object(
      'planejamentoUrl', v_cli.painel_planejamento_url,
      'planejamentoRotulo', v_cli.painel_planejamento_rotulo,
      'fotosUrl', v_cli.painel_fotos_url,
      'cardsJogoUrl', v_cli.painel_cards_jogo_url,
      'identidadeUrl', v_cli.painel_identidade_url,
      'inclusoTexto', v_cli.painel_incluso
    ),
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
        'aprovadaOnde', t.aprovacao_fora_onde,
        'respostas', t.respostas_cliente,
        'publicarEm', t.publicar_em,
        'publicadaEm', t.publicada_em,
        'textoArte', t.texto_arte,
        'agendadaEm', t.agendada_em,
        'semAprovacao', coalesce((select te.sem_aprovacao_cliente from tipos_entrega te where te.id = t.tipo_entrega_id), false),
        'tipo', (select coalesce(nullif(btrim(te.nome_cliente), ''), te.nome) from tipos_entrega te where te.id = t.tipo_entrega_id)
      ) order by coalesce(t.enviada_cliente_em, t.criado_em) desc)
      from tarefas t
      where t.cliente_id = v_cli.id and t.visivel_cliente
        and (t.status <> 'concluida' or t.concluida_em > now() - interval '60 days' or t.cliente_aprovou_em > now() - interval '60 days')
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.porta_tarefa_json(t tarefas) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'id', t.id, 'titulo', t.titulo, 'status', t.status,
    'cliente', (select nome from clientes where id = t.cliente_id),
    'entrega', (select nome from tipos_entrega where id = t.tipo_entrega_id),
    'quantidade', t.quantidade, 'prioridade', t.prioridade,
    'inicio', t.inicio, 'vencimento', t.vencimento, 'descricao', t.descricao, 'checklist', t.etapas,
    'legenda', t.legenda, 'publicarEm', t.publicar_em, 'publicadaEm', t.publicada_em,
    'criadaEm', t.criado_em, 'concluidaEm', t.concluida_em,
    'etapa', case
      when t.publicada_em is not null then 'publicada'
      when t.cliente_aprovou_em is not null then case when t.agendada_em is not null then 'agendada' else 'aprovada' end
      -- sem o passo de aprovação pelo painel (peça interna, cliente sem link ou sem cliente): marcou, está agendada
      when t.agendada_em is not null and not exists (
        select 1 from clientes c where c.id = t.cliente_id and not c.interno and c.painel_token is not null
      ) then 'agendada'
      -- tipo marcado "sem aprovação do cliente" (ex.: Card de jogo): marcou, está agendada
      when t.agendada_em is not null and exists (
        select 1 from tipos_entrega te where te.id = t.tipo_entrega_id and te.sem_aprovacao_cliente
      ) then 'agendada'
      when t.status = 'revisao' then 'aguardando'
      when t.status = 'concluida' then 'entregue'
      when t.feedback_em is not null and (t.enviada_cliente_em is null or t.feedback_em > t.enviada_cliente_em) then 'ajuste'
      when t.status = 'a_fazer' and t.publicar_em is not null then 'planejado'
      else 'producao'
    end,
    'aprovadaEm', t.cliente_aprovou_em,
    'agendadaEm', t.agendada_em,
    'enviadaClienteEm', t.enviada_cliente_em,
    'rede', t.rede,
    'lote', t.lote
  );
$$;
