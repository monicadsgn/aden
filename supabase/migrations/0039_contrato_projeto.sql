-- Aden · contrato de projeto avulso (valor único), decisões da Moni de 01/10/2026. Só acréscimo.
-- O contrato de projeto tem condições, obrigações e disposições próprias (texto dos sócios, Configurações → Contrato);
-- o Aden escreve o objeto, o prazo em dias úteis, as rodadas do pacote e o valor em duas partes.
alter table contrato_modelo add column if not exists condicoes_projeto text;
alter table contrato_modelo add column if not exists obrigacoes_projeto text;
alter table contrato_modelo add column if not exists disposicoes_projeto text;
alter table pacotes add column if not exists rodadas_ajuste int check (rodadas_ajuste is null or rodadas_ajuste >= 0);

-- rodadas fixas por pacote (Moni, 01/10/2026): 1 no Logo essencial, 2 na Identidade visual simples, 3 na completa
update pacotes set rodadas_ajuste = 1 where avulso and nome = 'Logo essencial' and rodadas_ajuste is null;
update pacotes set rodadas_ajuste = 2 where avulso and nome = 'Identidade visual simples' and rodadas_ajuste is null;
update pacotes set rodadas_ajuste = 3 where avulso and nome = 'Identidade visual completa' and rodadas_ajuste is null;
