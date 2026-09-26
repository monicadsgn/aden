import { redirect } from "next/navigation";

// O cronômetro agora fica dentro de cada tarefa (botão Start). Link antigo leva para lá.
export default function Cronometro() {
  redirect("/tarefas");
}
