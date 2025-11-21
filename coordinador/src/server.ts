import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { LockCoordinator } from "./coordinator/coordinator";
import { logger } from "@banco/shared/logger";

const PORT = parseInt(process.env.PORT || "4000");

// Crear servidor HTTP
const httpServer = createServer();

// Crear servidor Socket.IO con CORS
const io = new SocketServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// Crear coordinador de locks
const coordinator = new LockCoordinator(io);

// Endpoint HTTP para estadísticas
httpServer.on("request", (req, res) => {
  // CORS headers para permitir peticiones desde el frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/api/stats" && req.method === "GET") {
    logger.info("GET /api/stats", { url: req.url, method: req.method });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(coordinator.getEstadisticas(), null, 2));
  } else if (req.url === "/api/health" && req.method === "GET") {
    logger.info("GET /api/health", { url: req.url, method: req.method });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "OK",
        servicio: "Coordinador de Locks",
        puerto: PORT,
        timestamp: new Date().toISOString(),
      })
    );
  } else if (
    req.url?.startsWith("/api/generate-token/") &&
    req.method === "GET"
  ) {
    // Endpoint para generar tokens - SOLO PARA DESARROLLO/SETUP
    // En producción, esto debería estar protegido con autenticación de admin
    const workerId = req.url.split("/api/generate-token/")[1];
    if (workerId) {
      const token = coordinator.generarTokenWorker(workerId);
      logger.info(`Token generado para ${workerId}`, { workerId });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ workerId, token }));
    } else {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "workerId requerido" }));
    }
  } else {
    logger.warn("404 Not Found", { url: req.url, method: req.method });
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Endpoint no encontrado" }));
  }
});

// Iniciar servidor - Escuchar en 0.0.0.0 para permitir conexiones externas
const HOST = process.env.HOST || "0.0.0.0";
httpServer.listen(PORT, HOST, () => {
  logger.coordinator("\n" + "=".repeat(60));
  logger.coordinator("🎯 COORDINADOR CENTRAL DE LOCKS");
  logger.coordinator("=".repeat(60));
  logger.coordinator(`📍 Puerto: ${PORT}`);
  logger.coordinator(`🏠 Host: ${HOST}`);
  logger.coordinator(`🔌 WebSocket: ws://${HOST}:${PORT}`);
  logger.coordinator(`\n📊 Endpoints HTTP:`);
  logger.coordinator(`   GET /api/stats  - Estadísticas de locks y deadlocks`);
  logger.coordinator(`   GET /api/health - Estado del servidor`);
  logger.coordinator(
    `   GET /api/generate-token/:workerId - Generar token (solo setup)`
  );
  logger.coordinator("\n🔐 Autenticación de workers habilitada");
  logger.coordinator("✅ Coordinador listo para recibir workers autenticados");
  logger.coordinator("=".repeat(60) + "\n");
});

// Manejar cierre graceful
process.on("SIGINT", () => {
  logger.coordinator("\n👋 Cerrando coordinador...");
  io.close();
  httpServer.close();
  process.exit(0);
});

// Log de eventos globales
io.on("connection", (socket) => {
  logger.network(`\n🔗 Conexión establecida: ${socket.id}`);

  socket.on("disconnect", (reason) => {
    logger.network(`\n❌ Desconexión: ${socket.id} (${reason})`);
  });
});
