// Cor da etiqueta de cada cliente (M6 da auditoria, 01/10/2026): 6 tons de apoio em app/tokens.css (classes cliente-1..6).
// A cor sai do id (não muda quando o nome muda); clientes ativos que cairiam na mesma cor pegam a próxima livre.

import type { ClienteBase, Id } from "./tipos";

export const CORES_CLIENTE = 6;

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Número da cor (1 a 6) de cada cliente. */
export function coresDosClientes(clientes: Pick<ClienteBase, "id" | "ativo">[]): Map<Id, number> {
  const out = new Map<Id, number>();
  const usadas = new Set<number>();
  const ordem = [...clientes].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.id.localeCompare(b.id));
  for (const c of ordem) {
    let n = hash(c.id) % CORES_CLIENTE;
    // ativos não repetem cor enquanto houver cor livre
    if (c.ativo) for (let i = 0; i < CORES_CLIENTE && usadas.has(n); i++) n = (n + 1) % CORES_CLIENTE;
    if (c.ativo) usadas.add(n);
    out.set(c.id, n + 1);
  }
  return out;
}
