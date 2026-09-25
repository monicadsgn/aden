-- ════════════════════════════════════════════════════════════════════════════
-- Aden: segunda leva
--   • regime, ordem de distribuição e calibragem na configuração
--   • horas em minutos (mais casas decimais)
--   • cronômetro (medições) e pagamentos
--   • proteção da remuneração dos sócios: pedidos de alteração e aprovações
--   • avisos para os sócios
--   • perfil "contador" preparado (só leitura do financeiro)
--   • histórico que não se apaga
-- Rode inteiro, numa query nova, depois da 0003.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Configuração da empresa ────────────────────────────────────────────────
alter table configuracoes_empresa
  add column regime text check (regime in ('mei', 'outro')),
  add column ordem_distribuicao text check (ordem_distribuicao in ('custo_primeiro', 'proporcional')),
  -- 5 medições: número pedido pela Moni (25/09/2026), editável na tela
  add column medicoes_calibragem int default 5 check (medicoes_calibragem is null or medicoes_calibragem > 0),
  add column diferenca_sugerir_pct numeric(7,4);
update configuracoes_empresa set medicoes_calibragem = 5 where medicoes_calibragem is null;

-- ─── Horas em minutos: mais casas para 20 min = 0,333333 h ──────────────────
alter table tipos_entrega alter column horas_por_unidade type numeric(12,6);
alter table horas_realizadas alter column horas type numeric(12,6);
-- 0,33 h vira 20 min exatos; 0,67 h vira 40 min (arredonda para o minuto)
update tipos_entrega set horas_por_unidade = round(horas_por_unidade * 60) / 60.0
  where horas_por_unidade is not null and horas_por_unidade * 60 <> round(horas_por_unidade * 60);
alter table tipos_entrega add column calibrar_desde timestamptz;

-- ─── Perfis: contador (só leitura do financeiro) ────────────────────────────
alter table membros drop constraint membros_papel_check;
alter table membros add constraint membros_papel_check
  check (papel in ('admin', 'contador', 'colaborador', 'freelancer', 'cliente'));

create or replace function eh_financeiro(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membros m
    where m.org_id = org and m.user_id = auth.uid() and m.ativo and m.papel in ('admin', 'contador')
  );
$$;

-- pessoa (sócio) ligada ao login de quem está chamando
create or replace function minha_pessoa(org uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select p.id from pessoas p join membros m on m.id = p.membro_id
  where m.org_id = org and m.user_id = auth.uid() and m.ativo
  limit 1;
$$;

-- ─── Cronômetro ─────────────────────────────────────────────────────────────
create table medicoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  tipo_entrega_id uuid not null references tipos_entrega(id) on delete cascade,
  pessoa_id uuid references pessoas(id) on delete set null,
  estado text not null check (estado in ('rodando', 'pausado', 'concluido')),
  acumulado_segundos numeric(12,2) not null default 0,
  retomado_em timestamptz,
  fim timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index medicoes_tipo on medicoes (org_id, tipo_entrega_id);

-- ─── Pagamentos (cada um que cai; vários por mês) ───────────────────────────
create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  competencia date not null,                 -- mês de referência (dia 1)
  valor_centavos bigint not null check (valor_centavos > 0),
  recebido_em date not null,
  observacao text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index pagamentos_mes on pagamentos (org_id, competencia);

-- ─── Pedidos de alteração e aprovações ──────────────────────────────────────
create table pedidos_alteracao (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  -- campos: mudança em campo protegido. excecao: escopo/proposta abaixo do piso
  tipo text not null check (tipo in ('campos', 'excecao')),
  descricao text not null,
  itens jsonb not null default '[]',
  dados jsonb,                               -- exceção: cenário, cliente, perda por sócio
  assinatura text,                           -- exceção: conteúdo exato que foi aprovado
  cliente_id uuid references clientes(id) on delete set null,
  afetados uuid[] not null,
  impacto jsonb,                             -- pessoa → quanto muda no bolso por mês (centavos)
  status text not null default 'pendente' check (status in ('pendente', 'aplicado', 'recusado', 'cancelado')),
  motivo text,
  autor_id uuid default auth.uid(),
  autor_nome text,
  autor_pessoa_id uuid references pessoas(id) on delete set null,
  criado_em timestamptz not null default now(),
  decidido_em timestamptz
);
create index pedidos_org on pedidos_alteracao (org_id, criado_em desc);

create table aprovacoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  pedido_id uuid not null references pedidos_alteracao(id) on delete cascade,
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  decisao text not null check (decisao in ('aprovado', 'recusado')),
  automatica boolean not null default false, -- quem pediu é o próprio afetado
  por uuid default auth.uid(),
  em timestamptz not null default now(),
  unique (pedido_id, pessoa_id)
);

-- ─── Avisos para os sócios ──────────────────────────────────────────────────
create table avisos_socios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  titulo text not null,
  texto text not null,
  antes jsonb,
  depois jsonb,
  impacto_centavos bigint,                   -- quanto muda no bolso por mês
  autor_nome text,
  pedido_id uuid references pedidos_alteracao(id) on delete set null,
  criado_em timestamptz not null default now(),
  lido_em timestamptz
);
create index avisos_pessoa on avisos_socios (org_id, pessoa_id, criado_em desc);

-- ─── Carimbo, auditoria e RLS ───────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['medicoes', 'pagamentos'] loop
    execute format('create trigger %I before update on %I for each row execute function carimbar()', t || '_carimbo', t);
  end loop;
  foreach t in array array['medicoes', 'pagamentos', 'pedidos_alteracao', 'aprovacoes', 'avisos_socios'] loop
    execute format('create trigger %I after insert or update or delete on %I for each row execute function auditar()', t || '_auditoria', t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (eh_membro(org_id))', t || '_leitura', t);
  end loop;
  -- escrita normal (sócios) em medições e pagamentos
  foreach t in array array['medicoes', 'pagamentos'] loop
    execute format('create policy %I on %I for insert with check (eh_admin(org_id))', t || '_insercao', t);
    execute format('create policy %I on %I for update using (eh_admin(org_id)) with check (eh_admin(org_id))', t || '_edicao', t);
    execute format('create policy %I on %I for delete using (eh_admin(org_id))', t || '_remocao', t);
  end loop;
end $$;

-- avisos: sócio cria e marca como lido; ninguém apaga
create policy avisos_socios_insercao on avisos_socios for insert with check (eh_admin(org_id));
create policy avisos_socios_edicao on avisos_socios for update using (eh_admin(org_id)) with check (eh_admin(org_id));
-- pedidos e aprovações: só pelas funções abaixo (sem política de escrita)

-- contador: só leitura do financeiro (nunca piso, horas, divisão nem negociação)
create policy pagamentos_contador on pagamentos for select using (eh_financeiro(org_id));
create policy clientes_contador on clientes for select using (eh_financeiro(org_id));
create policy custos_fixos_contador on custos_fixos for select using (eh_financeiro(org_id));
create policy configuracoes_empresa_contador on configuracoes_empresa for select using (eh_financeiro(org_id));

-- ─── Histórico que não se apaga ─────────────────────────────────────────────
create or replace function impedir_mudanca() returns trigger
language plpgsql as $$
begin
  raise exception 'Este registro faz parte do histórico e não pode ser alterado nem apagado.';
end;
$$;
create trigger auditoria_imutavel before update or delete on auditoria for each row execute function impedir_mudanca();
create trigger aprovacoes_imutavel before update or delete on aprovacoes for each row execute function impedir_mudanca();

-- ─── Campos protegidos ──────────────────────────────────────────────────────
-- Mudar valor que já existia só passa pela função de aprovação (que liga 'aden.aplicando').
-- Preencher campo vazio passa direto.
create or replace function proteger_campos() returns trigger
language plpgsql as $$
declare c text; v_antes jsonb; v_depois jsonb;
begin
  if coalesce(current_setting('aden.aplicando', true), '') = 'sim' then
    return new;
  end if;
  foreach c in array tg_argv loop
    v_antes := to_jsonb(old) -> c;
    v_depois := to_jsonb(new) -> c;
    if v_antes is not null and v_antes <> 'null'::jsonb and v_antes is distinct from v_depois then
      raise exception 'O campo "%" é protegido: a mudança precisa da aprovação do sócio afetado.', c
        using errcode = 'P0001';
    end if;
  end loop;
  return new;
end;
$$;

create trigger pessoas_protegido before update on pessoas
  for each row execute function proteger_campos('piso_hora_centavos', 'percentual_padrao', 'membro_id');
create trigger servico_divisao_protegido before update on servico_divisao
  for each row execute function proteger_campos('percentual');
create trigger tipos_entrega_protegido before update on tipos_entrega
  for each row execute function proteger_campos('horas_por_unidade');

-- quem é afetado por um item (mesma regra de lib/regras/aprovacao.ts)
create or replace function afetados_item(p_org uuid, p_item jsonb) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare v_campo text := p_item ->> 'campo';
begin
  if v_campo = 'piso_hora_centavos' then
    return array[(p_item ->> 'registro_id')::uuid];
  elsif v_campo = 'percentual_padrao' then
    return array(select id from pessoas where org_id = p_org and ativo and socio);
  elsif v_campo = 'percentual' then
    return array[(p_item ->> 'pessoa_id')::uuid];
  elsif v_campo = 'horas_por_unidade' then
    return array(
      select sd.pessoa_id from tipos_entrega t
      join servico_divisao sd on sd.servico_id = t.servico_id
      where t.id = (p_item ->> 'registro_id')::uuid and coalesce(sd.percentual, 0) > 0
    );
  end if;
  raise exception 'Campo % não é protegido.', v_campo;
end;
$$;

-- valor atual de um item no banco
create or replace function valor_atual_item(p_item jsonb) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare v numeric; v_campo text := p_item ->> 'campo';
begin
  if v_campo = 'piso_hora_centavos' then
    select piso_hora_centavos into v from pessoas where id = (p_item ->> 'registro_id')::uuid;
  elsif v_campo = 'percentual_padrao' then
    select percentual_padrao into v from pessoas where id = (p_item ->> 'registro_id')::uuid;
  elsif v_campo = 'percentual' then
    select percentual into v from servico_divisao
      where servico_id = (p_item ->> 'registro_id')::uuid and pessoa_id = (p_item ->> 'pessoa_id')::uuid;
  elsif v_campo = 'horas_por_unidade' then
    select horas_por_unidade into v from tipos_entrega where id = (p_item ->> 'registro_id')::uuid;
  end if;
  return v;
end;
$$;

-- aplica os itens de um pedido (liga a chave que o trigger de proteção respeita)
create or replace function aplicar_itens(p_org uuid, p_itens jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare i jsonb; v numeric;
begin
  perform set_config('aden.aplicando', 'sim', true);
  for i in select * from jsonb_array_elements(p_itens) loop
    v := (i ->> 'depois')::numeric;
    case i ->> 'campo'
      when 'piso_hora_centavos' then
        update pessoas set piso_hora_centavos = v where id = (i ->> 'registro_id')::uuid and org_id = p_org;
      when 'percentual_padrao' then
        update pessoas set percentual_padrao = v where id = (i ->> 'registro_id')::uuid and org_id = p_org;
      when 'percentual' then
        insert into servico_divisao (org_id, servico_id, pessoa_id, percentual)
        values (p_org, (i ->> 'registro_id')::uuid, (i ->> 'pessoa_id')::uuid, v)
        on conflict (servico_id, pessoa_id) do update set percentual = excluded.percentual;
      when 'horas_por_unidade' then
        update tipos_entrega set horas_por_unidade = v where id = (i ->> 'registro_id')::uuid and org_id = p_org;
    end case;
  end loop;
  perform set_config('aden.aplicando', '', true);
end;
$$;

-- confere se nada mudou desde o pedido (senão o pedido é cancelado, não sobrescreve)
create or replace function itens_ainda_valem(p_itens jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare i jsonb;
begin
  for i in select * from jsonb_array_elements(p_itens) loop
    if valor_atual_item(i) is distinct from (i ->> 'antes')::numeric then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- aplica um pedido aprovado por todos
create or replace function concluir_pedido(p_pedido uuid) returns text
language plpgsql security definer set search_path = public as $$
declare p pedidos_alteracao; v_contrato uuid;
begin
  select * into p from pedidos_alteracao where id = p_pedido for update;
  if p.tipo = 'campos' then
    if not itens_ainda_valem(p.itens) then
      update pedidos_alteracao set status = 'cancelado', decidido_em = now(),
        motivo = 'Os valores mudaram desde o pedido. Faça o pedido de novo.' where id = p_pedido;
      return 'cancelado';
    end if;
    perform aplicar_itens(p.org_id, p.itens);
  elsif p.tipo = 'excecao' and coalesce(p.dados ->> 'aplicar', '') = 'escopo' and p.cliente_id is not null then
    select id into v_contrato from contratos where cliente_id = p.cliente_id and status = 'ativo' limit 1;
    if v_contrato is null then
      insert into contratos (org_id, cliente_id, status, escopo, valor_mensal_centavos)
      values (p.org_id, p.cliente_id, 'ativo', p.dados -> 'cenario', (p.dados ->> 'valor_centavos')::bigint);
    else
      update contratos set escopo = p.dados -> 'cenario',
        valor_mensal_centavos = coalesce((p.dados ->> 'valor_centavos')::bigint, valor_mensal_centavos)
      where id = v_contrato;
    end if;
  end if;
  update pedidos_alteracao set status = 'aplicado', decidido_em = now() where id = p_pedido;
  return 'aplicado';
end;
$$;

-- cria um pedido. Se quem pede é o único afetado, vale na hora.
create or replace function criar_pedido(
  p_org uuid, p_tipo text, p_descricao text, p_itens jsonb, p_afetados uuid[],
  p_impacto jsonb, p_dados jsonb, p_assinatura text, p_cliente uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_autor uuid := minha_pessoa(p_org); v_nome text; v_pendentes uuid[]; v_status text := 'pendente';
begin
  if not eh_admin(p_org) then
    raise exception 'Só sócios podem pedir alteração.';
  end if;
  select nome into v_nome from membros where org_id = p_org and user_id = auth.uid() limit 1;
  insert into pedidos_alteracao (org_id, tipo, descricao, itens, dados, assinatura, cliente_id, afetados, impacto, autor_nome, autor_pessoa_id)
  values (p_org, p_tipo, p_descricao, coalesce(p_itens, '[]'), p_dados, p_assinatura, p_cliente, p_afetados, p_impacto, v_nome, v_autor)
  returning id into v_id;
  if v_autor is not null and v_autor = any(p_afetados) then
    insert into aprovacoes (org_id, pedido_id, pessoa_id, decisao, automatica) values (p_org, v_id, v_autor, 'aprovado', true);
  end if;
  v_pendentes := array(select unnest(p_afetados) except select v_autor where v_autor is not null);
  if coalesce(array_length(v_pendentes, 1), 0) = 0 then
    v_status := concluir_pedido(v_id);
  end if;
  return jsonb_build_object('pedido_id', v_id, 'status', v_status, 'aguardando', to_jsonb(v_pendentes));
end;
$$;

-- mudança em campos protegidos: o banco calcula quem é afetado
create or replace function propor_alteracao(p_org uuid, p_itens jsonb, p_impacto jsonb, p_descricao text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i jsonb; v_afetados uuid[] := '{}';
begin
  for i in select * from jsonb_array_elements(p_itens) loop
    v_afetados := v_afetados || afetados_item(p_org, i);
  end loop;
  v_afetados := array(select distinct unnest(v_afetados));
  return criar_pedido(p_org, 'campos', p_descricao, p_itens, v_afetados, p_impacto, null, null, null);
end;
$$;

-- escopo ou proposta abaixo do piso: os afetados são os sócios abaixo do piso
create or replace function propor_excecao(
  p_org uuid, p_cliente uuid, p_afetados uuid[], p_assinatura text, p_descricao text, p_dados jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return criar_pedido(p_org, 'excecao', p_descricao, '[]', p_afetados, null, p_dados, p_assinatura, p_cliente);
end;
$$;

-- o sócio afetado decide
create or replace function decidir_pedido(p_pedido uuid, p_decisao text, p_motivo text default null) returns text
language plpgsql security definer set search_path = public as $$
declare p pedidos_alteracao; v_pessoa uuid; v_faltam int;
begin
  select * into p from pedidos_alteracao where id = p_pedido for update;
  if p.id is null then raise exception 'Pedido não encontrado.'; end if;
  if p.status <> 'pendente' then raise exception 'Este pedido já foi decidido.'; end if;
  v_pessoa := minha_pessoa(p.org_id);
  if v_pessoa is null or not (v_pessoa = any(p.afetados)) then
    raise exception 'Só o sócio afetado pode decidir este pedido.';
  end if;
  if p_decisao not in ('aprovado', 'recusado') then raise exception 'Decisão inválida.'; end if;
  if exists (select 1 from aprovacoes where pedido_id = p_pedido and pessoa_id = v_pessoa) then
    raise exception 'Você já decidiu este pedido.';
  end if;
  insert into aprovacoes (org_id, pedido_id, pessoa_id, decisao) values (p.org_id, p_pedido, v_pessoa, p_decisao);
  if p_decisao = 'recusado' then
    update pedidos_alteracao set status = 'recusado', decidido_em = now(), motivo = p_motivo where id = p_pedido;
    return 'recusado';
  end if;
  select count(*) into v_faltam from unnest(p.afetados) a
    where not exists (select 1 from aprovacoes x where x.pedido_id = p_pedido and x.pessoa_id = a and x.decisao = 'aprovado');
  if v_faltam = 0 then
    return concluir_pedido(p_pedido);
  end if;
  return 'pendente';
end;
$$;

-- quem pediu pode desistir enquanto está pendente
create or replace function cancelar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update pedidos_alteracao set status = 'cancelado', decidido_em = now(), motivo = 'Cancelado por quem pediu.'
  where id = p_pedido and status = 'pendente' and autor_id = auth.uid();
  if not found then raise exception 'Só quem pediu pode cancelar um pedido pendente.'; end if;
end;
$$;

revoke execute on function aplicar_itens(uuid, jsonb) from public, anon, authenticated;
revoke execute on function concluir_pedido(uuid) from public, anon, authenticated;
revoke execute on function criar_pedido(uuid, text, text, jsonb, uuid[], jsonb, jsonb, text, uuid) from public, anon, authenticated;
