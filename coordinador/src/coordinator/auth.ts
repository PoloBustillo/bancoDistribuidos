import crypto from "crypto";
import { CONFIG } from "@banco/shared/config";
import { logger } from "@banco/shared/logger";

// ========================================
// 🔐 AUTENTICACIÓN DE WORKERS
// ========================================
// Sistema de autenticación basado en tokens HMAC
// para validar que solo workers autorizados se conecten
// ========================================

export class WorkerAuth {
  private readonly secret: string;
  private validTokens: Set<string> = new Set();

  constructor() {
    this.secret = CONFIG.AUTH.WORKER_TOKEN_SECRET;

    if (this.secret === "default-worker-secret-change-in-production") {
      logger.warn(
        "⚠️ Usando secret por defecto para workers - CAMBIAR EN PRODUCCIÓN"
      );
    }
  }

  /**
   * Genera un token único para un worker
   * El token es un HMAC-SHA256 del workerId + timestamp
   */
  generarToken(workerId: string): string {
    const timestamp = Date.now();
    const payload = `${workerId}:${timestamp}`;
    const hmac = crypto.createHmac("sha256", this.secret);
    hmac.update(payload);
    const token = `${payload}:${hmac.digest("hex")}`;

    this.validTokens.add(token);
    logger.auth(`Token generado para worker ${workerId}`, { workerId });

    return token;
  }

  /**
   * Valida que un token sea legítimo
   * Verifica la firma HMAC y que no haya expirado
   */
  validarToken(token: string, workerId: string): boolean {
    if (!token) {
      logger.warn("Token vacío rechazado", { workerId });
      return false;
    }

    const parts = token.split(":");
    if (parts.length !== 3) {
      logger.warn("Token con formato inválido", {
        workerId,
        token: token.substring(0, 20),
      });
      return false;
    }

    const [tokenWorkerId, timestampStr, signature] = parts;

    // Verificar que el workerId coincida
    if (tokenWorkerId !== workerId) {
      logger.warn("Token de otro worker rechazado", {
        workerId,
        tokenWorkerId,
      });
      return false;
    }

    // Verificar expiración (24 horas)
    const timestamp = parseInt(timestampStr);
    const age = Date.now() - timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    if (age > maxAge) {
      logger.warn("Token expirado rechazado", {
        workerId,
        edad: Math.round(age / 1000 / 60) + " minutos",
      });
      return false;
    }

    // Verificar firma HMAC
    const payload = `${tokenWorkerId}:${timestampStr}`;
    const hmac = crypto.createHmac("sha256", this.secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");

    if (signature !== expectedSignature) {
      logger.warn("Token con firma inválida rechazado", { workerId });
      return false;
    }

    logger.auth(`Token válido para worker ${workerId}`, { workerId });
    return true;
  }

  /**
   * Revoca un token (para desconexión o cambio de credenciales)
   */
  revocarToken(token: string): void {
    this.validTokens.delete(token);
  }

  /**
   * Limpia tokens expirados (ejecutar periódicamente)
   */
  limpiarTokensExpirados(): void {
    const maxAge = 24 * 60 * 60 * 1000;
    const ahora = Date.now();
    let limpiados = 0;

    for (const token of this.validTokens) {
      const parts = token.split(":");
      if (parts.length === 3) {
        const timestamp = parseInt(parts[1]);
        if (ahora - timestamp > maxAge) {
          this.validTokens.delete(token);
          limpiados++;
        }
      }
    }

    if (limpiados > 0) {
      logger.auth(`Limpiados ${limpiados} tokens expirados`);
    }
  }
}
