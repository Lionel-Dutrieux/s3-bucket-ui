import "server-only";
import nodemailer from "nodemailer";
import { getSmtpConfig } from "@/lib/config";

/** Plain-text email through the configured relay. Throws if SMTP is unset. */
export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const config = await getSmtpConfig();
  if (!config) {
    throw new Error("SMTP is not configured.");
  }
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user
      ? { user: config.user, pass: config.password ?? undefined }
      : undefined,
  });
  await transporter.sendMail({ from: config.from, ...input });
}

export async function sendPasswordResetEmail(
  to: string,
  url: string,
): Promise<void> {
  await sendMail({
    to,
    subject: "Reset your password",
    text: [
      "Someone asked to reset the password of your account.",
      "",
      `Reset it here (the link expires in 1 hour): ${url}`,
      "",
      "If it wasn't you, you can ignore this email — nothing changed.",
    ].join("\n"),
  });
}
