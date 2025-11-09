'use client';

import { useApp } from '@/context/AppContext';
import { SignalIcon, SignalSlashIcon } from '@heroicons/react/24/outline';

export default function ConnectionStatus() {
  const { socketConnected, socketReconnecting, socketError } = useApp();

  if (!socketConnected && !socketReconnecting) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <SignalSlashIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
        <span className="text-xs font-medium text-red-700 dark:text-red-400">
          Desconectado
        </span>
        {socketError && (
          <span className="text-xs text-red-600 dark:text-red-500">
            ({socketError})
          </span>
        )}
      </div>
    );
  }

  if (socketReconnecting) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="animate-spin h-4 w-4 border-2 border-yellow-600 border-t-transparent rounded-full" />
        <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
          Reconectando...
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div className="relative">
        <SignalIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      </div>
      <span className="text-xs font-medium text-green-700 dark:text-green-400">
        Tiempo Real Activo
      </span>
    </div>
  );
}
