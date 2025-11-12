import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { LockCoordinator } from "./coordinator";

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
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(coordinator.getEstadisticas(), null, 2));
  } else if (req.url === "/api/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "OK",
        servicio: "Coordinador de Locks",
        puerto: PORT,
        timestamp: new Date().toISOString(),
      })
    );
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Endpoint no encontrado" }));
  }
});

// Iniciar servidor - Escuchar en 0.0.0.0 para permitir conexiones externas
const HOST = process.env.HOST || "0.0.0.0";
httpServer.listen(PORT, HOST, () => {
  console.log("\n" + "=".repeat(60));
  console.log("🎯 COORDINADOR CENTRAL DE LOCKS");
  console.log("=".repeat(60));
  console.log(`📍 Puerto: ${PORT}`);
  console.log(`🏠 Host: ${HOST}`);
  console.log(`🔌 WebSocket: ws://${HOST}:${PORT}`);
  console.log(`\n📊 Endpoints HTTP:`);
  console.log(`   GET /api/stats  - Estadísticas de locks`);
  console.log(`   GET /api/health - Estado del servidor`);
  console.log("\n✅ Coordinador listo para recibir workers");
  console.log("=".repeat(60) + "\n");
});

// Manejar cierre graceful
process.on("SIGINT", () => {
  console.log("\n👋 Cerrando coordinador...");
  io.close();
  httpServer.close();
  process.exit(0);
});

// Log de eventos globales
io.on("connection", (socket) => {
  console.log(`\n🔗 Conexión establecida: ${socket.id}`);

  socket.on("disconnect", (reason) => {
    console.log(`\n❌ Desconexión: ${socket.id} (${reason})`);
  });
});
