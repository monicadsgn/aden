-- Aden · atalho "Cards de jogo" no painel do cliente (11/10/2026). Só acréscimo.
-- Pedido da Moni: botão novo no painel (hoje: StadiumPlay) que abre a pasta JOGOS do mês no Drive, sem trocar o
-- botão "Fotos", porque as fotos e motions da pasta também ajudam o cliente. Muda todo mês, junto com o planejamento.
-- Nada existente muda: coluna nova opcional (link https) e o painel_cliente devolve mais um campo em 'atalhos'.

alter table clientes add column if not exists painel_cards_jogo_url text;
do $$ begin
  alter table clientes add constraint clientes_painel_cards_jogo_https check (
    painel_cards_jogo_url is null or painel_cards_jogo_url ~ '^https://'
  );
exception when duplicate_object then null; end $$;

-- painel do cliente: igual à 0040, mais 'cardsJogoUrl' em 'atalhos'
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
        'tipo', (select coalesce(nullif(btrim(te.nome_cliente), ''), te.nome) from tipos_entrega te where te.id = t.tipo_entrega_id)
      ) order by coalesce(t.enviada_cliente_em, t.criado_em) desc)
      from tarefas t
      where t.cliente_id = v_cli.id and t.visivel_cliente
        and (t.status <> 'concluida' or t.concluida_em > now() - interval '60 days' or t.cliente_aprovou_em > now() - interval '60 days')
    ), '[]'::jsonb)
  );
end;
$function$;
