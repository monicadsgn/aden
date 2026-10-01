-- Aden · projetos de marca (decisão da Moni, 01/10/2026, opção A): logo, identidade visual, branding e estrutura
-- visual levam dias ou semanas e não se medem em minutos. O tipo de entrega marcado como projeto guarda as HORAS
-- TOTAIS estimadas do projeto (no mesmo campo protegido horas_por_unidade: 1 unidade = 1 projeto) e o PRAZO em dias,
-- que vai para o contrato. Só acréscimo; o preço continua saindo do cálculo.
alter table tipos_entrega add column if not exists projeto boolean not null default false;
alter table tipos_entrega add column if not exists prazo_dias int check (prazo_dias is null or prazo_dias > 0);
