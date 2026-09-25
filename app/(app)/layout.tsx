import { Shell } from "@/components/Shell";

export default function LayoutApp({ children }: LayoutProps<"/">) {
  return <Shell>{children}</Shell>;
}
