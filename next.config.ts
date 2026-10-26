import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
// artes das peças e fotos da equipe ficam no armazenamento do próprio banco da Aden
const armazenamento = process.env.NEXT_PUBLIC_SUPABASE_URL ? ` ${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin}` : "";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${armazenamento}`,
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // página pública do quiz de conversão (public/quiz.html): o endereço sem ".html" também abre
  async rewrites() {
    return [{ source: "/quiz", destination: "/quiz.html" }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
