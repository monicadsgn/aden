-- Aden · quiz de conversão de leads (26/10/2026). Só acréscimo: nada do que existe é alterado ou apagado.
--
-- O quiz é uma página pública. Quem responde não tem login, então ele entra pela rota /api/quiz do Aden, que chama
-- funções do banco:
--   - quiz_passo: marca "esta pessoa chegou na pergunta X" (para ver onde as pessoas param);
--   - quiz_enviar: cria o lead (origem "Quiz") já com a etiqueta e as respostas, ou atualiza o lead se a mesma
--     pessoa refez o quiz em até 7 dias (não duplica);
--   - quiz_limite_checar: limite por hora por visitante.
-- A chave pública do banco está no código do site, então qualquer um poderia chamar essas funções direto. Por isso
-- todas exigem um SEGREDO que só a rota conhece (guardado aqui só como hash, em quiz_segredo; o valor vai na variável
-- QUIZ_SEGREDO da Vercel). Sem segredo cadastrado, o quiz fica desligado.
-- A regra de qualificação (quem é qualificado, com ressalva ou desqualificado) fica na página do quiz e é decisão do
-- Áleff; o Aden só guarda o resultado. Nenhum número de negócio mora aqui.
-- Segurança: limite por hora por visitante (hash do endereço, nunca o endereço), validação de tudo que chega,
-- e as tabelas novas não aceitam escrita direta de ninguém (só as funções escrevem).

-- ─── Campos novos no lead ────────────────────────────────────────────────────
alter table leads
  add column if not exists empresa text,
  add column if not exists cidade text,
  add column if not exists qualificacao text
    check (qualificacao is null or qualificacao in ('qualificado', 'com_ressalva', 'desqualificado', 'social_media')),
  add column if not exists qualificacao_motivos text,
  add column if not exists respostas_quiz jsonb,
  add column if not exists quiz_sessao uuid;
create index if not exists leads_quiz_sessao on leads (quiz_sessao) where quiz_sessao is not null;

-- ─── Onde cada pessoa parou ──────────────────────────────────────────────────
-- Uma linha por visita ao quiz. "passos" são as telas que a pessoa viu, na ordem.
-- Sem o gatilho auditar() de propósito: seriam centenas de linhas anônimas no Histórico dos sócios.
-- O lead criado continua auditado pelo gatilho da tabela leads.
create table if not exists quiz_progresso (
  sessao uuid primary key,
  org_id uuid not null references organizacoes(id) on delete cascade,
  passos text[] not null default '{}',
  ultimo_passo text,
  enviou boolean not null default false,
  qualificacao text,
  lead_id uuid references leads(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table quiz_progresso enable row level security;
create index if not exists quiz_progresso_org on quiz_progresso (org_id, criado_em desc);
drop trigger if exists quiz_progresso_carimbo on quiz_progresso;
create trigger quiz_progresso_carimbo before update on quiz_progresso for each row execute function carimbar();
drop policy if exists quiz_progresso_leitura on quiz_progresso;
create policy quiz_progresso_leitura on quiz_progresso for select using (eh_membro(org_id));
-- (sem política de escrita: só as funções abaixo escrevem)

-- ─── Segredo da rota ─────────────────────────────────────────────────────────
create table if not exists quiz_segredo (
  id boolean primary key default true check (id),
  hash text not null,
  atualizado_em timestamptz not null default now()
);
alter table quiz_segredo enable row level security; -- sem política: ninguém lê nem escreve de fora

create or replace function public.quiz_conferir(p_segredo text) returns void
language plpgsql stable security definer set search_path to 'public', 'extensions' as $$
begin
  if p_segredo is null or length(p_segredo) < 24
     or not exists (select 1 from quiz_segredo where hash = encode(digest(p_segredo, 'sha256'), 'hex')) then
    raise exception 'Pedido inválido.';
  end if;
end;
$$;

-- ─── Limite por hora (anti-spam) ─────────────────────────────────────────────
-- Infraestrutura, sem dado de negócio nem de pessoa (a chave é um hash). Sem política: ninguém lê nem escreve de fora.
create table if not exists quiz_limite (
  chave text not null,
  tipo text not null,
  hora timestamptz not null,
  n int not null default 0,
  primary key (chave, tipo, hora)
);
alter table quiz_limite enable row level security;

-- Chamada à parte, antes de cada pedido: assim a contagem não volta atrás quando o pedido é recusado.
create or replace function public.quiz_limite_checar(p_segredo text, p_chave text, p_tipo text, p_max int) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v int;
begin
  perform quiz_conferir(p_segredo);
  if p_tipo not in ('passo', 'enviar') or p_max is null or p_max < 1 or p_max > 1000 then raise exception 'Pedido inválido.'; end if;
  if p_chave is null or length(p_chave) < 16 or length(p_chave) > 128 then raise exception 'Pedido inválido.'; end if;
  insert into quiz_limite (chave, tipo, hora, n) values (p_chave, p_tipo, date_trunc('hour', now()), 1)
  on conflict (chave, tipo, hora) do update set n = quiz_limite.n + 1
  returning n into v;
  if v > p_max then raise exception 'Muitas tentativas. Tente de novo mais tarde.'; end if;
  if random() < 0.02 then delete from quiz_limite where hora < now() - interval '2 days'; end if;
end;
$$;

-- A Aden tem uma organização só; se isso mudar, o quiz para em vez de gravar no lugar errado.
create or replace function public.quiz_org() returns uuid
language plpgsql stable security definer set search_path to 'public' as $$
declare v uuid; n int;
begin
  select count(*) into n from organizacoes;
  if n <> 1 then raise exception 'Quiz não configurado.'; end if;
  select id into v from organizacoes;
  return v;
end;
$$;

-- ─── Chegou numa tela ────────────────────────────────────────────────────────
create or replace function public.quiz_passo(p_segredo text, p_sessao uuid, p_passo text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform quiz_conferir(p_segredo);
  if p_sessao is null or p_passo is null or p_passo !~ '^[a-z0-9_]{1,20}$' then raise exception 'Pedido inválido.'; end if;
  insert into quiz_progresso (sessao, org_id, passos, ultimo_passo)
  values (p_sessao, quiz_org(), array[p_passo], p_passo)
  on conflict (sessao) do update set
    passos = case
      when p_passo = any (quiz_progresso.passos) or coalesce(array_length(quiz_progresso.passos, 1), 0) >= 40 then quiz_progresso.passos
      else array_append(quiz_progresso.passos, p_passo)
    end,
    ultimo_passo = p_passo;
end;
$$;

-- ─── Enviou o formulário final ───────────────────────────────────────────────
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
      instagram = coalesce(nullif(v_insta, ''), instagram)
    where id = v_lead;
    insert into lead_interacoes (org_id, lead_id, tipo, texto, autor_nome)
    values (v_org, v_lead, 'nota', 'Refez o quiz. Resultado: ' || v_rotulo || '.', 'Quiz');
  else
    insert into leads (org_id, nome, telefone, instagram, origem, empresa, cidade, qualificacao, qualificacao_motivos, respostas_quiz, quiz_sessao)
    values (v_org, v_nome, v_tel, nullif(v_insta, ''), 'Quiz', nullif(v_empresa, ''), nullif(v_cidade, ''), v_qualif, v_motivos, v_respostas, v_sessao)
    returning id into v_lead;
    insert into lead_interacoes (org_id, lead_id, tipo, texto, autor_nome)
    values (v_org, v_lead, 'nota', 'Veio pelo quiz. Resultado: ' || v_rotulo || '.', 'Quiz');
  end if;

  insert into quiz_progresso (sessao, org_id, passos, ultimo_passo, enviou, qualificacao, lead_id)
  values (v_sessao, v_org, array['form'], 'form', true, v_qualif, v_lead)
  on conflict (sessao) do update set enviou = true, qualificacao = v_qualif, lead_id = v_lead;

  return jsonb_build_object('ok', true);
end;
$$;

-- ─── Quem pode chamar o quê ──────────────────────────────────────────────────
-- Todas conferem o segredo; só quiz_org (interna) fica fechada para quem está de fora.
revoke execute on function public.quiz_org() from public, anon, authenticated;
revoke execute on function public.quiz_conferir(text) from public, anon, authenticated;
revoke execute on function public.quiz_limite_checar(text, text, text, int) from public;
revoke execute on function public.quiz_passo(text, uuid, text) from public;
revoke execute on function public.quiz_enviar(text, jsonb) from public;
grant execute on function public.quiz_limite_checar(text, text, text, int) to anon, authenticated;
grant execute on function public.quiz_passo(text, uuid, text) to anon, authenticated;
grant execute on function public.quiz_enviar(text, jsonb) to anon, authenticated;
