// Envio pelo Gmail da Aden (SMTP). Sem domínio próprio, é por aqui que o aviso sai. O usuário e a senha de app
// ficam só na Vercel (AVISO_GMAIL_USUARIO e AVISO_GMAIL_SENHA_APP) e nunca passam por tela, chat ou código.

import "server-only";
import nodemailer from "nodemailer";
import type { EmailPronto } from "./avisoCliente";

export function gmailConfigurado(): { usuario: string; senha: string } | null {
  const usuario = process.env.AVISO_GMAIL_USUARIO?.trim();
  const senha = process.env.AVISO_GMAIL_SENHA_APP?.replace(/\s+/g, "");
  return usuario && senha ? { usuario, senha } : null;
}

export function criarEnvio(): (para: string[], email: EmailPronto) => Promise<void> {
  const cfg = gmailConfigurado();
  if (!cfg) throw new Error("O Gmail da Aden ainda não foi ligado na Vercel.");
  const transporte = nodemailer.createTransport({ service: "gmail", auth: { user: cfg.usuario, pass: cfg.senha } });
  return async (para, email) => {
    await transporte.sendMail({
      from: { name: "Equipe Aden", address: cfg.usuario },
      to: para,
      subject: email.assunto,
      text: email.texto,
      html: email.html,
    });
  };
}
