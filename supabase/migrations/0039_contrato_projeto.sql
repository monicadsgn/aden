-- Aden · contrato de projeto avulso (01/10/2026). Já aplicada no banco como "0039_contrato_projeto";
-- este arquivo só guarda no repositório o que foi aplicado (estava faltando). Só acréscimo.
alter table contrato_modelo add column if not exists condicoes_projeto text;
alter table contrato_modelo add column if not exists obrigacoes_projeto text;
alter table contrato_modelo add column if not exists disposicoes_projeto text;
alter table pacotes add column if not exists rodadas_ajuste int check (rodadas_ajuste is null or rodadas_ajuste >= 0);
update pacotes set rodadas_ajuste = 1 where avulso and nome = 'Logo essencial' and rodadas_ajuste is null;
update pacotes set rodadas_ajuste = 2 where avulso and nome = 'Identidade visual simples' and rodadas_ajuste is null;
update pacotes set rodadas_ajuste = 3 where avulso and nome = 'Identidade visual completa' and rodadas_ajuste is null;
