/**
 * Sistema de autenticación seguro con:
 * - Tokens en memoria (no localStorage)
 * - Timeout automático de sesión
 * - Rate limiting
 */

// Configuración de seguridad
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // 1 minuto
const MAX_REQUESTS_PER_MINUTE = 60;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto

// Estado de autenticación en memoria (más seguro que localStorage)
let authToken: string | null = null;
let lastActivity: number = Date.now();
let sessionTimeout: NodeJS.Timeout | null = null;
let activityCheckInterval: NodeJS.Timeout | null = null;

// Rate limiting: contador de requests por endpoint
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Callbacks para eventos de sesión
type SessionCallback = () => void;
let onSessionExpiredCallback: SessionCallback | null = null;
let onSessionActiveCallback: SessionCallback | null = null;
let onTokenInvalidatedCallback: SessionCallback | null = null;

/**
 * Gestión de tokens en memoria
 */
export const TokenManager = {
  /**
   * Establece el token de autenticación
   * @param token - Token JWT
   */
  setToken(token: string | null) {
    authToken = token;

    if (token) {
      this.updateActivity();
      this.startSessionMonitoring();

      // Guardar en sessionStorage para persistir en recargas (más seguro que localStorage)
      if (typeof window !== "undefined") {
        sessionStorage.setItem("authToken", token);
        sessionStorage.setItem("hasSession", "true");
        sessionStorage.setItem("lastActivity", Date.now().toString());
      }
    } else {
      this.clearSession();
    }
  },

  /**
   * Obtiene el token actual
   */
  getToken(): string | null {
    // Si no está en memoria, intentar restaurar de sessionStorage
    if (!authToken && typeof window !== "undefined") {
      const storedToken = sessionStorage.getItem("authToken");
      const storedActivity = sessionStorage.getItem("lastActivity");

      if (storedToken && storedActivity) {
        const timeSinceActivity = Date.now() - parseInt(storedActivity, 10);

        // Verificar que no haya expirado
        if (timeSinceActivity < SESSION_TIMEOUT) {
          authToken = storedToken;
          lastActivity = parseInt(storedActivity, 10);
          this.startSessionMonitoring();
        } else {
          // Token expirado, limpiar
          this.clearSession();
        }
      }
    }

    return authToken;
    return authToken;
  },

  /**
   * Actualiza la última actividad del usuario
   */
  updateActivity() {
    lastActivity = Date.now();

    // Actualizar en sessionStorage también
    if (typeof window !== "undefined") {
      sessionStorage.setItem("lastActivity", lastActivity.toString());
    }

    // Resetear timeout
    if (sessionTimeout) {
      clearTimeout(sessionTimeout);
    }

    sessionTimeout = setTimeout(() => {
      this.expireSession();
    }, SESSION_TIMEOUT);
  },

  /**
   * Inicia el monitoreo de sesión
   */
  startSessionMonitoring() {
    if (activityCheckInterval) {
      clearInterval(activityCheckInterval);
    }

    activityCheckInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivity;

      if (timeSinceLastActivity >= SESSION_TIMEOUT) {
        this.expireSession();
      }
    }, ACTIVITY_CHECK_INTERVAL);
  },

  /**
   * Expira la sesión por timeout
   */
  expireSession() {
    console.warn("⏰ Sesión expirada por inactividad");
    this.clearSession();

    if (onSessionExpiredCallback) {
      onSessionExpiredCallback();
    }
  },

  /**
   * Limpia completamente la sesión
   */
  clearSession() {
    authToken = null;
    lastActivity = 0;

    if (sessionTimeout) {
      clearTimeout(sessionTimeout);
      sessionTimeout = null;
    }

    if (activityCheckInterval) {
      clearInterval(activityCheckInterval);
      activityCheckInterval = null;
    }

    if (typeof window !== "undefined") {
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("hasSession");
      sessionStorage.removeItem("lastActivity");
    }
  },

  /**
   * Verifica si hay una sesión activa
   */
  hasActiveSession(): boolean {
    return authToken !== null && Date.now() - lastActivity < SESSION_TIMEOUT;
  },

  /**
   * Obtiene el tiempo restante de sesión en milisegundos
   */
  getSessionTimeRemaining(): number {
    if (!authToken) return 0;
    const elapsed = Date.now() - lastActivity;
    return Math.max(0, SESSION_TIMEOUT - elapsed);
  },

  /**
   * Registra callback para sesión expirada
   */
  onSessionExpired(callback: SessionCallback) {
    onSessionExpiredCallback = callback;
  },

  /**
   * Registra callback para actividad de sesión
   */
  onSessionActive(callback: SessionCallback) {
    onSessionActiveCallback = callback;
  },

  /**
   * Registra callback para token invalidado (401 del servidor)
   */
  onTokenInvalidated(callback: SessionCallback) {
    onTokenInvalidatedCallback = callback;
  },

  /**
   * Dispara el callback de token invalidado
   */
  notifyTokenInvalidated() {
    if (onTokenInvalidatedCallback) {
      onTokenInvalidatedCallback();
    }
  },
};

/**
 * Rate Limiting para prevenir abuso
 */
export const RateLimiter = {
  /**
   * Verifica si una petición está permitida
   * @param key - Identificador único (endpoint o acción)
   * @returns true si está permitido, false si excede el límite
   */
  checkLimit(key: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now >= entry.resetTime) {
      // Crear nueva entrada o resetear
      rateLimitMap.set(key, {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW,
      });
      return true;
    }

    if (entry.count >= MAX_REQUESTS_PER_MINUTE) {
      console.warn(`⚠️ Rate limit excedido para: ${key}`);
      return false;
    }

    // Incrementar contador
    entry.count++;
    return true;
  },

  /**
   * Limpia el contador para una key específica
   */
  reset(key: string) {
    rateLimitMap.delete(key);
  },

  /**
   * Limpia todos los contadores
   */
  resetAll() {
    rateLimitMap.clear();
  },

  /**
   * Obtiene información de rate limit para una key
   */
  getStatus(key: string): {
    count: number;
    remaining: number;
    resetIn: number;
  } {
    const entry = rateLimitMap.get(key);
    const now = Date.now();

    if (!entry || now >= entry.resetTime) {
      return {
        count: 0,
        remaining: MAX_REQUESTS_PER_MINUTE,
        resetIn: 0,
      };
    }

    return {
      count: entry.count,
      remaining: Math.max(0, MAX_REQUESTS_PER_MINUTE - entry.count),
      resetIn: entry.resetTime - now,
    };
  },
};

/**
 * Monitor de actividad del usuario
 */
export const ActivityMonitor = {
  /**
   * Inicia el monitoreo de actividad del usuario
   */
  start() {
    if (typeof window === "undefined") return;

    const events = ["mousedown", "keydown", "scroll", "touchstart"];

    const handleActivity = () => {
      if (TokenManager.hasActiveSession()) {
        TokenManager.updateActivity();

        if (onSessionActiveCallback) {
          onSessionActiveCallback();
        }
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Retornar función de limpieza
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  },
};

/**
 * Migración segura de tokens existentes en localStorage
 */
export const migrateFromLocalStorage = () => {
  if (typeof window === "undefined") return;

  const oldToken = localStorage.getItem("token");

  if (oldToken) {
    console.warn("⚠️ Migrando token de localStorage a memoria segura");
    TokenManager.setToken(oldToken);
    localStorage.removeItem("token");
    console.log("✅ Token migrado y localStorage limpiado");
  }
};
