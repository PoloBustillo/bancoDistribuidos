import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();

export class SessionManager {
  /**
   * Crear nueva sesión (invalida automáticamente la sesión anterior si existe)
   */
  async createSession(
    usuarioId: string,
    jti: string,
    expiresAt: Date,
    deviceInfo?: string,
    ipAddress?: string
  ) {
    try {
      // Buscar sesión anterior del usuario
      const sesionAnterior = await prisma.sesion.findUnique({
        where: { usuarioId },
      });

      // Si existe sesión anterior, retornar su socketId para desconectarla
      const socketIdAnterior = sesionAnterior?.socketId || null;

      // Eliminar sesión anterior (upsert lo hace automáticamente)
      const nuevaSesion = await prisma.sesion.upsert({
        where: { usuarioId },
        update: {
          jti,
          socketId: null, // Se actualizará cuando conecte el socket
          deviceInfo,
          ipAddress,
          expiresAt,
        },
        create: {
          usuarioId,
          jti,
          deviceInfo,
          ipAddress,
          expiresAt,
        },
      });

      logger.info(`Nueva sesión creada para usuario ${usuarioId}`);

      return {
        sesion: nuevaSesion,
        socketIdAnterior, // Para desconectar la sesión anterior
      };
    } catch (error) {
      logger.error("Error al crear sesión:", error);
      throw error;
    }
  }

  /**
   * Actualizar socketId de una sesión
   */
  async updateSocketId(jti: string, socketId: string) {
    try {
      await prisma.sesion.update({
        where: { jti },
        data: { socketId },
      });
      logger.info(`Socket ${socketId} asociado a sesión ${jti}`);
    } catch (error) {
      logger.error("Error al actualizar socketId:", error);
      throw error;
    }
  }

  /**
   * Limpiar socketId cuando se desconecta
   */
  async clearSocketId(jti: string) {
    try {
      await prisma.sesion.update({
        where: { jti },
        data: { socketId: null },
      });
      logger.info(`SocketId limpiado para sesión ${jti}`);
    } catch (error) {
      logger.error("Error al limpiar socketId:", error);
    }
  }

  /**
   * Obtener sesión por JTI
   */
  async getSessionByJti(jti: string) {
    return await prisma.sesion.findUnique({
      where: { jti },
      include: { usuario: true },
    });
  }

  /**
   * Obtener sesión por socketId
   */
  async getSessionBySocketId(socketId: string) {
    return await prisma.sesion.findUnique({
      where: { socketId },
      include: { usuario: true },
    });
  }

  /**
   * Obtener sesión activa de un usuario
   */
  async getActiveSession(usuarioId: string) {
    return await prisma.sesion.findUnique({
      where: { usuarioId },
    });
  }

  /**
   * Eliminar sesión por JTI
   */
  async deleteSession(jti: string) {
    try {
      await prisma.sesion.delete({
        where: { jti },
      });
      logger.info(`Sesión ${jti} eliminada`);
    } catch (error) {
      logger.error("Error al eliminar sesión:", error);
      throw error;
    }
  }

  /**
   * Eliminar sesión por usuarioId
   */
  async deleteUserSession(usuarioId: string) {
    try {
      const sesion = await prisma.sesion.findUnique({
        where: { usuarioId },
      });

      if (sesion) {
        await prisma.sesion.delete({
          where: { usuarioId },
        });
        logger.info(`Sesión del usuario ${usuarioId} eliminada`);
        return sesion.socketId; // Retornar socketId para desconectar
      }
      return null;
    } catch (error) {
      logger.error("Error al eliminar sesión de usuario:", error);
      throw error;
    }
  }

  /**
   * Limpiar sesiones expiradas
   */
  async cleanExpiredSessions() {
    try {
      const resultado = await prisma.sesion.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      logger.info(`${resultado.count} sesiones expiradas limpiadas`);
      return resultado.count;
    } catch (error) {
      logger.error("Error al limpiar sesiones expiradas:", error);
      throw error;
    }
  }
}

export const sessionManager = new SessionManager();
