import { redirect } from "next/navigation";

// Saúde dos clientes virou a aba Cada cliente da tela Mês.
export default function Saude() {
  redirect("/mes?aba=clientes");
}
