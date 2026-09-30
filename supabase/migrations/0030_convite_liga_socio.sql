-- Aden · convite de sócio já liga o login ao sócio cadastrado (30/09/2026).
-- Antes, o convite com acesso de sócio (admin) criava só o acesso; o login ficava sem sócio ligado, e ele não
-- conseguia aprovar pedidos nem gerar o código do Claude. Agora, se existe um sócio ativo ainda sem login com o
-- mesmo nome do convite, os dois são ligados. Só acréscimo ao que já existia; o resto da função é igual.

create or replace function public.aceitar_convite() returns text
language plpgsql security definer set search_path to 'public' as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_c convites;
  v_membro uuid;
  v_n integer;
  v_pessoa text;
begin
  if auth.uid() is null or v_email is null then return null; end if;
  if exists (select 1 from membros where user_id = auth.uid() and ativo) then return 'ja_membro'; end if;
  select * into v_c from convites where email = v_email and aceito_em is null order by criado_em desc limit 1;
  if not found then return null; end if;
  insert into membros (org_id, user_id, nome, email, papel) values (v_c.org_id, auth.uid(), v_c.nome, v_email, v_c.papel)
    returning id into v_membro;
  if v_c.papel in ('colaborador', 'freelancer') then
    insert into pessoas (org_id, nome, socio, ativo, membro_id) values (v_c.org_id, v_c.nome, false, true, v_membro);
  elsif v_c.papel = 'admin' then
    -- sócio já cadastrado, sem login, com o mesmo nome do convite (só se houver exatamente um)
    select count(*), min(id::text) into v_n, v_pessoa from pessoas
    where org_id = v_c.org_id and socio and ativo and membro_id is null and lower(btrim(nome)) = lower(btrim(v_c.nome));
    if v_n = 1 then
      update pessoas set membro_id = v_membro where id = v_pessoa::uuid;
    end if;
  end if;
  update convites set aceito_em = now() where id = v_c.id;
  return v_c.papel;
end;
$$;
