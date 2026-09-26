# Colocar no ar (Supabase + Vercel)

Tudo em contas/projetos **exclusivos da Aden**. Não reutilize o projeto Supabase nem o projeto Vercel do SoftMoni.

## 1. Supabase

1. Crie um projeto novo em supabase.com (ex.: `aden-gestao`), região São Paulo.
2. **Authentication → Providers → Email**: deixe ativo. Em **Authentication → Settings**, desligue *Allow new users to sign up* (só os sócios criam acessos).
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
2. Em **Configurações**, cadastre os sócios (% padrão, piso por hora, horas/mês), os percentuais da empresa, os serviços e quem executa, os tipos de entrega com horas, os custos fixos, a regra de rateio e os clientes ativos.
3. Abra a **Calculadora**.

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
