-- Aden · painel do quiz e campanha do lead (27/10/2026). Só acréscimo: nada do que existe é apagado.
--
-- 1) quiz_config: o Áleff (ou qualquer sócio) troca pela tela do Aden o WhatsApp, o Instagram e os códigos de pixel
--    (Meta e Google) do quiz, sem pedir mudança no código. A página pública lê isso pela rota /api/quiz/config.
--    Os códigos de pixel são públicos por natureza (aparecem em qualquer página com anúncio), por isso podem ir
--    para o navegador de quem abre o quiz.
-- 2) campanha do lead: de qual anúncio a pessoa veio (utm_source, utm_medium, utm_campaign, utm_content, utm_term).
--    Vale a PRIMEIRA campanha: se a pessoa refaz o quiz por outro anúncio, o lead continua com a campanha original.
-- Nenhum número de negócio mora aqui; campos de contato começam vazios.

-- ─── Configuração do quiz (uma linha por organização) ───────────────────────
create table if not exists quiz_config (
  org_id uuid primary key references organizacoes(id) on delete cascade,
  -- só números, com DDD e código do país (ex.: 5581...)
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  instagram_url text check (instagram_url is null or (length(instagram_url) <= 200 and instagram_url ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._/-]*$')),
  -- ID do pixel da Meta: só números
  meta_pixel text check (meta_pixel is null or meta_pixel ~ '^[0-9]{5,20}$'),
  -- ID da tag do Google: G-..., AW-... ou GTM-...
  google_tag text check (google_tag is null or google_tag ~ '^(G|AW|GTM)-[A-Za-z0-9]{4,20}$'),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table quiz_config enable row level security;
drop policy if exists quiz_config_leitura on quiz_config;
create policy quiz_config_leitura on quiz_config for select using (eh_membro(org_id));
drop policy if exists quiz_config_escrita on quiz_config;
create policy quiz_config_escrita on quiz_config for all using (eh_admin(org_id)) with check (eh_admin(org_id));
drop trigger if exists quiz_config_carimbo on quiz_config;
create trigger quiz_config_carimbo before update on quiz_config for each row execute function carimbar();
drop trigger if exists quiz_config_auditoria on quiz_config;
create trigger quiz_config_auditoria after insert or update or delete on quiz_config for each row execute function auditar();

-- A página do quiz lê a configuração por aqui (só a rota, que conhece o segredo, chama).
create or replace function public.quiz_config_publica(p_segredo text) returns jsonb
language plpgsql stable security definer set search_path to 'public', 'extensions' as $$
declare c quiz_config;
begin
  perform quiz_conferir(p_segredo);
  select * into c from quiz_config where org_id = quiz_org();
  return jsonb_build_object(
    'whatsapp', c.whatsapp,
    'instagram', c.instagram_url,
    'metaPixel', c.meta_pixel,
    'googleTag', c.google_tag
  );
end;
$$;

-- ─── Campanha do lead ────────────────────────────────────────────────────────
alter table leads add column if not exists campanha jsonb;
alter table quiz_progresso add column if not exists campanha jsonb;

-- Fica só com as cinco chaves conhecidas, textos curtos. Nunca recusa o pedido por causa de campanha.
create or replace function public.quiz_campanha_limpar(p jsonb) returns jsonb
language plpgsql immutable set search_path to 'public' as $$
declare r jsonb := '{}'::jsonb; k text; v text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  foreach k in array array['source', 'medium', 'campaign', 'content', 'term'] loop
    if jsonb_typeof(p -> k) = 'string' then
      v := left(btrim(p ->> k), 120);
      if v <> '' then r := r || jsonb_build_object(k, v); end if;
    end if;
  end loop;
  if r = '{}'::jsonb then return null; end if;
  return r;
end;
$$;

-- ─── Chegou numa tela (agora com a campanha) ────────────────────────────────
-- O pedido antigo (3 informações) continua valendo: a campanha é opcional.
drop function if exists public.quiz_passo(text, uuid, text);
create or replace function public.quiz_passo(p_segredo text, p_sessao uuid, p_passo text, p_campanha jsonb default null) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform quiz_conferir(p_segredo);
  if p_sessao is null or p_passo is null or p_passo !~ '^[a-z0-9_]{1,20}$' then raise exception 'Pedido inválido.'; end if;
  insert into quiz_progresso (sessao, org_id, passos, ultimo_passo, campanha)
  values (p_sessao, quiz_org(), array[p_passo], p_passo, quiz_campanha_limpar(p_campanha))
  on conflict (sessao) do update set
    passos = case
      when p_passo = any (quiz_progresso.passos) or coalesce(array_length(quiz_progresso.passos, 1), 0) >= 40 then quiz_progresso.passos
      else array_append(quiz_progresso.passos, p_passo)
    end,
    ultimo_passo = p_passo,
    campanha = coalesce(quiz_progresso.campanha, quiz_campanha_limpar(p_campanha));
end;
$$;

-- ─── Enviou o formulário final (agora grava a campanha) ─────────────────────
create or replace function public.quiz_enviar(p_segredo text, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_org uuid;
  v_sessao uuid;
  v_nome text;
  v_tel text;
  v_tel_digitos text;
  v_empresa text;
  v_insta text;
  v_cidade text;
  v_qualif text;
  v_motivos text;
  v_respostas jsonb;
  v_campanha jsonb;
  v_lead uuid;
  v_rotulo text;
begin
  perform quiz_conferir(p_segredo);
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then raise exception 'Pedido inválido.'; end if;

  begin
    v_sessao := (p_dados ->> 'sessao')::uuid;
  exception when others then
    raise exception 'Pedido inválido.';
  end;
  v_nome := btrim(coalesce(p_dados ->> 'nome', ''));
  v_tel := btrim(coalesce(p_dados ->> 'telefone', ''));
  v_tel_digitos := regexp_replace(v_tel, '\D', '', 'g');
  v_empresa := btrim(coalesce(p_dados ->> 'empresa', ''));
  v_insta := btrim(coalesce(p_dados ->> 'instagram', ''));
  v_cidade := btrim(coalesce(p_dados ->> 'cidade', ''));
  v_qualif := p_dados ->> 'qualificacao';
  v_motivos := nullif(btrim(coalesce(p_dados ->> 'motivos', '')), '');
  v_respostas := p_dados -> 'respostas';
  v_campanha := quiz_campanha_limpar(p_dados -> 'campanha');

  if v_sessao is null then raise exception 'Pedido inválido.'; end if;
  if length(v_nome) < 2 or length(v_nome) > 120 then raise exception 'Informe o nome.'; end if;
  if length(v_tel_digitos) < 10 or length(v_tel_digitos) > 13 then raise exception 'Informe o WhatsApp com DDD.'; end if;
  if length(v_empresa) < 1 or length(v_empresa) > 120 then raise exception 'Informe a empresa.'; end if;
  if length(v_insta) > 120 or length(v_cidade) > 80 then raise exception 'Pedido inválido.'; end if;
  if v_qualif is null or v_qualif not in ('qualificado', 'com_ressalva', 'desqualificado', 'social_media') then
    raise exception 'Pedido inválido.';
  end if;
  if v_motivos is not null and length(v_motivos) > 1000 then raise exception 'Pedido inválido.'; end if;
  if v_respostas is not null and (jsonb_typeof(v_respostas) <> 'array' or jsonb_array_length(v_respostas) > 30 or length(v_respostas::text) > 6000) then
    raise exception 'Pedido inválido.';
  end if;

  v_org := quiz_org();
  v_rotulo := case v_qualif
    when 'qualificado' then 'qualificado'
    when 'com_ressalva' then 'qualificado com ressalva'
    when 'desqualificado' then 'desqualificado'
    else 'quer só social media'
  end;

  -- a mesma pessoa refez o quiz em até 7 dias: atualiza o lead em vez de criar outro
  select id into v_lead from leads
  where org_id = v_org and origem = 'Quiz'
    and regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = v_tel_digitos
    and criado_em > now() - interval '7 days'
  order by criado_em desc limit 1;

  if v_lead is not null then
    update leads set
      qualificacao = v_qualif, qualificacao_motivos = v_motivos, respostas_quiz = v_respostas, quiz_sessao = v_sessao,
      empresa = coalesce(nullif(v_empresa, ''), empresa), cidade = coalesce(nullif(v_cidade, ''), cidade),
      instagram = coalesce(nullif(v_insta, ''), instagram),
      campanha = coalesce(campanha, v_campanha) -- vale a primeira campanha
    where id = v_lead;
    insert into lead_interacoes (org_id, lead_id, tipo, texto, autor_nome)
    values (v_org, v_lead, 'nota', 'Refez o quiz. Resultado: ' || v_rotulo || '.', 'Quiz');
  else
    insert into leads (org_id, nome, telefone, instagram, origem, empresa, cidade, qualificacao, qualificacao_motivos, respostas_quiz, quiz_sessao, campanha)
    values (v_org, v_nome, v_tel, nullif(v_insta, ''), 'Quiz', nullif(v_empresa, ''), nullif(v_cidade, ''), v_qualif, v_motivos, v_respostas, v_sessao, v_campanha)
    returning id into v_lead;
    insert into lead_interacoes (org_id, lead_id, tipo, texto, autor_nome)
    values (v_org, v_lead, 'nota', 'Veio pelo quiz. Resultado: ' || v_rotulo || '.', 'Quiz');
  end if;

  insert into quiz_progresso (sessao, org_id, passos, ultimo_passo, enviou, qualificacao, lead_id, campanha)
  values (v_sessao, v_org, array['form'], 'form', true, v_qualif, v_lead, v_campanha)
  on conflict (sessao) do update set
    enviou = true, qualificacao = v_qualif, lead_id = v_lead,
    campanha = coalesce(quiz_progresso.campanha, v_campanha);

  return jsonb_build_object('ok', true);
end;
$$;

-- ─── Quem pode chamar o quê ──────────────────────────────────────────────────
revoke execute on function public.quiz_campanha_limpar(jsonb) from public, anon, authenticated;
revoke execute on function public.quiz_config_publica(text) from public;
revoke execute on function public.quiz_passo(text, uuid, text, jsonb) from public;
revoke execute on function public.quiz_enviar(text, jsonb) from public;
grant execute on function public.quiz_config_publica(text) to anon, authenticated;
grant execute on function public.quiz_passo(text, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.quiz_enviar(text, jsonb) to anon, authenticated;

-- avisa a API do banco que as funções mudaram
notify pgrst, 'reload schema';
