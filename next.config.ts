import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
// artes das peças e fotos da equipe ficam no armazenamento do próprio banco da Aden
const armazenamento = process.env.NEXT_PUBLIC_SUPABASE_URL ? ` ${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin}` : "";

function montarCsp(extra: { script?: string; img?: string; connect?: string } = {}) {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${extra.script ? ` ${extra.script}` : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${armazenamento}${extra.img ? ` ${extra.img}` : ""}`,
    "font-src 'self' data:",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co${extra.connect ? ` ${extra.connect}` : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

// O sistema inteiro continua fechado para scripts de fora. Só a página pública do quiz (que roda anúncio)
// pode carregar o pixel da Meta e a tag do Google, e só desses endereços.
const csp = montarCsp();
const cspQuiz = montarCsp({
  script: "https://connect.facebook.net https://www.googletagmanager.com",
  img: "https://www.facebook.com https://www.googletagmanager.com https://*.google-analytics.com https://*.doubleclick.net https://www.google.com",
  connect:
    "https://www.facebook.com https://connect.facebook.net https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.doubleclick.net https://www.google.com",
});

const segurancaComum = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  // página pública do quiz de conversão (public/quiz.html): o endereço sem ".html" também abre
  async rewrites() {
    return [{ source: "/quiz", destination: "/quiz.html" }];
  },
  async headers() {
    return [
      // tudo, menos a página do quiz (que tem a política dela logo abaixo; duas políticas ao mesmo tempo se somariam e bloqueariam o pixel)
      {
        source: "/:path((?!quiz$|quiz\\.html$).*)",
        headers: [{ key: "Content-Security-Policy", value: csp }, ...segurancaComum],
      },
      { source: "/quiz", headers: [{ key: "Content-Security-Policy", value: cspQuiz }, ...segurancaComum] },
      { source: "/quiz.html", headers: [{ key: "Content-Security-Policy", value: cspQuiz }, ...segurancaComum] },
    ];
  },
};

export default nextConfig;
