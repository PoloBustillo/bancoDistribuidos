import type { Server, Socket } from "socket.io";
import { TipoMensaje } from "@banco/shared/types";
import { logger } from "@banco/shared/logger";
import type { ILockCoordinator } from "./interfaces";
import { MessageValidator } from "./validators";

export class EventManager {
  private coordinator: ILockCoordinator;

  constructor(coordinator: ILockCoordinator) {
    this.coordinator = coordinator;
  }

  configurar(io: Server): void {
    io.on("connection", (socket: Socket) => {
      logger.network(`🔌 Cliente conectado: ${socket.id}`, {
        socketId: socket.id,
        remoteAddress: socket.handshake.address,
      });

      socket.on(TipoMensaje.REGISTER_WORKER, (msg: unknown) => {
        const validation = MessageValidator.validateRegisterWorker(msg);
        if (!validation.success) {
          logger.warn(`Mensaje inválido rechazado`, {
            socketId: socket.id,
            error: validation.error,
          });
          socket.emit("validation-error", {
            error: validation.error,
            tipo: TipoMensaje.REGISTER_WORKER,
          });
          return;
        }
        this.coordinator.manejarRegistroWorker(socket, validation.data!);
      });

      socket.on(TipoMensaje.HEARTBEAT, (msg: unknown) => {
        const validation = MessageValidator.validateHeartbeat(msg);
        if (!validation.success) {
          logger.warn(`Heartbeat inválido rechazado`, {
            socketId: socket.id,
            error: validation.error,
          });
          return;
        }
        this.coordinator.manejarHeartbeat(socket, validation.data!);
      });

      socket.on(TipoMensaje.LOCK_REQUEST, (msg: unknown) => {
        const validation = MessageValidator.validateLockRequest(msg);
        if (!validation.success) {
          logger.warn(`Lock request inválido rechazado`, {
            socketId: socket.id,
            error: validation.error,
          });
          socket.emit("validation-error", {
            error: validation.error,
            tipo: TipoMensaje.LOCK_REQUEST,
          });
          return;
        }
        this.coordinator.manejarLockRequest(socket, validation.data!);
      });

      socket.on(TipoMensaje.LOCK_RELEASE, (msg: unknown) => {
        const validation = MessageValidator.validateLockRelease(msg);
        if (!validation.success) {
          logger.warn(`Lock release inválido rechazado`, {
            socketId: socket.id,
            error: validation.error,
          });
          return;
        }
        this.coordinator.manejarLockRelease(socket, validation.data!);
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
