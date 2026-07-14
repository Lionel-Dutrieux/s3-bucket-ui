import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env, smtpEnabled } from "@/lib/env";

// Lazy transport on globalThis — same pattern as the Prisma client: created
// on first use, survives Turbopack HMR without stacking connections.
const globalForMail = globalThis as unknown as { mailer?: Transporter };

function getTransporter(): Transporter {
  if (!globalForMail.mailer) {
    globalForMail.mailer = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
    });
  }
  return globalForMail.mailer;
}

/** Plain-text email through the configured relay. Throws if SMTP is unset. */
export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!smtpEnabled()) {
    throw new Error("SMTP is not configured.");
  }
  await getTransporter().sendMail({ from: env.SMTP_FROM, ...input });
}

export async function sendPasswordResetEmail(
  to: string,
  url: string,
): Promise<void> {
  await sendMail({
    to,
    subject: "Reset your Bucket UI password",
    text: [
      "Someone asked to reset the password of your Bucket UI account.",
      "",
      `Reset it here (the link expires in 1 hour): ${url}`,
      "",
      "If it wasn't you, you can ignore this email — nothing changed.",
    ].join("\n"),
  });
}
