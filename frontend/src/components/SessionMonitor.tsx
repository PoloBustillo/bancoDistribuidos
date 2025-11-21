"use client";

import { useState, useEffect } from "react";
import { TokenManager } from "@/lib/auth";
import { ClockIcon } from "@heroicons/react/24/outline";

export default function SessionMonitor() {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = TokenManager.getSessionTimeRemaining();
      setTimeRemaining(remaining);

      // Mostrar advertencia cuando quedan menos de 5 minutos
      const fiveMinutes = 5 * 60 * 1000;
      setShowWarning(remaining > 0 && remaining < fiveMinutes);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (timeRemaining === 0 || !TokenManager.hasActiveSession()) {
    return null;
  }

  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  // Solo mostrar cuando hay advertencia
  if (!showWarning) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 rounded-lg shadow-lg p-4 max-w-sm ${
        minutes < 2
          ? "bg-red-50 border-2 border-red-300"
          : "bg-amber-50 border-2 border-amber-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <ClockIcon
          className={`w-6 h-6 shrink-0 ${
            minutes < 2 ? "text-red-600" : "text-amber-600"
          }`}
        />
        <div className="flex-1">
          <h3
            className={`font-semibold text-sm ${
              minutes < 2 ? "text-red-900" : "text-amber-900"
            }`}
          >
            {minutes < 2 ? "⚠️ Sesión por expirar" : "Sesión inactiva"}
          </h3>
          <p
            className={`text-sm mt-1 ${
              minutes < 2 ? "text-red-800" : "text-amber-800"
            }`}
          >
            Tu sesión expirará en{" "}
            <span className="font-mono font-bold">
              {minutes}:{seconds.toString().padStart(2, "0")}
            </span>
          </p>
          <p
            className={`text-xs mt-2 ${
              minutes < 2 ? "text-red-700" : "text-amber-700"
            }`}
          >
            Realiza cualquier acción para mantener tu sesión activa.
          </p>
        </div>
      </div>
    </div>
  );
}
