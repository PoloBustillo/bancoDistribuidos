"use client";

import { useApp } from "@/context/AppContext";
import AccountCard from "./AccountCard";
import BankingOperations from "./BankingOperations";
import ConnectionStatus from "./ConnectionStatus";
import { VerificationModal } from "./VerificationModal";
import { useState } from "react";
import { apiClient } from "@/lib/api";

export default function Dashboard() {
  const { user, accounts, cards, logout, refreshUserData } = useApp();
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [accountType, setAccountType] = useState<
    "CHEQUES" | "DEBITO" | "CREDITO"
  >("CHEQUES");
  const [accountName, setAccountName] = useState("");

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAccount(true);
    try {
      await apiClient.createAdditionalAccount(accountType, accountName);

      // Emitir evento para sincronizar con otras pestañas
      localStorage.setItem(
        "banking-operation",
        JSON.stringify({
          type: "create-account",
          timestamp: Date.now(),
        })
      );
      setTimeout(() => localStorage.removeItem("banking-operation"), 100);

      await refreshUserData();
      setAccountName("");
    } catch (error) {
      console.error("Error creating account:", error);
    } finally {
      setCreatingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
  <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {user?.nombre}
                </h2>
                <p className="text-gray-400">{user?.email}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {accounts.length} cuenta{accounts.length !== 1 ? "s" : ""} •{" "}
                  {cards.length} tarjeta{cards.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="ml-4">
                <ConnectionStatus />
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto min-w-0">
            <button
              onClick={() => setShowVerificationModal(true)}
              className="w-full sm:w-auto min-w-0 px-4 py-2 bg-purple-500/20 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
              aria-label="Atención con Asesor"
            >
              <span>👤</span>
              <span className="truncate">Atención con Asesor</span>
            </button>
            <button
              onClick={logout}
              className="w-full sm:w-auto min-w-0 px-4 py-2 bg-red-500/20 border border-red-500 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
              aria-label="Cerrar Sesión"
            >
              <span className="truncate">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>

      {/* Accounts Grid */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Tus Cuentas</h3>
        </div>

        {accounts.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
            No se encontraron cuentas
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </div>

      {/* Create Additional Account */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">
          ➕ Crear Cuenta Adicional
        </h3>
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipo de Cuenta
              </label>
              <select
                value={accountType}
                onChange={(e) =>
                  setAccountType(
                    e.target.value as "CHEQUES" | "DEBITO" | "CREDITO"
                  )
                }
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="CHEQUES">Cheques</option>
                <option value="DEBITO">Débito</option>
                <option value="CREDITO">Crédito</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nombre de Cuenta (Opcional)
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="ej: Ahorros USD"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={creatingAccount}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {creatingAccount ? "Creando..." : "Crear Cuenta"}
          </button>
        </form>
      </div>

      {/* Banking Operations */}
      <BankingOperations />

      {/* Verification Modal */}
      <VerificationModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
      />
    </div>
  );
}
