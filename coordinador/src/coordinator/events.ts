import type { Server, Socket } from "socket.io";
import { TipoMensaje } from "@banco/shared/types";
import { logger } from "@banco/shared/logger";

export class EventManager {
  private coordinator: any; // Reference to coordinator for callbacks

  constructor(coordinator: any) {
    this.coordinator = coordinator;
  }

  configurar(io: Server): void {
    io.on("connection", (socket: Socket) => {
      logger.network(`🔌 Cliente conectado: ${socket.id}`, {
        socketId: socket.id,
        remoteAddress: socket.handshake.address,
      });

      socket.on(TipoMensaje.REGISTER_WORKER, (msg: any) => {
        this.coordinator.manejarRegistroWorker(socket, msg);
      });

      socket.on(TipoMensaje.HEARTBEAT, (msg: any) => {
        this.coordinator.manejarHeartbeat(socket, msg);
      });

      socket.on(TipoMensaje.LOCK_REQUEST, (msg: any) => {
        this.coordinator.manejarLockRequest(socket, msg);
      });

      socket.on(TipoMensaje.LOCK_RELEASE, (msg: any) => {
        this.coordinator.manejarLockRelease(socket, msg);
      });

      socket.on("status-request", () => {
        this.coordinator.manejarEstadoRequest(socket);
      });

      socket.on("disconnect", () => {
        this.coordinator.manejarDisconnect(socket);
        logger.network(`❌ Cliente desconectado: ${socket.id}`, {
          socketId: socket.id,
        });
      });

      socket.on("error", (error: Error) => {
        logger.error(
          `⚠️ Error en socket ${socket.id}: ${error.message}`,
          error
        );
      });
    });
  }
}
