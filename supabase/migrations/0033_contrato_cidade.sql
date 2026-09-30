-- Aden · contrato no padrão de acabamento da Moni (30/09/2026): cidade da contratada (cabeçalho, local e data, rodapé).
-- Só acréscimo.
alter table contrato_modelo add column if not exists cidade text;
