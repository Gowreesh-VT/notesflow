/**
 * Sends email through Resend's HTTP API (https://resend.com), so no SDK is needed. Configured with
 * RESEND_API_KEY and EMAIL_FROM (a sender on a domain verified in Resend, such as "Notesflow <hi@example.com>").
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type Email = { to: string; subject: string; text: string; html: string };
export type SendEmail = (email: Email) => Promise<void>;

export const sendEmail: SendEmail = async ({ to, subject, text, html }) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html }),
  });
  if (!response.ok) throw new Error(`email provider answered ${response.status}`);
};
