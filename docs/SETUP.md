# Colocar no ar (Supabase + Vercel)

Tudo em contas/projetos **exclusivos da Aden**. Não reutilize o projeto Supabase nem o projeto Vercel do SoftMoni.

## 1. Supabase

1. Crie um projeto novo em supabase.com (ex.: `aden-gestao`), região São Paulo.
2. **Authentication → Providers → Email**: deixe ativo. Em **Authentication → Settings**, deixe **ligado** *Allow new users to sign up*: o "Primeiro acesso? Criar senha" da tela de entrada precisa disso. Quem se cadastrar sem convite (Configurações → Equipe e acessos) não vê nada: o banco só dá acesso a quem foi convidado. Ligue também *Leaked password protection*.
3. **SQL Editor**: cole e rode, em ordem, cada arquivo de `supabase/migrations/`, em ordem (`0001_…` até `0018_…`), cada um numa query limpa.
4. **Authentication → Users → Add user**: crie o usuário de cada sócio (e-mail + senha).
5. **SQL Editor**: crie a organização e vincule os sócios como administradores:

```sql
insert into organizacoes (nome) values ('Aden') returning id;
-- copie o id retornado e use abaixo
select vincular_socio('<ID-DA-ORG>', 'email-da-moni@...', 'Moni');
select vincular_socio('<ID-DA-ORG>', 'email-do-aleff@...', 'Áleff');
```

6. **Settings → API**: copie a *Project URL* e a chave *anon / publishable*.

## 2. Vercel

1. *Add New → Project* → importe o repositório `monicadsgn/aden`.
2. Em *Environment Variables*, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = chave anon
3. Deploy. O endereço fica `https://<nome-do-projeto>.vercel.app`.

As variáveis são lidas pelo servidor **a cada acesso** (não ficam congeladas no build). Mesmo assim, a Vercel só
entrega variáveis novas ou alteradas a deploys feitos depois da mudança: depois de mexer nelas, faça um Redeploy.
Se a faixa amarela de "modo demonstração" aparecer, ela diz qual variável o servidor não encontrou.

## 3. Primeiro uso

1. Entre com o e-mail e a senha de sócio.
2. Em **Configurações**, cadastre os sócios (% padrão, piso por hora, horas/mês), os percentuais da empresa, os serviços e quem executa, os tipos de entrega com horas, os custos fixos e a regra de rateio.
3. Em **Clientes e contratos**, cadastre os clientes ativos (valor mensal e escopo na ficha de cada um).
4. Abra a **Calculadora de projeto** (grupo Vendas do menu).

## Segurança e histórico

- Permissões ficam no banco (RLS): só membros da Aden leem; só administradores (sócios) gravam.
- Toda inserção, alteração e remoção em configurações, clientes, contratos e simulações vai para a tabela `auditoria` por trigger, com autor e data. Ninguém (nem admin) consegue editar ou apagar o histórico pelo app.
- A migration foi testada num Postgres local: histórico com autor, histórico imutável e usuário de fora sem acesso de leitura nem de escrita.

## 4. Conector para o Claude (claude.ai)

Dá ao Claude do projeto ADEN no claude.ai o mesmo acesso de um sócio: ver e alterar configurações, rodar a
calculadora, salvar simulações e ler o histórico. Ele entra com um usuário próprio, então tudo o que alterar
aparece no Histórico como "Claude (conector)".

1. **Supabase → Authentication → Users → Add user**: crie um usuário para o conector (um e-mail só dele,
   ex.: `claude@aden-gestao.app`, e uma senha forte), com **Auto Confirm User** marcado.
2. **Supabase → SQL Editor** (query limpa):
   ```sql
   select vincular_socio((select id from organizacoes limit 1), 'claude@aden-gestao.app', 'Claude (conector)');
   ```
3. **Vercel → Settings → Environment Variables**, adicione:
   - `ADEN_MCP_EMAIL` = o e-mail do passo 1
   - `ADEN_MCP_SENHA` = a senha do passo 1
   - `ADEN_MCP_TOKEN` = uma senha nova, longa (40+ letras e números), só para o conector
   Depois, **Redeploy**.
4. **claude.ai → Configurações → Conectores → Adicionar conector personalizado**:
   - Nome: `Aden`
   - URL: `https://aden-sable.vercel.app/api/mcp/<ADEN_MCP_TOKEN>`
5. No projeto ADEN, ative o conector no menu de ferramentas da conversa.

Se o conector não responder, abrir `https://aden-sable.vercel.app/api/mcp/x` no navegador mostra
"Não autorizado" (configuração ok) ou "Faltam: …" com os nomes das variáveis que o servidor não encontrou.
Na Vercel, variáveis do tipo **Secret** já chegaram vazias em Production uma vez; se isso acontecer, recrie como **Config**.

## 5. Quiz de conversão de leads (página pública `/quiz`)

O quiz é uma página pública (`public/quiz.html`, abre em `/quiz`). Cada pessoa que responde vira um **lead** no funil
(origem "Quiz"), já com a etiqueta (qualificado, com ressalva, desqualificado ou só social media), o que pesou nela e as
respostas. O Aden também guarda **em que tela cada pessoa parou** (funil do quiz, na tela de Leads). Sem planilha e sem
CRM de fora.

Como funciona por dentro: a página manda os dados para `/api/quiz`; a rota confere o que chegou, limita por hora por
visitante (guarda só um hash do endereço), descarta robô (campo escondido e tempo mínimo) e chama funções do banco
(migration `0046`). Quem chama o banco direto, sem o segredo da rota, é recusado. A regra de quem é qualificado fica
**na página do quiz** (decisão do Áleff); o Aden só guarda o resultado.

Para ligar (uma vez):

1. **Supabase → SQL Editor** (query limpa): rode `supabase/migrations/0046_quiz_leads.sql`.
2. Invente um segredo de 24 letras ou mais (só letras e números). Ele vai em dois lugares, e **o texto do segredo
   nunca é colado no SQL**, só o hash (resultado de `sha256`, 64 caracteres):

```sql
insert into quiz_segredo (hash) values ('<HASH-SHA256-DO-SEGREDO>')
on conflict (id) do update set hash = excluded.hash, atualizado_em = now();
```

3. **Vercel → Settings → Environment Variables**: `QUIZ_SEGREDO` = o segredo (texto). Depois, **Redeploy**.
4. Abra `https://<seu-endereço>/quiz`, responda de teste e confira o lead em **Leads**.

Sem o segredo cadastrado (passo 2) ou sem a variável (passo 3), a página abre, mas o envio responde "fora do ar" e a
pessoa é mandada para o WhatsApp. Para trocar o segredo: repita os passos 2 e 3 com um texto novo.

### Painel do quiz e campanha (migration 0047)

Para o sócio trocar WhatsApp, Instagram e pixels pela tela, e para ver de qual anúncio veio cada lead:

1. **Supabase → SQL Editor** (query limpa): rode `supabase/migrations/0047_quiz_painel_e_campanha.sql`. **Rode antes de
   aprovar o PR**, senão o quiz passa a chamar funções que ainda não existem. É só acréscimo; nada é apagado.
2. Não há variável nova na Vercel (continua só `QUIZ_SEGREDO`).
3. Depois do deploy: **Leads → Configurar o quiz**. Cole o código do pixel da Meta e/ou da tag do Google e salve; a
   página do quiz passa a usar em até 1 minuto. Use "Link para o anúncio" para gerar o endereço com a campanha.
