import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { authService } from "../auth/authService";
import { sessionManager } from "../auth/sessionManager";
import { logger } from "../utils/logger";
import {
  SOCKET_EVENTS,
  SocketData,
  SessionConnectedPayload,
  SessionKickedPayload,
} from "./types";

export class SocketManager {
  private io: SocketIOServer;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*", // En producción, especificar dominio exacto
        methods: ["GET", "POST"],
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    logger.info("🔌 SocketManager inicializado");
  }

  /**
   * Middleware de autenticación para sockets
   */
  private setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error("No se proporcionó token de autenticación"));
        }

        // Verificar token JWT
        const { usuario, jti } = await authService.verificarToken(token);

        // Guardar datos en el socket
        socket.data = {
          usuario,
          jti,
        } as SocketData;

        next();
      } catch (error) {
        logger.error("Error en autenticación de socket:", error);
        next(new Error("Token inválido o expirado"));
      }
    });
  }

  /**
   * Configurar manejadores de eventos
   */
  private setupEventHandlers() {
    this.io.on("connection", async (socket: Socket) => {
      const { usuario, jti } = socket.data as SocketData;

      logger.info(
        `✅ Socket conectado: ${socket.id} | Usuario: ${usuario.email}`
      );

      try {
        // Actualizar socketId en la sesión
        await sessionManager.updateSocketId(jti, socket.id);

        // Unir al room del usuario (para broadcasts futuros)
        socket.join(`user:${usuario.id}`);

        // Confirmar conexión al cliente
        const payload: SessionConnectedPayload = {
          message: "Sesión conectada exitosamente",
          usuario: {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
          },
          sessionId: jti,
        };
        socket.emit(SOCKET_EVENTS.SESSION_CONNECTED, payload);
      } catch (error) {
        logger.error("Error al conectar socket:", error);
        socket.disconnect();
        return;
      }

      // ============================================
      // EVENTO: Logout
      // ============================================
      socket.on(SOCKET_EVENTS.AUTH_LOGOUT, async () => {
        try {
          logger.info(`Logout solicitado por usuario: ${usuario.email}`);
          await sessionManager.deleteSession(jti);
          socket.disconnect();
        } catch (error) {
          logger.error("Error en logout:", error);
        }
      });

      // ============================================
      // EVENTO: Desconexión
      // ============================================
      socket.on("disconnect", async () => {
        logger.info(
          `❌ Socket desconectado: ${socket.id} | Usuario: ${usuario.email}`
        );
        try {
          await sessionManager.clearSocketId(jti);
        } catch (error) {
          logger.error("Error al limpiar socketId:", error);
        }
      });
    });
  }

  /**
   * Expulsar sesión anterior cuando hay nuevo login
   */
  async kickPreviousSession(
    socketId: string,
    reason: string = "Sesión iniciada en otro dispositivo"
  ) {
    try {
      const payload: SessionKickedPayload = {
        reason: "new_login",
        message: reason,
        timestamp: new Date(),
      };

      // Emitir evento de expulsión
      this.io.to(socketId).emit(SOCKET_EVENTS.SESSION_KICKED, payload);

      logger.warn(`⚠️  Sesión expulsada: ${socketId} | Razón: ${reason}`);

      // Esperar un momento para que el cliente reciba el mensaje
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Desconectar el socket
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
    } catch (error) {
      logger.error("Error al expulsar sesión:", error);
    }
  }

  /**
   * Emitir evento a un usuario específico (todas sus sesiones, aunque solo hay 1)
   */
  emitToUser(usuarioId: string, event: string, data: any) {
    this.io.to(`user:${usuarioId}`).emit(event, data);
    logger.debug(`Evento emitido a usuario ${usuarioId}: ${event}`);
  }

  /**
   * Emitir evento a un socket específico
   */
  emitToSocket(socketId: string, event: string, data: any) {
    this.io.to(socketId).emit(event, data);
    logger.debug(`Evento emitido a socket ${socketId}: ${event}`);
  }

  /**
   * Obtener instancia de Socket.IO
   */
  getIO() {
    return this.io;
  }
}
