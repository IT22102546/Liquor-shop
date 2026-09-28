import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing email through the shop's own mailbox (SMTP). Set in backend/.env:
 *   SMTP_HOST, SMTP_PORT (465 or 587), SMTP_USER, SMTP_PASS, MAIL_FROM (optional display "Name <address>").
 * For Gmail use smtp.gmail.com, port 465 and an App Password (not the normal password).
 */
let transporter: Transporter | null = null;

export function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Address shown to the supplier, e.g. "Bar Shop <orders@example.com>". Never includes the password. */
export function senderAddress(displayName?: string) {
  const from = process.env.MAIL_FROM?.trim();
  if (from) return from;
  const user = process.env.SMTP_USER ?? "";
  return displayName ? `${displayName.replace(/[<>"]/g, "")} <${user}>` : user;
}

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendEmail(message: { from: string; to: string; cc?: string; replyTo?: string; subject: string; html: string; text: string }) {
  const info = await getTransporter().sendMail(message);
  return { messageId: info.messageId };
}
