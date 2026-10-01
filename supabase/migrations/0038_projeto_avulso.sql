-- Aden · pacotes de projeto avulso (Moni, 01/10/2026). Só acréscimo.
-- Pacote avulso: sem mensalidade, pago uma vez (Logo essencial, Identidade visual simples, Identidade visual completa).
-- Os itens do projeto (com os extras) ficam em `rotina`; o preço sai do cálculo (lib/calculo/pacotes.ts), nunca digitado.
-- O % pago no início do projeto (o resto na entrega) é configuração. O cliente que fecha um avulso guarda o projeto
-- fechado (`clientes.projeto_avulso`), para as tarefas e para o contrato de valor único (próxima etapa).

alter table pacotes add column if not exists avulso boolean not null default false;
alter table configuracoes_empresa add column if not exists avulso_sinal_pct numeric(5,2)
  check (avulso_sinal_pct is null or (avulso_sinal_pct >= 0 and avulso_sinal_pct <= 100));
alter table clientes add column if not exists projeto_avulso jsonb;

-- decisões da Moni (01/10/2026): 50% no início e 50% na entrega; o tipo "Logo" passa a se chamar "Identidade visual simples"
update configuracoes_empresa set avulso_sinal_pct = 50 where avulso_sinal_pct is null;
update tipos_entrega set nome = 'Identidade visual simples' where nome = 'Logo' and projeto;
