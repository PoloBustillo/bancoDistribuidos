'use client';

import { useApp } from '@/context/AppContext';
import { useEffect, useState } from 'react';
import { 
  CheckCircleIcon, 
  InformationCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';

export default function NotificationCenter() {
  const { notifications, clearNotifications } = useApp();
  const [visible, setVisible] = useState<string[]>([]);

  useEffect(() => {
    // Animar entrada de nuevas notificaciones
    notifications.forEach((notification) => {
      if (!visible.includes(notification.id)) {
        setTimeout(() => {
          setVisible((prev) => [...prev, notification.id]);
        }, 100);
      }
    });
  }, [notifications, visible]);

  const removeNotification = (id: string) => {
    setVisible((prev) => prev.filter((nid) => nid !== id));
  };

  if (notifications.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'info':
        return <InformationCircleIcon className="h-6 w-6 text-blue-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />;
      case 'error':
        return <XCircleIcon className="h-6 w-6 text-red-500" />;
      default:
        return <InformationCircleIcon className="h-6 w-6 text-gray-500" />;
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-green-500';
      case 'info':
        return 'border-blue-500';
      case 'warning':
        return 'border-yellow-500';
      case 'error':
        return 'border-red-500';
      default:
        return 'border-gray-500';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            transform transition-all duration-300 ease-in-out
            ${visible.includes(notification.id) ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            bg-white dark:bg-gray-800 rounded-lg shadow-lg border-l-4 
            ${getBorderColor(notification.type)}
            p-4 flex items-start gap-3
          `}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(notification.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {notification.title}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {notification.message}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {new Date(notification.timestamp).toLocaleTimeString()}
            </p>
          </div>

          <button
            onClick={() => removeNotification(notification.id)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      ))}

      {notifications.length > 1 && (
        <button
          onClick={clearNotifications}
          className="w-full text-center py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 rounded-lg shadow-lg"
        >
          Limpiar todas
        </button>
      )}
    </div>
  );
}
