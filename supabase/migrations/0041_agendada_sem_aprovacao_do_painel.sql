-- Aden · peça "agendada" também sem a aprovação do painel (11/10/2026). Só troca uma função; nenhuma tabela, coluna
-- ou dado muda, e o painel do cliente continua exatamente como está.
--
-- Por quê: "agendada" (tarefas.agendada_em) só valia depois de o cliente aprovar. Peça da própria Aden e de cliente
-- sem link do painel não tem esse passo, então marcar "agendada" não mudava nada. Na tela e no conector, a etapa agora
-- é calculada por situacaoPeca(tarefa, passaPelaAprovacao) em lib/calculo/tarefas.ts:
--   - cliente COM link do painel (e que não é a própria Aden): agendada = aprovada + agendada_em (como sempre);
--   - peça sem esse passo (interna, cliente sem link, sem cliente): agendada = agendada_em preenchido.
-- Esta função espelha a regra para a porta genérica (porta_ler / porta_salvar_tarefa), que devolve a etapa da peça.
--
-- NÃO mexe em painel_cliente nem em responder_peca: o cliente só lê pelas funções de sempre, o painel só lista peça
-- marcada "aparece no painel" (cliente com link) e a etapa dele continua exigindo a aprovação do cliente.

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
