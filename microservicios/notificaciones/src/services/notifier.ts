import { Resend } from "resend";

const resend = new Resend(
  process.env.RESEND_API_KEY || "re_9tqqBrPs_8ESmesJHa6D4G6UdDv8Zfo53"
);
const FROM = process.env.RESEND_FROM || "Banco <no-reply@psicologopuebla.com>";

export async function sendNotification(
  to: string,
  subject: string,
  message: string
): Promise<void> {
  // Log para debug
  console.log(`Enviando notificación a ${to}: ${subject} - ${message}`);
  // Envío real con Resend
  await resend.emails.send({
    from: FROM,
    to,
    subject,
    text: message,
  });
}
