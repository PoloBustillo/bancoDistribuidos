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

const defaultWorkers: Worker[] = [
  {
    id: "worker1",
    name: "Worker 1",
    url: "http://localhost:3001",
    color: "bg-blue-500",
  },
  {
    id: "worker2",
    name: "Worker 2",
    url: "http://localhost:3002",
    color: "bg-green-500",
  },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [workers, setWorkers] = useState<Worker[]>(defaultWorkers);
  const [selectedWorker, setSelectedWorkerState] = useState<Worker>(
    defaultWorkers[0]
  );
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

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Conectar Socket.IO cuando hay usuario autenticado
  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

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
  };

  const addWorker = (worker: Worker) => {
    setWorkers((prev) => [...prev, worker]);
  };

  const removeWorker = (workerId: string) => {
    setWorkers((prev) => prev.filter((w) => w.id !== workerId));
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
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

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
          localStorage.removeItem("token");
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

  const logout = () => {
    apiClient.logout();
    setUser(null);
    setAccounts([]);
    setCards([]);
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
