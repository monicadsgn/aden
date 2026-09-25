-- Aden: tipo de entrega de vídeo feito por terceiro (edição, motion, legenda, corte).
-- Não gera horas dos sócios; na calculadora, exige custo de audiovisual.
-- Roteiro e direção de gravação continuam como tipos normais, com horas.
alter table tipos_entrega add column audiovisual boolean not null default false;
