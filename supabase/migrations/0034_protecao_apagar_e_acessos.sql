-- Aden · auditoria de 30/09/2026, graves G8, G9 e G10 (aprovados pela Moni em 01/10/2026).
-- Só acréscimo de travas: nenhum dado muda.
--
-- G8: a proteção dos sócios barrava MUDAR piso, % e tempo, mas APAGAR passava (e recriar trocava o número sem
--     aprovação). Agora: sócio não se apaga nem sai de sócio/ativo; serviço com divisão de horas, divisão
--     preenchida, tipo de entrega com tempo e a configuração da empresa não se apagam. O caminho é desativar
--     (o número continua guardado). As funções de aprovação (aden.aplicando) continuam passando.
-- G9: o contador lia a linha inteira de clientes (link do painel, CPF, endereço) e da configuração (% da sociedade,
--     virada, bônus, oferta). Agora lê só o financeiro, pela função contador_config().
-- G10: equipe e freelancer (e o site) não escrevem as respostas do cliente. Só as funções do banco (painel) escrevem;
--     o site só pode zerar o "aprovou" ao reenviar a peça.

-- ─── G8 · apagar o que é protegido ──────────────────────────────────────────
create or replace function impedir_apagar_protegido() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('aden.aplicando', true), '') = 'sim' then
    return old;
  end if;
  if tg_table_name = 'pessoas' and old.socio then
    raise exception 'Sócio não se apaga: muda a divisão entre os sócios. Fale com o outro sócio.' using errcode = 'P0001';
  elsif tg_table_name = 'tipos_entrega' and old.horas_por_unidade is not null then
    raise exception 'O tipo de entrega "%" tem tempo cadastrado (campo protegido): desative em vez de apagar.', old.nome using errcode = 'P0001';
  elsif tg_table_name = 'servicos' and exists (
    select 1 from servico_divisao d where d.servico_id = old.id and coalesce(d.percentual, 0) > 0
  ) then
    raise exception 'O serviço "%" tem divisão de horas entre os sócios (campo protegido): desative em vez de apagar.', old.nome using errcode = 'P0001';
  elsif tg_table_name = 'servico_divisao' and coalesce(old.percentual, 0) > 0 then
    raise exception 'A divisão de horas é protegida: mude o percentual (vira pedido) em vez de apagar.' using errcode = 'P0001';
  elsif tg_table_name = 'configuracoes_empresa' then
    raise exception 'A configuração da empresa não se apaga.' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists pessoas_nao_apaga on pessoas;
create trigger pessoas_nao_apaga before delete on pessoas for each row execute function impedir_apagar_protegido();
drop trigger if exists tipos_entrega_nao_apaga on tipos_entrega;
create trigger tipos_entrega_nao_apaga before delete on tipos_entrega for each row execute function impedir_apagar_protegido();
drop trigger if exists servicos_nao_apaga on servicos;
create trigger servicos_nao_apaga before delete on servicos for each row execute function impedir_apagar_protegido();
drop trigger if exists servico_divisao_nao_apaga on servico_divisao;
create trigger servico_divisao_nao_apaga before delete on servico_divisao for each row execute function impedir_apagar_protegido();
drop trigger if exists configuracoes_empresa_nao_apaga on configuracoes_empresa;
create trigger configuracoes_empresa_nao_apaga before delete on configuracoes_empresa for each row execute function impedir_apagar_protegido();

-- sócio também não deixa de ser sócio nem é desativado por update direto
create or replace function proteger_socio() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('aden.aplicando', true), '') = 'sim' then
    return new;
  end if;
  if old.socio and (new.socio is distinct from old.socio or new.ativo is distinct from old.ativo) then
    raise exception 'Tirar alguém da sociedade (ou desativar um sócio) muda a divisão: precisa dos dois sócios.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists pessoas_socio_protegido on pessoas;
create trigger pessoas_socio_protegido before update on pessoas for each row execute function proteger_socio();

-- ─── G9 · contador lê só o financeiro ───────────────────────────────────────
drop policy if exists clientes_contador on clientes;
drop policy if exists configuracoes_empresa_contador on configuracoes_empresa;

create or replace function contador_config(org uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not eh_financeiro(org) then
    raise exception 'Sem acesso.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'empresa', (
      select jsonb_build_object(
        'regime', e.regime,
        'imposto_pct', e.imposto_pct,
        'imposto_fixo_mensal_centavos', e.imposto_fixo_mensal_centavos,
        'taxa_recebimento_pct', e.taxa_recebimento_pct,
        'taxa_recebimento_fixa_centavos', e.taxa_recebimento_fixa_centavos,
        'teto_faturamento_anual_centavos', e.teto_faturamento_anual_centavos,
        'aviso_teto_pct', e.aviso_teto_pct
      )
      from configuracoes_empresa e where e.org_id = org
    ),
    'clientes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'nome', c.nome,
        'interno', c.interno,
        'ativo', c.ativo,
        'valor_mensal_centavos', (select k.valor_mensal_centavos from contratos k where k.cliente_id = c.id and k.status = 'ativo' limit 1)
      ) order by c.nome)
      from clientes c where c.org_id = org
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function contador_config(uuid) from public, anon;
grant execute on function contador_config(uuid) to authenticated;

-- ─── G10 · respostas do cliente só o banco escreve ──────────────────────────
-- Pelo site e pela API (papéis authenticated/anon) ninguém escreve aprovação, ajuste, rodadas nem histórico de
-- respostas. As funções security definer (responder_peca) rodam como dono e passam. Reenviar a peça pode zerar
-- o "aprovou".
create or replace function proteger_respostas_cliente() returns trigger
language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.cliente_aprovou_em is not null or new.feedback_cliente is not null or coalesce(new.rodadas, 0) > 0
       or coalesce(jsonb_array_length(new.respostas_cliente), 0) > 0 then
      raise exception 'As respostas do cliente só chegam pelo painel dele.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.respostas_cliente is distinct from old.respostas_cliente
     or new.rodadas is distinct from old.rodadas
     or new.feedback_cliente is distinct from old.feedback_cliente
     or new.feedback_em is distinct from old.feedback_em
     or (new.cliente_aprovou_em is not null and new.cliente_aprovou_em is distinct from old.cliente_aprovou_em) then
    raise exception 'As respostas do cliente só chegam pelo painel dele.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists tarefas_respostas_cliente on tarefas;
create trigger tarefas_respostas_cliente before insert or update on tarefas for each row execute function proteger_respostas_cliente();
