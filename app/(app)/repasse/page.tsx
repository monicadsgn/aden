import { redirect } from "next/navigation";

// Repasse dos sócios virou a aba Sócios da tela Mês.
export default function Repasse() {
  redirect("/mes?aba=socios");
}
