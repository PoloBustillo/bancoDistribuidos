import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

export interface BankingEvent {
  type: string;
  timestamp: Date;
  workerId: string;
  data: Record<string, unknown>;
}

interface UseSocketReturn {
  connected: boolean;
  reconnecting: boolean;
  error: string | null;
  events: BankingEvent[];
  clearEvents: () => void;
}

export function useSocket(
  workerUrl: string,
  token: string | null
): UseSocketReturn {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<BankingEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Limpiar eventos
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    // Si no hay token, no conectamos
    if (!token || !workerUrl) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    console.log("🔌 Conectando a Socket.IO:", workerUrl);

    // Crear nueva conexión Socket.IO
    const newSocket = io(workerUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = newSocket;

    // Eventos de conexión
    newSocket.on("connect", () => {
      console.log("✅ Socket.IO conectado");
      setConnected(true);
      setReconnecting(false);
      setError(null);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("❌ Socket.IO desconectado:", reason);
      setConnected(false);

      if (reason === "io server disconnect") {
        // El servidor forzó la desconexión, intentar reconectar manualmente
        setError("Desconectado por el servidor");
        newSocket.connect();
      }
    });

    newSocket.on("connect_error", (err) => {
      console.error("❌ Error de conexión Socket.IO:", err.message);
      setError(err.message);
      setConnected(false);
    });

    newSocket.on("reconnect", (attemptNumber) => {
      console.log(`🔄 Reconectado después de ${attemptNumber} intentos`);
      setReconnecting(false);
      setError(null);
    });

    newSocket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`🔄 Intento de reconexión #${attemptNumber}`);
      setReconnecting(true);
    });

    newSocket.on("reconnect_error", (err) => {
      console.error("❌ Error al reconectar:", err.message);
      setError(`Error de reconexión: ${err.message}`);
    });

    newSocket.on("reconnect_failed", () => {
      console.error("❌ Falló la reconexión después de todos los intentos");
      setError("No se pudo reconectar al servidor");
      setReconnecting(false);
    });

    // Escuchar eventos bancarios
    newSocket.on("banking-event", (event: BankingEvent) => {
      console.log("📡 Evento recibido:", event.type, event);

      // Agregar al historial de eventos
      setEvents((prev) => [event, ...prev].slice(0, 50)); // Mantener últimos 50
    });

    // Cleanup al desmontar
    return () => {
      console.log("🔌 Desconectando Socket.IO");
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [workerUrl, token]);

  return {
    connected,
    reconnecting,
    error,
    events,
    clearEvents,
  };
}
