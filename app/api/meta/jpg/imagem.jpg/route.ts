// Converte uma arte da Aden (png, webp, gif) em JPEG para a Meta, que só aceita JPEG. Pública de propósito (a Meta
// precisa abrir o endereço), mas só converte imagens guardadas no armazenamento da própria Aden (pasta "pecas").
// Qualidade alta, fundo branco onde havia transparência, mesma resolução. Nada é gravado.

import "server-only";
import sharp from "sharp";
import { ehImagemDaPeca } from "@/lib/meta/fila";

export const dynamic = "force-dynamic";
const LIMITE_BYTES = 10 * 1024 * 1024;

export async function GET(req: Request) {
  const origem = new URL(req.url).searchParams.get("u") ?? "";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  if (!ehImagemDaPeca(origem, supabase)) return new Response("Imagem não permitida.", { status: 400 });
  const r = await fetch(origem, { cache: "no-store" }).catch(() => null);
  if (!r || !r.ok) return new Response("Imagem não encontrada.", { status: 404 });
  const tamanho = Number(r.headers.get("content-length") ?? 0);
  if (tamanho > LIMITE_BYTES) return new Response("Imagem grande demais.", { status: 413 });
  const bruto = Buffer.from(await r.arrayBuffer());
  if (bruto.length > LIMITE_BYTES) return new Response("Imagem grande demais.", { status: 413 });
  try {
    const jpg = await sharp(bruto).rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(jpg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" } });
  } catch {
    return new Response("Não deu para converter a imagem.", { status: 422 });
  }
}
