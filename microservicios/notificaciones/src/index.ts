import "dotenv/config";
import express from "express";
import { json } from "express";
import { sendNotification } from "./services/notifier.js";
import { consumeNotifications } from "./queue/rabbit.js";
import { startGrpcServer } from "./grpcServer.js";

const app = express();
app.use(json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "notificaciones",
    timestamp: new Date().toISOString() 
  });
});

// Endpoint HTTP opcional para pruebas
app.post("/api/notificaciones/send", async (req, res) => {
  const { to, subject, message } = req.body;
  if (!to || !subject || !message) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  try {
    await sendNotification(to, subject, message);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "No se pudo enviar la notificación" });
  }
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Notificaciones HTTP escuchando en puerto ${PORT}`);
});

// Iniciar gRPC
startGrpcServer(Number(process.env.GRPC_PORT) || 50051);

// Iniciar consumidor de RabbitMQ
consumeNotifications(
  async ({
    to,
    subject,
    message,
  }: {
    to: string;
    subject: string;
    message: string;
  }) => {
    await sendNotification(to, subject, message);
    console.log(`Notificación enviada a ${to} (RabbitMQ)`);
  }
);
