"use client";

import { useEffect } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  onClose: (id: string) => void;
}

export default function Toast({
  id,
  type,
  message,
  description,
  duration = 5000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const config = {
    success: {
      icon: CheckCircleIcon,
      bgColor: "bg-green-50",
      borderColor: "border-green-500",
      iconColor: "text-green-600",
      textColor: "text-green-900",
    },
    error: {
      icon: XCircleIcon,
      bgColor: "bg-red-50",
      borderColor: "border-red-500",
      iconColor: "text-red-600",
      textColor: "text-red-900",
    },
    warning: {
      icon: ExclamationTriangleIcon,
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-500",
      iconColor: "text-yellow-600",
      textColor: "text-yellow-900",
    },
    info: {
      icon: InformationCircleIcon,
      bgColor: "bg-blue-50",
      borderColor: "border-blue-500",
      iconColor: "text-blue-600",
      textColor: "text-blue-900",
    },
  };

  const {
    icon: Icon,
    bgColor,
    borderColor,
    iconColor,
    textColor,
  } = config[type];

  return (
    <div
      className={`${bgColor} ${borderColor} border-l-4 rounded-lg shadow-lg p-4 mb-3 animate-slide-in-right`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-6 w-6 ${iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`font-semibold ${textColor}`}>{message}</p>
          {description && (
            <p className={`text-sm ${textColor} mt-1 opacity-90`}>
              {description}
            </p>
          )}
        </div>
        <button
          onClick={() => onClose(id)}
          className={`${textColor} hover:opacity-70 transition-opacity shrink-0`}
          aria-label="Cerrar notificación"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
