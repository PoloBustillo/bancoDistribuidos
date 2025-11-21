"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { apiClient } from "@/lib/api";

interface VerificationCodeResponse {
  codigo: string;
  expiresAt: string;
  expiresIn: number;
}

export function VerificationCode() {
  const { selectedWorker } = useApp();
  const [codigo, setCodigo] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (expiresIn === null || expiresIn <= 0) {
      if (expiresIn === 0) {
        setCodigo(null);
      }
      return;
    }

    const interval = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev === null || prev <= 1) {
          setCodigo(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresIn]);

  const generarCodigo = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = apiClient.getToken();
      if (!token) {
        throw new Error("Debes iniciar sesión primero");
      }

      const response = await fetch(
        `${selectedWorker.url}/api/client/verification-code`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || "Error al generar código");
      }

      const data: VerificationCodeResponse = await response.json();
      setCodigo(data.codigo);
      setExpiresIn(data.expiresIn);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center">
          <span className="text-white text-xl">👤</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-800">
          Verificación para Asesor
        </h2>
      </div>

      {!codigo ? (
        <div className="text-center space-y-4">
          <p className="text-gray-600 leading-relaxed">
            Genera un código temporal para que un asesor bancario pueda acceder
            a tu información de forma segura.
          </p>
          <button
            onClick={generarCodigo}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Generando...
              </span>
            ) : (
              "🔐 Generar Código de Verificación"
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-6 text-center shadow-xl">
            <p className="text-purple-100 text-sm mb-2 font-medium">
              Tu código de verificación:
            </p>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-3">
              <p className="text-5xl font-bold text-white tracking-[0.5em] font-mono">
                {codigo}
              </p>
            </div>
            <p className="text-purple-100 text-sm">
              Expira en:{" "}
              <span className="font-bold text-lg text-white">
                {expiresIn !== null ? formatTime(expiresIn) : "--:--"}
              </span>
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <span>ℹ️</span>
              Instrucciones:
            </h3>
            <ol className="space-y-2 text-sm text-blue-800">
              <li className="flex gap-2">
                <span className="font-bold">1.</span>
                <span>Proporciona este código al asesor bancario</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">2.</span>
                <span>
                  El asesor también necesitará los últimos 4 dígitos de tu
                  tarjeta/cuenta
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">3.</span>
                <span>El código es válido por 10 minutos y de un solo uso</span>
              </li>
            </ol>
          </div>

          <button
            onClick={generarCodigo}
            disabled={loading}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-all duration-300"
          >
            🔄 Generar Nuevo Código
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
