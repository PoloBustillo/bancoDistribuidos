"use client";

import { useApp } from "@/context/AppContext";
import { useState } from "react";

export default function DemoModeToggle() {
  const { demoMode, setDemoMode } = useApp();
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <div className="bg-linear-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🎓</div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              Modo Demostración
              <button
                onClick={() => setShowExplanation(!showExplanation)}
                className="text-purple-600 hover:text-purple-700 text-sm"
                title="¿Qué es esto?"
              >
                ℹ️
              </button>
            </h3>
            <p className="text-sm text-gray-600">
              {demoMode
                ? "Operaciones con latencia simulada"
                : "Operaciones en tiempo real"}
            </p>
          </div>
        </div>

        <button
          onClick={() => setDemoMode(!demoMode)}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
            demoMode ? "bg-purple-600" : "bg-gray-300"
          }`}
          role="switch"
          aria-checked={demoMode}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out ${
              demoMode ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {showExplanation && (
        <div className="mt-4 pt-4 border-t border-purple-200">
          <div className="space-y-2 text-sm text-gray-700">
            <p className="font-medium text-purple-900">
              ¿Para qué sirve el Modo Demostración?
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong>Visualización educativa:</strong> Agrega delays
                aleatorios a las operaciones bancarias
              </li>
              <li>
                <strong>Locks distribuidos:</strong> Permite ver mejor cómo
                funciona el sistema de colas
              </li>
              <li>
                <strong>Sin reiniciar:</strong> Se activa/desactiva en tiempo
                real, sin necesidad de deployment
              </li>
            </ul>
            <div className="mt-3 p-2 bg-purple-100 rounded text-xs">
              <strong>Delays aplicados:</strong>
              <br />
              • Transferencias: 1-4 segundos
              <br />• Depósitos/Retiros: 0.5-2.5 segundos
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
