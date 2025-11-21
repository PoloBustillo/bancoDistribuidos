"use client";

import { ReactNode } from "react";
import {
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: "warning" | "danger" | "info";
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  type = "warning",
  loading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const typeConfig = {
    warning: {
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      iconColor: "text-yellow-600",
      buttonColor: "bg-yellow-600 hover:bg-yellow-700",
    },
    danger: {
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      iconColor: "text-red-600",
      buttonColor: "bg-red-600 hover:bg-red-700",
    },
    info: {
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      iconColor: "text-blue-600",
      buttonColor: "bg-blue-600 hover:bg-blue-700",
    },
  };

  const config = typeConfig[type];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-9999 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
      >
        <div className="flex items-start gap-4 mb-4">
          <div
            className={`${config.bgColor} ${config.borderColor} border-2 p-3 rounded-full shrink-0`}
          >
            <ExclamationTriangleIcon
              className={`w-6 h-6 ${config.iconColor}`}
            />
          </div>
          <div className="flex-1">
            <h3
              id="dialog-title"
              className="text-xl font-bold text-gray-900 mb-2"
            >
              {title}
            </h3>
            <div id="dialog-message" className="text-gray-600">
              {message}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar"
            disabled={loading}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-3 ${config.buttonColor} text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? "Procesando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
