"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Worker, User, Account, Card } from "@/types";
import { apiClient } from "@/lib/api";
import { TokenManager, ActivityMonitor, migrateFromLocalStorage } from "@/lib/auth";
import { io, Socket } from "socket.io-client";

interface BankingEventData {
  cuentaId?: string;
  saldoAnterior?: number;
  saldoNuevo?: number;
  monto?: number;
  cuentaOrigenId?: string;
  cuentaDestinoId?: string;
  usuarioId?: string;
  usuarioEmail?: string;
  rol?: string;
  tarjetaId?: string;
  estado?: "ACTIVA" | "BLOQUEADA" | "CANCELADA";
}

interface BankingEvent {
  type: string;
  timestamp: Date;
  workerId: string;
  data: BankingEventData;
}

interface AppState {
  selectedWorker: Worker;
  setSelectedWorker: (worker: Worker) => void;
  workers: Worker[];
  addWorker: (worker: Worker) => void;
  removeWorker: (workerId: string) => void;
  user: User | null;
  setUser: (user: User | null) => void;
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  cards: Card[];
  setCards: (cards: Card[]) => void;
  isAuthenticated: boolean;
  logout: () => void;
  refreshUserData: () => Promise<void>;
  // Socket.IO
  socketConnected: boolean;
  socketReconnecting: boolean;
  socketError: string | null;
  recentEvents: BankingEvent[];
  clearEvents: () => void;
  // Notificaciones
  notifications: Notification[];
  clearNotifications: () => void;
}

interface Notification {
  id: string;
  type: "success" | "info" | "warning" | "error";
  title: string;
  message: string;
  timestamp: Date;
}

const AppContext = createContext<AppState | undefined>(undefined);

// Función para obtener los workers por defecto según el entorno
const getDefaultWorkers = (): Worker[] => {
  // Usar variables de entorno si están disponibles
  const worker1Url =
    process.env.NEXT_PUBLIC_WORKER1_URL || "https://api1.psic-danieladiaz.com";
  const worker1AltUrl = "http://api1.psic-danieladiaz.com";
  const worker2Url =
    process.env.NEXT_PUBLIC_WORKER2_URL || "https://api2.psic-danieladiaz.com";
  const worker3Url =
    process.env.NEXT_PUBLIC_WORKER3_URL || "https://api3.psic-danieladiaz.com";

  // En el servidor (SSR), siempre usar producción
  if (typeof window === "undefined") {
    return [
      {
        id: "worker1",
        name: "Worker 1",
        url: worker1Url,
        color: "#2563eb",
      },
      {
        id: "worker1-alt",
        name: "Worker 1 (Alt)",
        url: worker1AltUrl,
        color: "#2563eb",
      },
      {
        id: "worker2",
        name: "Worker 2",
        url: worker2Url,
        color: "#22c55e",
      },
      {
        id: "worker3",
        name: "Worker 3",
        url: worker3Url,
        color: "#a21caf",
      },
    ];
  }

  // En desarrollo local, usar localhost
  if (window.location.hostname === "localhost") {
    return [
      {
        id: "worker1",
        name: "Worker 1",
        url: "http://localhost:3001",
        color: "#2563eb",
      },
      {
        id: "worker2",
        name: "Worker 2",
        url: "http://localhost:3002",
        color: "#22c55e",
      },
    ];
  }

  // En producción (Vercel), usar las URLs configuradas
  return [
    {
      id: "worker1",
      name: "Worker 1",
      url: worker1Url,
      color: "#2563eb",
    },
    {
      id: "worker1-alt",
      name: "Worker 1 (Alt)",
      url: worker1AltUrl,
      color: "#2563eb",
    },
    {
      id: "worker2",
      name: "Worker 2",
      url: worker2Url,
      color: "#22c55e",
    },
    {
      id: "worker3",
      name: "Worker 3",
      url: worker3Url,
      color: "#a21caf",
    },
  ];
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Cargar workers de localStorage o usar defaults - RESPETAMOS LO QUE EL USUARIO ELIGIÓ
  const [workers, setWorkers] = useState<Worker[]>(() => {
    if (typeof window === "undefined") return getDefaultWorkers();
    const saved = localStorage.getItem("workers");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return getDefaultWorkers();
      }
    }
    return getDefaultWorkers();
  });

  const [workersScanned, setWorkersScanned] = useState(false);

  const [selectedWorker, setSelectedWorkerState] = useState<Worker>(() => {
    if (typeof window === "undefined") {
      const defaults = getDefaultWorkers();
      return defaults[0];
    }
    const saved = localStorage.getItem("selectedWorker");
    if (saved) {
      try {
        const savedWorker = JSON.parse(saved);
        // Verificar que el worker guardado exista en la lista
        const savedWorkers = localStorage.getItem("workers");
        if (savedWorkers) {
          const workersList = JSON.parse(savedWorkers);
          const exists = workersList.find(
            (w: Worker) => w.id === savedWorker.id
          );
          if (exists) return savedWorker;
        }
      } catch {
        // Si hay error, usar default
      }
    }
    const defaults = getDefaultWorkers();
    return defaults[0];
  });

  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Socket.IO state
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<BankingEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Escaneo automático de workers al iniciar
  useEffect(() => {
    if (typeof window === "undefined" || workersScanned) return;

    const scanWorkers = async () => {
      const WORKER_SCAN_LIST = [
        // Localhost
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        // HTTPS dominios
        "https://api1.psic-danieladiaz.com",
        "https://api2.psic-danieladiaz.com",
        "https://api3.psic-danieladiaz.com",
        // HTTP dominios
        "http://api1.psic-danieladiaz.com",
        "http://api2.psic-danieladiaz.com",
        "http://api3.psic-danieladiaz.com",
      ];

      const results = await Promise.allSettled(
        WORKER_SCAN_LIST.map(async (baseUrl) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const res = await fetch(`${baseUrl}/api/health`, {
              method: "GET",
              mode: "cors",
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!res.ok) return null;
            const data = await res.json();
            if (data.status !== "OK") return null;

            return {
              id: data.workerId || `worker-${baseUrl}`,
              name: data.workerId || baseUrl.replace(/^https?:\/\//, ""),
              url: baseUrl,
              color: ["#2563eb", "#22c55e", "#a21caf", "#f59e42"][
                Math.floor(Math.random() * 4)
              ],
            };
          } catch {
            return null;
          }
        })
      );

      const discoveredWorkers = results
        .filter((r) => r.status === "fulfilled" && r.value !== null)
        .map((r: any) => r.value);

      let addedCount = 0;
      if (discoveredWorkers.length > 0) {
        setWorkers((prev) => {
          const newWorkers = discoveredWorkers.filter(
            (dw) => !prev.some((w) => w.url === dw.url)
          );

          if (newWorkers.length === 0) return prev;

          addedCount = newWorkers.length;
          const updated = [...prev, ...newWorkers];
          localStorage.setItem("workers", JSON.stringify(updated));
          console.log(
            `🔍 Workers descubiertos automáticamente: ${newWorkers.length}`,
            newWorkers
          );

          return updated;
        });

        // Notificar al usuario después de un pequeño delay
        if (addedCount > 0) {
          setTimeout(() => {
            const notification: Notification = {
              id: `worker-scan-${Date.now()}`,
              type: "info",
              title: "Workers detectados",
              message: `Se encontraron ${discoveredWorkers.length} worker(s) disponible(s)`,
              timestamp: new Date(),
            };
            setNotifications((prev) => [notification, ...prev].slice(0, 20));
          }, 500);
        }
      }

      setWorkersScanned(true);
    };

    // Escanear después de un pequeño delay para no bloquear la carga inicial
    const timer = setTimeout(scanWorkers, 2000);
    return () => clearTimeout(timer);
  }, [workersScanned]);

  // ELIMINADO: No forzamos cambios, respetamos la elección del usuario

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Conectar Socket.IO cuando hay usuario autenticado
  useEffect(() => {
    const token = TokenManager.getToken();

    if (!user || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    console.log("🔌 Conectando a Socket.IO:", selectedWorker.url);

    const socket = io(selectedWorker.url, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket.IO conectado");
      setConnected(true);
      setReconnecting(false);
      setError(null);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket.IO desconectado:", reason);
      setConnected(false);

      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Error de conexión Socket.IO:", err.message);
      setError(err.message);
      setConnected(false);
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log(`🔄 Reconectado después de ${attemptNumber} intentos`);
      setReconnecting(false);
      setError(null);
    });

    socket.on("reconnect_attempt", () => {
      setReconnecting(true);
    });

    socket.on("reconnect_error", (err) => {
      console.error("❌ Error al reconectar:", err.message);
      setError(`Error de reconexión: ${err.message}`);
    });

    socket.on("reconnect_failed", () => {
      console.error("❌ Falló la reconexión");
      setError("No se pudo reconectar al servidor");
      setReconnecting(false);
    });

    return () => {
      console.log("🔌 Desconectando Socket.IO");
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [selectedWorker.url, user]);

  useEffect(() => {
    apiClient.setWorker(selectedWorker);
  }, [selectedWorker]);

  const setSelectedWorker = (worker: Worker) => {
    setSelectedWorkerState(worker);
    apiClient.setWorker(worker);
    // Guardar en localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("selectedWorker", JSON.stringify(worker));
    }
  };

  const addWorker = (worker: Worker) => {
    setWorkers((prev) => {
      const updated = [...prev, worker];
      // Guardar en localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("workers", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const removeWorker = (workerId: string) => {
    setWorkers((prev) => {
      const updated = prev.filter((w) => w.id !== workerId);
      // Guardar en localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("workers", JSON.stringify(updated));
      }
      return updated;
    });
    if (selectedWorker.id === workerId && workers.length > 1) {
      const remainingWorkers = workers.filter((w) => w.id !== workerId);
      setSelectedWorker(remainingWorkers[0]);
    }
  };

  const refreshUserData = useCallback(async () => {
    try {
      const data = await apiClient.getMe();
      setUser(data.usuario);
      setAccounts(data.cuentas || []);
      setCards(data.tarjetas || []);
    } catch (error) {
      console.error("Error refreshing user data:", error);
    }
  }, []);

  // Función para agregar notificaciones
  const addNotification = useCallback(
    (type: Notification["type"], title: string, message: string) => {
      const notification: Notification = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        title,
        message,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 20)); // Máximo 20

      // Auto-remover después de 5 segundos
      setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((n) => n.id !== notification.id)
        );
      }, 5000);
    },
    []
  );

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Restaurar sesión al cargar la página
  useEffect(() => {
    const restoreSession = async () => {
      // Migrar tokens antiguos de localStorage
      migrateFromLocalStorage();

      const token = TokenManager.getToken();

      if (token && !user) {
        try {
          // Configurar el token en el cliente API
          apiClient.setToken(token);

          // Obtener datos del usuario
          const data = await apiClient.getMe();
          setUser(data.usuario);
          setAccounts(data.cuentas || []);
          setCards(data.tarjetas || []);

          console.log("✅ Sesión restaurada exitosamente");
        } catch (error) {
          console.error("❌ Error al restaurar sesión:", error);
          // Si el token es inválido, limpiar
          TokenManager.clearSession();
          apiClient.setToken(null);
        }
      }
    };

    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo ejecutar al montar el componente

  // Manejar eventos de Socket.IO en tiempo real
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !connected || !user) return;

    const handleBankingEvent = (event: BankingEvent) => {
      console.log("🔔 Evento bancario recibido:", event);

      // Actualizar datos según el tipo de evento
      switch (event.type) {
        case "CUENTA_ACTUALIZADA": {
          const { cuentaId, saldoNuevo } = event.data;

          if (!cuentaId || saldoNuevo === undefined) break;

          // Actualizar saldo en el state
          setAccounts((prev) =>
            prev.map((acc) =>
              acc.id === cuentaId ? { ...acc, saldo: saldoNuevo } : acc
            )
          );

          addNotification(
            "info",
            "Cuenta Actualizada",
            `El saldo de tu cuenta ha cambiado a $${saldoNuevo.toFixed(2)}`
          );
          break;
        }

        case "TRANSFERENCIA_RECIBIDA": {
          const { monto, cuentaOrigenId } = event.data;

          if (!monto || !cuentaOrigenId) break;

          addNotification(
            "success",
            "Transferencia Recibida",
            `Has recibido $${monto.toFixed(
              2
            )} desde la cuenta ${cuentaOrigenId.substring(0, 8)}...`
          );

          // Refrescar datos completos
          refreshUserData();
          break;
        }

        case "TRANSFERENCIA_ENVIADA": {
          const { monto, cuentaDestinoId } = event.data;

          if (!monto || !cuentaDestinoId) break;

          addNotification(
            "info",
            "Transferencia Enviada",
            `Se enviaron $${monto.toFixed(
              2
            )} a la cuenta ${cuentaDestinoId.substring(0, 8)}...`
          );
          break;
        }

        case "DEPOSITO_REALIZADO": {
          const { monto } = event.data;

          if (!monto) break;

          addNotification(
            "success",
            "Depósito Realizado",
            `Se depositaron $${monto.toFixed(2)} en tu cuenta`
          );

          // Actualizar saldo
          refreshUserData();
          break;
        }

        case "RETIRO_REALIZADO": {
          const { monto } = event.data;

          if (!monto) break;

          addNotification(
            "warning",
            "Retiro Realizado",
            `Se retiraron $${monto.toFixed(2)} de tu cuenta`
          );

          // Actualizar saldo
          refreshUserData();
          break;
        }

        case "USUARIO_AGREGADO": {
          const { cuentaId, usuarioEmail, rol } = event.data;

          if (!cuentaId || !usuarioEmail) break;

          addNotification(
            "success",
            "Nuevo Acceso a Cuenta",
            `${usuarioEmail} fue agregado como ${
              rol || "usuario"
            } a la cuenta ${cuentaId.substring(0, 8)}...`
          );

          // Refrescar cuentas
          refreshUserData();
          break;
        }

        case "USUARIO_REMOVIDO": {
          const { cuentaId, usuarioEmail } = event.data;

          if (!cuentaId || !usuarioEmail) break;

          addNotification(
            "warning",
            "Acceso Removido",
            `${usuarioEmail} fue removido de la cuenta ${cuentaId.substring(
              0,
              8
            )}...`
          );

          // Refrescar cuentas
          refreshUserData();
          break;
        }

        case "TARJETA_CREADA": {
          const { tarjetaId } = event.data;

          if (!tarjetaId) break;

          addNotification(
            "success",
            "Tarjeta Creada",
            `Se creó una nueva tarjeta: ${tarjetaId.substring(0, 8)}...`
          );

          // Refrescar tarjetas
          refreshUserData();
          break;
        }

        case "TARJETA_ESTADO_CAMBIADO": {
          const { tarjetaId, estado } = event.data;

          if (!tarjetaId || !estado) break;

          addNotification(
            "info",
            "Estado de Tarjeta Cambiado",
            `La tarjeta ${tarjetaId.substring(0, 8)}... ahora está ${estado}`
          );

          // Actualizar estado de tarjeta
          setCards((prev) =>
            prev.map((card) =>
              card.id === tarjetaId ? { ...card, estado } : card
            )
          );
          break;
        }

        default:
          console.log("Tipo de evento no manejado:", event.type);
      }
    };

    socket.on("banking-event", handleBankingEvent);

    return () => {
      socket.off("banking-event", handleBankingEvent);
    };
  }, [connected, user, addNotification, refreshUserData]);

  // Sincronizar datos de cuentas entre pestañas cuando hay operaciones
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Detectar operaciones bancarias para refrescar datos
      if (e.key === "banking-operation") {
        const operation = e.newValue ? JSON.parse(e.newValue) : null;
        if (operation && user) {
          // Refrescar datos si la operación afecta al usuario actual
          refreshUserData();
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [user, refreshUserData]);

  // Iniciar monitoreo de actividad y timeout de sesión
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Iniciar monitoreo de actividad del usuario
    const cleanupActivity = ActivityMonitor.start();

    // Configurar callback para sesión expirada
    TokenManager.onSessionExpired(() => {
      console.warn('⏰ Sesión expirada por inactividad');
      
      // Limpiar estado completamente
      setUser(null);
      setAccounts([]);
      setCards([]);
      apiClient.setToken(null);
      
      // Desconectar socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Notificar al usuario
      const notification: Notification = {
        id: `session-expired-${Date.now()}`,
        type: 'warning',
        title: 'Sesión expirada',
        message: 'Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.',
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 20));
      
      // Redirigir a login después de 2 segundos
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }, 2000);
    });

    return cleanupActivity;
  }, []);

  const logout = () => {
    // Limpiar todo el estado
    apiClient.logout();
    TokenManager.clearSession();
    setUser(null);
    setAccounts([]);
    setCards([]);
    
    // Desconectar socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Limpiar notificaciones y eventos
    setNotifications([]);
    setEvents([]);
  };

  const isAuthenticated = user !== null;

  return (
    <AppContext.Provider
      value={{
        selectedWorker,
        setSelectedWorker,
        workers,
        addWorker,
        removeWorker,
        user,
        setUser,
        accounts,
        setAccounts,
        cards,
        setCards,
        isAuthenticated,
        logout,
        refreshUserData,
        // Socket.IO
        socketConnected: connected,
        socketReconnecting: reconnecting,
        socketError: error,
        recentEvents: events,
        clearEvents,
        // Notificaciones
        notifications,
        clearNotifications,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
