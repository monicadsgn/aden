-- Aden · aprovação fora do painel (02/10/2026). Só acréscimo.
-- O cliente às vezes aprova fora do painel (ex.: no grupo do WhatsApp). O sócio registra isso aqui e a peça vai
-- direto para "agendada" (ou "aprovada", sem data), sem passar por "esperando aprovação" e sem avisar o cliente.
-- No painel do cliente aparece "Aprovado em [data] pelo grupo do WhatsApp".
-- A aprovação pelo painel (responder_peca) continua igual. A trava da 0034 continua valendo: pelo site e pela API
-- ninguém escreve cliente_aprovou_em direto; só esta função (sócio) e a do painel (cliente).

alter table tarefas
  add column if not exists aprovacao_fora_onde text,
  add column if not exists aprovacao_fora_por text;

comment on column tarefas.aprovacao_fora_onde is 'Onde o cliente aprovou fora do painel (ex.: grupo do WhatsApp). Vazio = aprovou pelo painel.';
comment on column tarefas.aprovacao_fora_por is 'Quem registrou a aprovação fora do painel; termina com (pelo Claude) quando veio do conector.';

-- origem só a função escreve; reenviar ao cliente (aprovação zerada) apaga a origem junto
create or replace function proteger_aprovacao_fora() returns trigger
language plpgsql as $$
begin
  if new.cliente_aprovou_em is null then
    new.aprovacao_fora_onde := null;
    new.aprovacao_fora_por := null;
    return new;
  end if;
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.aprovacao_fora_onde := null;
      new.aprovacao_fora_por := null;
    else
      new.aprovacao_fora_onde := old.aprovacao_fora_onde;
      new.aprovacao_fora_por := old.aprovacao_fora_por;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists tarefas_aprovacao_fora on tarefas;
create trigger tarefas_aprovacao_fora before insert or update on tarefas for each row execute function proteger_aprovacao_fora();

-- O sócio registra que o cliente aprovou fora do painel, uma ou várias peças de uma vez.
-- Cada peça volta com a etapa nova ou o motivo de não ter mudado (nada muda em silêncio).
create or replace function registrar_aprovacao_fora(p_tarefas uuid[], p_onde text, p_agendar boolean default true)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid;
  v tarefas;
  q record;
  v_onde text := nullif(btrim(coalesce(p_onde, '')), '');
  v_res jsonb := '[]'::jsonb;
  v_erro text;
begin
  if v_onde is null then raise exception 'Diga onde o cliente aprovou (ex.: grupo do WhatsApp).'; end if;
  if p_tarefas is null or cardinality(p_tarefas) = 0 then raise exception 'Nenhuma peça escolhida.'; end if;
  foreach v_id in array p_tarefas loop
    select * into v from tarefas where id = v_id;
    v_erro := case
      when not found or not eh_admin(v.org_id) then 'Peça não encontrada.'
      when v.cliente_id is null then 'Não é peça de cliente.'
      when v.publicada_em is not null then 'Já foi publicada.'
      when v.cliente_aprovou_em is not null then 'Já estava aprovada (' || coalesce(v.aprovacao_fora_onde, 'pelo painel') || ').'
      when v.status = 'concluida' then 'Tarefa já concluída.'
      when p_agendar and v.publicar_em is null then 'Sem data para ir ao ar: preencha quando vai ao ar antes de agendar.'
    end;
    if v_erro is not null then
      v_res := v_res || jsonb_build_object('id', v_id, 'titulo', v.titulo, 'mudou', false, 'motivo', v_erro);
      continue;
    end if;
    select * into q from quem_age(v.org_id);
    update tarefas set
      cliente_aprovou_em = now(),
      aprovacao_fora_onde = left(v_onde, 200),
      aprovacao_fora_por = q.nome,
      agendada_em = case when p_agendar then coalesce(agendada_em, now()) else agendada_em end
    where id = v.id
    returning * into v;
    v_res := v_res || jsonb_build_object('id', v.id, 'titulo', v.titulo, 'mudou', true,
      'etapa', case when v.agendada_em is not null then 'agendada' else 'aprovada' end);
  end loop;
  return v_res;
end;
$$;
revoke execute on function registrar_aprovacao_fora(uuid[], text, boolean) from public, anon;
grant execute on function registrar_aprovacao_fora(uuid[], text, boolean) to authenticated;

-- painel do cliente: igual à 0027, mais 'aprovadaOnde' (só o lugar; quem registrou não sai)
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
