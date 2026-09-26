import { redirect } from "next/navigation";

// O Aden abre na Visão do dia: o que cada um tem para resolver hoje.
export default function Inicio() {
  redirect("/hoje");
}
