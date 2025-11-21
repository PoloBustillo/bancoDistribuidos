"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/api";
import { useRouter } from "next/navigation";
import Spinner from "@/components/ui/Spinner";
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";

export default function MovementsPage() {
  const router = useRouter();
  const { accounts, refreshUserData, user } = useApp();
  const { showSuccess, showError } = useToast();
  const [operation, setOperation] = useState<"deposit" | "withdraw">("deposit");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedAccount = accounts.find((acc) => acc.id === accountId);
  const canProceed = accountId && amount && parseFloat(amount) > 0;
  const hasInsufficientFunds =
    operation === "withdraw" &&
    selectedAccount &&
    parseFloat(amount) > selectedAccount.saldo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceed || hasInsufficientFunds) return;

    setLoading(true);

    try {
      const monto = parseFloat(amount);
      const response =
        operation === "deposit"
          ? await apiClient.deposit(accountId, monto)
          : await apiClient.withdraw(accountId, monto);

      const operationType = operation === "deposit" ? "Depósito" : "Retiro";
      showSuccess(
        `${operationType} exitoso`,
        response.mensaje ||
          `Se procesó el ${operationType.toLowerCase()} de $${monto.toFixed(2)}`
      );

      // Emitir evento para sincronizar
      localStorage.setItem(
        "banking-operation",
        JSON.stringify({
          type: operation,
          accountId,
          timestamp: Date.now(),
        })
      );
      setTimeout(() => localStorage.removeItem("banking-operation"), 100);

      await refreshUserData();
      setAmount("");
    } catch (error) {
      showError(
        "Error en la operación",
        (error as Error).message || "No se pudo completar la transacción"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <p className="text-gray-600">
            Por favor inicia sesión para realizar movimientos
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors"
          >
            <ArrowLeftIcon className="w-6 h-6 text-gray-700" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Movimientos</h1>
            <p className="text-gray-600">
              Deposita o retira dinero de tus cuentas
            </p>
          </div>
        </div>

        {/* Operation Toggle */}
        <div className="bg-white rounded-2xl shadow-xl p-2 mb-6 flex gap-2">
          <button
            onClick={() => setOperation("deposit")}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
              operation === "deposit"
                ? "bg-linear-to-r from-green-600 to-emerald-600 text-white shadow-md"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Depósito
          </button>
          <button
            onClick={() => setOperation("withdraw")}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
              operation === "withdraw"
                ? "bg-linear-to-r from-orange-600 to-red-600 text-white shadow-md"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <ArrowUpTrayIcon className="w-5 h-5" />
            Retiro
          </button>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {operation === "deposit"
                ? "Realizar Depósito"
                : "Realizar Retiro"}
            </h2>
            <p className="text-gray-600">
              {operation === "deposit"
                ? "Ingresa dinero a tu cuenta de forma segura"
                : "Retira dinero disponible de tu cuenta"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecciona la cuenta
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm hover:border-gray-400 transition-colors text-gray-900"
                required
              >
                <option value="">Elige una cuenta</option>
                {accounts
                  .filter((acc) => acc.estado === "ACTIVA")
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.nombre} - {account.numeroCuenta} ($
                      {account.saldo.toFixed(2)})
                    </option>
                  ))}
              </select>
              {selectedAccount && (
                <p className="mt-2 text-sm text-gray-600">
                  Saldo actual:{" "}
                  <span className="font-semibold">
                    ${selectedAccount.saldo.toFixed(2)}
                  </span>
                </p>
              )}
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500 text-lg">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm hover:border-gray-400 transition-colors text-lg placeholder:text-gray-600 placeholder:font-normal text-gray-900"
                  required
                />
              </div>
              {hasInsufficientFunds && (
                <p className="mt-2 text-sm text-red-600">
                  Fondos insuficientes para realizar este retiro
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!canProceed || hasInsufficientFunds || loading}
              className={`w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                operation === "deposit"
                  ? "bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                  : "bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
              }`}
            >
              {loading ? (
                <>
                  <Spinner size="sm" color="border-white" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  {operation === "deposit" ? (
                    <>
                      <ArrowDownTrayIcon className="w-5 h-5" />
                      Depositar
                    </>
                  ) : (
                    <>
                      <ArrowUpTrayIcon className="w-5 h-5" />
                      Retirar
                    </>
                  )}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Info Card */}
        <div
          className={`mt-6 rounded-lg p-4 ${
            operation === "deposit"
              ? "bg-green-50 border border-green-200"
              : "bg-orange-50 border border-orange-200"
          }`}
        >
          <p
            className={`text-sm ${
              operation === "deposit" ? "text-green-800" : "text-orange-800"
            }`}
          >
            <strong>Nota:</strong>{" "}
            {operation === "deposit"
              ? "Los depósitos se reflejan inmediatamente en tu cuenta."
              : "Los retiros están sujetos al saldo disponible en tu cuenta."}
          </p>
        </div>
      </div>
    </div>
  );
}
