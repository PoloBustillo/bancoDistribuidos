"use client";

import { Account } from "@/types";
import { useState } from "react";
import { apiClient } from "@/lib/api";
import { useApp } from "@/context/AppContext";

interface AccountCardProps {
  account: Account;
}

export default function AccountCard({ account }: AccountCardProps) {
  const { refreshUserData } = useApp();
  const [showShare, setShowShare] = useState(false);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"TITULAR" | "AUTORIZADO" | "CONSULTA">(
    "AUTORIZADO"
  );
  const [sharing, setSharing] = useState(false);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setSharing(true);
    try {
      await apiClient.shareAccount(account.id, email, rol);

      // Emitir evento para sincronizar con otras pestañas
      localStorage.setItem(
        "banking-operation",
        JSON.stringify({
          type: "share",
          accountId: account.id,
          timestamp: Date.now(),
        })
      );
      setTimeout(() => localStorage.removeItem("banking-operation"), 100);

      await refreshUserData();
      setEmail("");
      setShowShare(false);
    } catch (error) {
      console.error("Error sharing account:", error);
      alert((error as Error).message);
    } finally {
      setSharing(false);
    }
  };

  const typeColors = {
    CHEQUES: "bg-blue-500/20 text-blue-400 border-blue-500",
    DEBITO: "bg-green-500/20 text-green-400 border-green-500",
    CREDITO: "bg-purple-500/20 text-purple-400 border-purple-500",
  };

  const roleColors = {
    TITULAR: "bg-yellow-500/20 text-yellow-400 border-yellow-500",
    AUTORIZADO: "bg-blue-500/20 text-blue-400 border-blue-500",
    CONSULTA: "bg-gray-500/20 text-gray-400 border-gray-500",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-200 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-lg font-bold text-gray-900">{account.nombre}</h4>
          <p className="text-sm text-gray-500 font-mono">
            {account.numeroCuenta}
          </p>
        </div>
        <div className="flex gap-2">
          <span
            className={`px-2 py-1 text-xs font-medium rounded border ${
              typeColors[account.tipoCuenta]
            }`}
          >
            {account.tipoCuenta}
          </span>
          {account.rol && (
            <span
              className={`px-2 py-1 text-xs font-medium rounded border ${
                roleColors[account.rol]
              }`}
            >
              {account.rol}
            </span>
          )}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-500">Saldo</p>
        <p className="text-3xl font-bold text-gray-900">
          ${account.saldo.toFixed(2)}
        </p>
      </div>

      {account.rol === "TITULAR" && (
        <div className="space-y-2">
          <button
            onClick={() => setShowShare(!showShare)}
            className="w-full px-4 py-2 bg-blue-50 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm"
          >
            {showShare ? "✕ Cancelar" : "👥 Compartir Cuenta"}
          </button>

          {showShare && (
            <form
              onSubmit={handleShare}
              className="space-y-3 mt-3 p-3 bg-blue-50 rounded-lg"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo del usuario"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:border-blue-500"
                required
              />
              <select
                value={rol}
                onChange={(e) =>
                  setRol(
                    e.target.value as "TITULAR" | "AUTORIZADO" | "CONSULTA"
                  )
                }
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="TITULAR">TITULAR (Acceso completo)</option>
                <option value="AUTORIZADO">
                  AUTORIZADO (Solo operaciones)
                </option>
                <option value="CONSULTA">CONSULTA (Solo lectura)</option>
              </select>
              <button
                type="submit"
                disabled={sharing}
                className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors disabled:opacity-50"
              >
                {sharing ? "Compartiendo..." : "Compartir"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
