-- Aden · limites de percentual e segurança das funções (11/10/2026). Só acréscimo.
-- Percentuais de 0 a 100 no banco (antes só a sociedade e o avulso tinham trava). NOT VALID: vale para o que for gravado daqui para frente.
alter table configuracoes_empresa
  add constraint reinvestimento_pct_0_100 check (reinvestimento_pct is null or reinvestimento_pct between 0 and 100) not valid,
  add constraint imposto_pct_0_100 check (imposto_pct is null or imposto_pct between 0 and 100) not valid,
  add constraint taxa_recebimento_pct_0_100 check (taxa_recebimento_pct is null or taxa_recebimento_pct between 0 and 100) not valid;
alter table pessoas
  add constraint percentual_padrao_0_100 check (percentual_padrao is null or percentual_padrao between 0 and 100) not valid;

-- Funções de gatilho com caminho de busca fixo.
alter function public.impedir_apagar_protegido() set search_path = public;
alter function public.proteger_socio() set search_path = public;
alter function public.proteger_respostas_cliente() set search_path = public;
alter function public.proteger_aprovacao_fora() set search_path = public;

-- Funções de gatilho não precisam ser chamadas por ninguém de fora.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
