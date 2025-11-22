import amqp from "amqplib";
import type { Channel, Connection } from "amqplib";

const RABBIT_URL =
  process.env.RABBITMQ_URL || "amqp://user:password@localhost:5672";
const QUEUE = process.env.NOTIF_QUEUE || "notificaciones";

interface NotificationPayload {
  to: string;
  subject: string;
  message: string;
}

class NotificationClient {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private isConnected = false;

  /**
   * Conectar al servidor RabbitMQ
   */
  async connect(): Promise<void> {
    try {
      this.connection = (await amqp.connect(RABBIT_URL)) as any;
      this.channel = await (this.connection as any).createChannel();
      if (this.channel) {
        await this.channel.assertQueue(QUEUE, { durable: true });
      }
      this.isConnected = true;
      console.log(`✅ Conectado a RabbitMQ (${QUEUE})`);
    } catch (error) {
      console.error("❌ Error conectando a RabbitMQ:", error);
      this.isConnected = false;
    }
  }

  /**
   * Enviar notificación a la cola de RabbitMQ
   */
  async sendNotification(
    to: string,
    subject: string,
    message: string
  ): Promise<void> {
    if (!this.isConnected || !this.channel) {
      console.warn("⚠️  No hay conexión a RabbitMQ, intentando reconectar...");
      await this.connect();

      if (!this.isConnected || !this.channel) {
        throw new Error("No se pudo conectar a RabbitMQ");
      }
    }

    try {
      const payload: NotificationPayload = { to, subject, message };
      const buffer = Buffer.from(JSON.stringify(payload));

      this.channel.sendToQueue(QUEUE, buffer, { persistent: true });
      console.log(`📧 Notificación enviada a cola: ${to} - ${subject}`);
    } catch (error) {
      console.error("❌ Error enviando notificación:", error);
      throw error;
    }
  }

  /**
   * Cerrar la conexión
   */
  async close(): Promise<void> {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await (this.connection as any).close();
      this.isConnected = false;
      console.log("🔌 Conexión a RabbitMQ cerrada");
    } catch (error) {
      console.error("❌ Error cerrando conexión:", error);
    }
  }
}

// Exportar instancia singleton
export const notificationClient = new NotificationClient();

// Conectar al iniciar
notificationClient.connect().catch(console.error);

// Cerrar conexión al terminar el proceso
process.on("SIGINT", async () => {
  await notificationClient.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await notificationClient.close();
  process.exit(0);
});
