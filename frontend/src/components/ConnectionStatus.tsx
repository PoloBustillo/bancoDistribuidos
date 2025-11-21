"use client";

import { useApp } from "@/context/AppContext";
import { SignalIcon, SignalSlashIcon } from "@heroicons/react/24/outline";

export default function ConnectionStatus() {
  const { socketConnected, socketReconnecting, socketError } = useApp();

  if (!socketConnected && !socketReconnecting) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border-2 border-red-300 rounded-lg shadow-sm">
        <SignalSlashIcon className="h-4 w-4 text-red-600" />
        <span className="text-xs font-semibold text-red-700">Desconectado</span>
        {socketError && (
          <span className="text-xs text-red-600 font-medium">
            ({socketError})
          </span>
        )}
      </div>
    );
  }

  if (socketReconnecting) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border-2 border-yellow-300 rounded-lg shadow-sm">
        <div className="animate-spin h-4 w-4 border-2 border-yellow-600 border-t-transparent rounded-full" />
        <span className="text-xs font-semibold text-yellow-700">
          Reconectando...
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border-2 border-green-300 rounded-lg shadow-sm">
      <div className="relative">
        <SignalIcon className="h-4 w-4 text-green-600" />
        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      </div>
      <span className="text-xs font-semibold text-green-700">
        Tiempo Real Activo
      </span>
    </div>
  );
}
