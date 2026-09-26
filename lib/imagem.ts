// Prepara a foto de perfil no navegador antes de enviar: corta no quadrado (centro)
// e reduz, para a imagem ficar leve e carregar rápido em qualquer tela.

export const LADO_FOTO = 320;
const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function tipoDeFotoAceito(tipo: string): boolean {
  return TIPOS_ACEITOS.includes(tipo) || tipo.startsWith("image/");
}

/** Recorte quadrado central: de onde tirar e com que lado, dentro da imagem original. */
export function recorteQuadrado(largura: number, altura: number): { x: number; y: number; lado: number } {
  const lado = Math.min(largura, altura);
  return { x: Math.round((largura - lado) / 2), y: Math.round((altura - lado) / 2), lado };
}

export async function reduzirFoto(arquivo: Blob, lado = LADO_FOTO): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo).catch(() => {
    throw new Error("Não consegui abrir essa imagem. Tente uma foto em JPG ou PNG.");
  });
  const r = recorteQuadrado(bitmap.width, bitmap.height);
  const saida = Math.min(lado, r.lado);
  const canvas = document.createElement("canvas");
  canvas.width = saida;
  canvas.height = saida;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu preparar a foto.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, r.x, r.y, r.lado, r.lado, 0, 0, saida, saida);
  bitmap.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.86));
  if (blob && blob.type === "image/webp") return blob;
  // navegador sem WebP: cai para JPEG
  const jpg = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.88));
  if (!jpg) throw new Error("Seu navegador não conseguiu preparar a foto.");
  return jpg;
}
