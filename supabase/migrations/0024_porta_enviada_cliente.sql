-- Aden · porta: o campo de envio para o cliente se chama "enviadaClienteEm" (nome que o outro sistema procura; pedido de 30/09/2026).
-- Só renomeia o campo acrescentado na 0023 (enviadaEm → enviadaClienteEm); o resto fica igual.

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
      when t.status = 'revisao' then 'aguardando'
      when t.status = 'concluida' then 'entregue'
      when t.feedback_em is not null and (t.enviada_cliente_em is null or t.feedback_em > t.enviada_cliente_em) then 'ajuste'
      when t.status = 'a_fazer' and t.publicar_em is not null then 'planejado'
      else 'producao'
    end,
    'aprovadaEm', t.cliente_aprovou_em,
    'agendadaEm', t.agendada_em,
    'enviadaClienteEm', t.enviada_cliente_em
  );
$$;
