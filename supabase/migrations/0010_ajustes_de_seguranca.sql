-- Aden · ajustes pedidos pelo verificador de segurança do Supabase (26/09/2026).
-- Funções internas das aprovações não ficam chamáveis pela API; as ações de aprovação
-- só para quem está logado; funções de trigger com search_path fixo.

revoke execute on function afetados_item(uuid, jsonb) from public, anon, authenticated;
revoke execute on function valor_atual_item(jsonb) from public, anon, authenticated;
revoke execute on function itens_ainda_valem(jsonb) from public, anon, authenticated;

revoke execute on function propor_alteracao(uuid, jsonb, jsonb, text) from public, anon;
revoke execute on function propor_excecao(uuid, uuid, uuid[], text, text, jsonb) from public, anon;
revoke execute on function decidir_pedido(uuid, text, text) from public, anon;
revoke execute on function cancelar_pedido(uuid) from public, anon;
grant execute on function propor_alteracao(uuid, jsonb, jsonb, text) to authenticated;
grant execute on function propor_excecao(uuid, uuid, uuid[], text, text, jsonb) to authenticated;
grant execute on function decidir_pedido(uuid, text, text) to authenticated;
grant execute on function cancelar_pedido(uuid) to authenticated;

alter function carimbar() set search_path = public;
alter function impedir_mudanca() set search_path = public;
alter function proteger_campos() set search_path = public;
