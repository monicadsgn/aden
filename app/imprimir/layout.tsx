import { GuardaImpressao } from "@/components/impressao/Documento";

export default function LayoutImpressao({ children }: { children: React.ReactNode }) {
  return <GuardaImpressao>{children}</GuardaImpressao>;
}
