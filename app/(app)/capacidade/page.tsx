import { redirect } from "next/navigation";

// Capacidade virou a aba Horas da tela Mês.
export default function Capacidade() {
  redirect("/mes?aba=horas");
}
