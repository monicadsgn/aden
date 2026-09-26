import { redirect } from "next/navigation";

// Avisos virou uma aba da tela Pedidos e avisos.
export default function Avisos() {
  redirect("/aprovacoes?aba=avisos");
}
