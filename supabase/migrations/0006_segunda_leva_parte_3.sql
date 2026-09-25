-- Aden · segunda leva (aprovação dos sócios, cronômetro, pagamentos, perfis)
-- Parte 3 de 6. Rode cada parte inteira, numa query nova, em ordem.
-- (Dividida em partes pequenas porque colar um arquivo grande cortava o texto.)

-- ─── Carimbo, auditoria e RLS ───────────────────────────────────────────────
create trigger medicoes_carimbo before update on medicoes for each row execute function carimbar();
create trigger pagamentos_carimbo before update on pagamentos for each row execute function carimbar();
create trigger medicoes_auditoria after insert or update or delete on medicoes for each row execute function auditar();
create policy medicoes_leitura on medicoes for select using (eh_membro(org_id));
create trigger pagamentos_auditoria after insert or update or delete on pagamentos for each row execute function auditar();
create policy pagamentos_leitura on pagamentos for select using (eh_membro(org_id));
create trigger pedidos_alteracao_auditoria after insert or update or delete on pedidos_alteracao for each row execute function auditar();
create policy pedidos_alteracao_leitura on pedidos_alteracao for select using (eh_membro(org_id));
create trigger aprovacoes_auditoria after insert or update or delete on aprovacoes for each row execute function auditar();
create policy aprovacoes_leitura on aprovacoes for select using (eh_membro(org_id));
create trigger avisos_socios_auditoria after insert or update or delete on avisos_socios for each row execute function auditar();
create policy avisos_socios_leitura on avisos_socios for select using (eh_membro(org_id));
create policy medicoes_insercao on medicoes for insert with check (eh_admin(org_id));
create policy medicoes_edicao on medicoes for update using (eh_admin(org_id)) with check (eh_admin(org_id));
create policy medicoes_remocao on medicoes for delete using (eh_admin(org_id));
create policy pagamentos_insercao on pagamentos for insert with check (eh_admin(org_id));
create policy pagamentos_edicao on pagamentos for update using (eh_admin(org_id)) with check (eh_admin(org_id));
create policy pagamentos_remocao on pagamentos for delete using (eh_admin(org_id));

-- avisos: sócio cria e marca como lido; ninguém apaga
create policy avisos_socios_insercao on avisos_socios for insert with check (eh_admin(org_id));
create policy avisos_socios_edicao on avisos_socios for update using (eh_admin(org_id)) with check (eh_admin(org_id));
-- pedidos e aprovações: só pelas funções abaixo (sem política de escrita)

-- contador: só leitura do financeiro (nunca piso, horas, divisão nem negociação)
create policy pagamentos_contador on pagamentos for select using (eh_financeiro(org_id));
create policy clientes_contador on clientes for select using (eh_financeiro(org_id));
create policy custos_fixos_contador on custos_fixos for select using (eh_financeiro(org_id));
create policy configuracoes_empresa_contador on configuracoes_empresa for select using (eh_financeiro(org_id));

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
