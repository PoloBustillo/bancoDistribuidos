import amqp from "amqplib";

const RABBIT_URL = process.env.RABBITMQ_URL || "amqp://localhost";
const QUEUE = process.env.NOTIF_QUEUE || "notificaciones";

export async function consumeNotifications(
  onMessage: (msg: any) => Promise<void>
) {
  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE, { durable: true });
  ch.consume(QUEUE, async (msg) => {
    if (msg) {
      try {
        const data = JSON.parse(msg.content.toString());
        await onMessage(data);
        ch.ack(msg);
      } catch (err) {
        ch.nack(msg, false, false); // descarta si hay error
      }
    }
  });
  console.log(`RabbitMQ: escuchando en cola ${QUEUE}`);
}
