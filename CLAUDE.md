# Aden · Gestão: regras do projeto

- O Aden é a **central da agência** (tarefas, calendário, comercial, financeiro, metas), cada pessoa com seu acesso. Abre na **Visão do dia** (`/hoje`); a calculadora é ferramenta do comercial, não a entrada.
- Sistema **próprio da Aden**. Não compartilha banco, deploy nem código em runtime com o SoftMoni ou com a Mônica Design. O SoftMoni é só referência de padrões.
- **Ninguém da Aden (Áleff, equipe, freelancer, contador, clientes) tem acesso ao SoftMoni.** Nunca colocar no Aden link, endereço, chave, login, integração ou conector do SoftMoni, nem citar o SoftMoni em tela, texto de ajuda, PDF ou conector MCP. Reaproveitar lógica do SoftMoni = reescrever aqui dentro, sem ligação nenhuma com ele. Antes de convidar alguém da Aden para Vercel/GitHub/Supabase, avisar a Moni: o SoftMoni está na mesma conta Vercel dela.
- **Nenhum número de negócio no código**: percentual, preço, prazo, piso, horas por entrega, modelo de cobrança. Tudo vem da configuração ou do que a pessoa digita. Campos começam vazios (`null`). Nomes citados pela Moni podem ser oferecidos como sugestão (ex.: lista de serviços), nunca números.
- Não inventar regra de negócio: na dúvida, perguntar.
- Dinheiro em centavos (inteiro). Percentuais de 0 a 100.
- Visual: só tokens de `app/tokens.css` (via classes `bg-marca`, `text-texto-suave`, `rounded-card`, `rounded-bloco`, `rounded-item`, `rounded-campo`, `rounded-botao`). Nada de cor, fonte ou arredondamento fixo em componente; `rounded-full` só para círculos de verdade.
- Audiovisual nunca gera horas dos sócios: tipo de entrega "vídeo de terceiro" é só custo. Roteiro e direção têm horas.
- Entrada do cliente (uma vez) nunca entra no resultado da rotina mensal.
- Ferramentas e estrutura vão embutidas na mensalidade (rateio); a proposta mostra um valor só.
- Linguagem simples: cada tela e número importante tem uma frase dizendo o que significa (a Moni não é de números).
- Toda tabela nova: `org_id`, RLS (leitura membro, escrita admin, a menos que a fase peça outra coisa), triggers `carimbar()` e `auditar()`.
- Motor de cálculo em `lib/calculo/` é puro e testado (`npm test`). Mudou fórmula → atualiza teste e `docs/ARQUITETURA.md`.
- Next.js 16: ler `node_modules/next/dist/docs/` antes de usar APIs novas (`middleware` virou `proxy`, APIs de request são assíncronas).
- Conector MCP (`lib/mcp/`): toda área nova ganha ferramentas no conector, para o Claude do claude.ai operar o sistema como um sócio.
- Campos protegidos (piso, % dos sócios, divisão de horas, tempo por entrega) só mudam por `propor_alteracao` (aprovação do sócio afetado); o banco bloqueia update direto. Regra em `lib/regras/aprovacao.ts`, espelhada nas migrations 0004–0009. Escopo/proposta abaixo do piso = pedido de exceção.
- Tempo por entrega na tela é em minutos (`CampoMinutos`); por dentro, horas.
- Todo aviso tem `acao` (botão para o campo que resolve). Campo opcional vazio é `lembrete`, não erro.
- Tela do cliente (apresentação, PDF de proposta) só recebe `VistaApresentacao`/`DocumentoProposta`: nada interno. Há teste de render travando isso.
- Terceiro cobrado por saída: custo = saídas × (valor + deslocamento), só do cliente, nunca rateado; o cliente nunca vê o valor.
- Pacote não tem preço digitado: sai do cálculo (`lib/calculo/pacotes.ts`). Metas: só os sócios cadastram.
- Todo `Alerta` tem `explica` (o que isso quer dizer, com exemplo). Textos de ajuda ficam em `lib/ajuda.ts`.
- Tela Mês, aba Resumo e metas: fala em crescimento ("hora do próximo passo"), nunca "não cabe"/"bloqueado" (há teste).
- Menu em 5 grupos (docs/ARQUITETURA.md). Assunto novo entra numa tela que já existe (aba) antes de virar item de menu.
- Painel do cliente (`/c/[token]`): **desligado** em `lib/recursos.ts` (aprovação fica no SoftMoni até a decisão dos sócios); não apagar nada dele. Quando ligado, o cliente só lê/responde pelas funções `painel_cliente`/`responder_peca` (nunca tabela direta). Nada interno sai delas; campos de resposta do cliente só o banco escreve.
- Acessos: sócio (admin) vê tudo; equipe/freelancer só tarefas (RLS da migration 0018, nomes via `equipe_nomes`). Tabela nova com dado sensível: leitura só `eh_membro` (sócio), nunca liberar para a equipe sem pensar.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
