# Aden · Gestão: regras do projeto

- Sistema **próprio da Aden**. Não compartilha banco, deploy nem código em runtime com o SoftMoni ou com a Mônica Design. O SoftMoni é só referência de padrões.
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
