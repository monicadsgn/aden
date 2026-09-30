-- Aden · decisões da reunião de 29/09/2026 (Fase 2)
-- Regra da sociedade (campos protegidos), oferta padrão, follow-up, custo pago por sócio,
-- custo planejado, taxa real por pagamento, condições novas do contrato e do lead.
-- Nenhum número de negócio aqui: todas as colunas começam vazias.

-- ─── Configuração da empresa ────────────────────────────────────────────────
alter table configuracoes_empresa
  add column if not exists socio_percentual_id uuid references pessoas(id) on delete set null,
  add column if not exists sociedade_pct_socio numeric(7,4) check (sociedade_pct_socio between 0 and 100),
  add column if not exists sociedade_teto_virada_centavos bigint check (sociedade_teto_virada_centavos >= 0),
  add column if not exists sociedade_aviso_bonus_centavos bigint check (sociedade_aviso_bonus_centavos >= 0),
  add column if not exists socio_sobra_id uuid references pessoas(id) on delete set null,
  add column if not exists sociedade_sobra_trafego_pct numeric(7,4) check (sociedade_sobra_trafego_pct between 0 and 100),
  add column if not exists trafego_proprio_minimo_centavos bigint check (trafego_proprio_minimo_centavos >= 0),
  add column if not exists follow_ups_maximo integer check (follow_ups_maximo > 0),
  add column if not exists oferta_verba_min_centavos bigint check (oferta_verba_min_centavos >= 0),
  add column if not exists oferta_verba_max_centavos bigint check (oferta_verba_max_centavos >= 0),
  add column if not exists oferta_gestao_apos_resultado_centavos bigint check (oferta_gestao_apos_resultado_centavos >= 0),
  add column if not exists oferta_minimo_social_trafego_centavos bigint check (oferta_minimo_social_trafego_centavos >= 0);

-- ─── Custos fixos: quem banca e custo planejado ─────────────────────────────
alter table custos_fixos
  add column if not exists pago_por_pessoa_id uuid references pessoas(id) on delete set null,
  add column if not exists planejado boolean not null default false;

-- ─── Pagamentos: taxa real (ex.: cartão) ────────────────────────────────────
alter table pagamentos
  add column if not exists taxa_centavos bigint check (taxa_centavos >= 0);

-- ─── Contrato: último dia útil, reuniões e garantia ─────────────────────────
alter table contratos
  add column if not exists vence_ultimo_dia_util boolean not null default false,
  add column if not exists limite_reunioes_mes integer check (limite_reunioes_mes >= 0),
  add column if not exists garantia_resultado text,
  add column if not exists garantia_ate date;

-- ─── Leads: comercial estruturado e follow-up ───────────────────────────────
alter table leads add column if not exists comercial_estruturado boolean;
alter table lead_interacoes drop constraint if exists lead_interacoes_tipo_check;
alter table lead_interacoes add constraint lead_interacoes_tipo_check
  check (tipo in ('nota', 'ligacao', 'whatsapp', 'reuniao', 'email', 'proposta', 'follow_up'));

-- ─── Campos protegidos da sociedade ─────────────────────────────────────────
-- Mesma regra dos outros (0005): valor que já existia só muda pela aprovação.
-- Quem é quem (socio_percentual_id, socio_sobra_id) também fica travado depois de escolhido.
drop trigger if exists configuracoes_empresa_protegido on configuracoes_empresa;
create trigger configuracoes_empresa_protegido before update on configuracoes_empresa
  for each row execute function proteger_campos(
    'socio_percentual_id', 'sociedade_pct_socio', 'sociedade_teto_virada_centavos',
    'sociedade_aviso_bonus_centavos', 'socio_sobra_id', 'sociedade_sobra_trafego_pct',
    'trafego_proprio_minimo_centavos'
  );

-- quem é afetado (mesma regra de lib/regras/aprovacao.ts)
create or replace function afetados_item(p_org uuid, p_item jsonb) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare v_campo text := p_item ->> 'campo'; v_sobra uuid;
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
  elsif v_campo = 'sociedade_sobra_trafego_pct' then
    select socio_sobra_id into v_sobra from configuracoes_empresa where org_id = p_org;
    if v_sobra is not null then return array[v_sobra]; end if;
    return array(select id from pessoas where org_id = p_org and ativo and socio);
  elsif v_campo in ('sociedade_pct_socio', 'sociedade_teto_virada_centavos', 'sociedade_aviso_bonus_centavos', 'trafego_proprio_minimo_centavos') then
    return array(select id from pessoas where org_id = p_org and ativo and socio);
  end if;
  raise exception 'Campo % não é protegido.', v_campo;
end;
$$;

-- valor atual de um item (a sociedade é da organização do pedido: o registro é a própria configuração)
create or replace function valor_atual_item(p_item jsonb) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare v numeric; v_campo text := p_item ->> 'campo'; v_org uuid := (p_item ->> 'org_id')::uuid;
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
  elsif v_campo = 'sociedade_pct_socio' then
    select sociedade_pct_socio into v from configuracoes_empresa where org_id = v_org;
  elsif v_campo = 'sociedade_teto_virada_centavos' then
    select sociedade_teto_virada_centavos into v from configuracoes_empresa where org_id = v_org;
  elsif v_campo = 'sociedade_aviso_bonus_centavos' then
    select sociedade_aviso_bonus_centavos into v from configuracoes_empresa where org_id = v_org;
  elsif v_campo = 'trafego_proprio_minimo_centavos' then
    select trafego_proprio_minimo_centavos into v from configuracoes_empresa where org_id = v_org;
  elsif v_campo = 'sociedade_sobra_trafego_pct' then
    select sociedade_sobra_trafego_pct into v from configuracoes_empresa where org_id = v_org;
  end if;
  return v;
end;
$$;

-- confere se nada mudou desde o pedido; os itens da sociedade levam a organização junto
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
      when 'sociedade_pct_socio' then
        update configuracoes_empresa set sociedade_pct_socio = v where org_id = p_org;
      when 'sociedade_teto_virada_centavos' then
        update configuracoes_empresa set sociedade_teto_virada_centavos = v where org_id = p_org;
      when 'sociedade_aviso_bonus_centavos' then
        update configuracoes_empresa set sociedade_aviso_bonus_centavos = v where org_id = p_org;
      when 'trafego_proprio_minimo_centavos' then
        update configuracoes_empresa set trafego_proprio_minimo_centavos = v where org_id = p_org;
      when 'sociedade_sobra_trafego_pct' then
        update configuracoes_empresa set sociedade_sobra_trafego_pct = v where org_id = p_org;
    end case;
  end loop;
  perform set_config('aden.aplicando', '', true);
end;
$$;
