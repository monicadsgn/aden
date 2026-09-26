-- Ficha do cliente e dados do contrato (26/09/2026).
-- Tudo começa vazio: prazos e condições são os combinados com cada cliente.

alter table clientes
  add column contato text,
  add column telefone text,
  add column email text,
  add column instagram text,
  add column segmento text,
  add column observacoes text,
  add column cliente_desde date;

alter table contratos
  add column fim date,
  add column prazo_minimo_meses int check (prazo_minimo_meses is null or prazo_minimo_meses > 0),
  add column dia_pagamento int check (dia_pagamento is null or dia_pagamento between 1 and 31),
  add column aviso_previo_dias int check (aviso_previo_dias is null or aviso_previo_dias >= 0),
  add column limite_rodadas int check (limite_rodadas is null or limite_rodadas >= 0),
  add column prazo_aprovacao_dias int check (prazo_aprovacao_dias is null or prazo_aprovacao_dias >= 0),
  add column prazo_entrega_dias int check (prazo_entrega_dias is null or prazo_entrega_dias >= 0),
  add column inicio_cobranca text,
  add column observacoes text;
