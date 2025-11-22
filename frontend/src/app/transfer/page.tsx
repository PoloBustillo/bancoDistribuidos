"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/api";
import { useRouter } from "next/navigation";
import Spinner from "@/components/ui/Spinner";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  isValidAmount,
  sanitizeAmountInput,
  getAmountErrorMessage,
  isValidAccountNumber,
  getAccountNumberErrorMessage,
  formatAccountNumber,
} from "@/lib/validation";
import {
  ArrowLeftIcon,
  ArrowRightCircleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

export default function TransferPage() {
  return (
    <ProtectedRoute>
      <TransferContent />
    </ProtectedRoute>
  );
}

function TransferContent() {
  const router = useRouter();
  const { accounts, user, refreshUserData } = useApp();
  const { showSuccess, showError } = useToast();
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountNumber, setToAccountNumber] = useState("");
  const [accountNumberError, setAccountNumberError] = useState("");
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const selectedAccount = accounts.find((acc) => acc.id === fromAccountId);
  const canProceed =
    fromAccountId &&
    toAccountNumber &&
    isValidAccountNumber(toAccountNumber) &&
    amount &&
    isValidAmount(amount) &&
    !amountError &&
    !accountNumberError;

  const handleShowConfirmation = (e: React.FormEvent) => {
    e.preventDefault();

    // Validar monto
    if (!isValidAmount(amount)) {
      setAmountError(getAmountErrorMessage(amount) || "Monto inválido");
      return;
    }

    if (canProceed) {
      setShowConfirmation(true);
    }
  };

  const handleConfirmTransfer = async () => {
    setLoading(true);

    try {
      const response = await apiClient.transfer(
        fromAccountId,
        toAccountNumber,
        parseFloat(amount)
      );

      showSuccess(
        "Transferencia exitosa",
        response.mensaje ||
          `Se transfirió $${parseFloat(amount).toFixed(2)} correctamente`
      );

      // Emitir evento para sincronizar
      localStorage.setItem(
        "banking-operation",
        JSON.stringify({
          type: "transfer",
          accountId: fromAccountId,
          timestamp: Date.now(),
        })
      );
      setTimeout(() => localStorage.removeItem("banking-operation"), 100);

      await refreshUserData();

      // Reset form
      setFromAccountId("");
      setToAccountNumber("");
      setAmount("");
      setDescription("");
      setShowConfirmation(false);
    } catch (error) {
      showError(
        "Error en la transferencia",
        (error as Error).message || "No se pudo completar la transferencia"
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
            Por favor inicia sesión para realizar transferencias
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
            <h1 className="text-3xl font-bold text-gray-900">Transferencias</h1>
            <p className="text-gray-600">
              Envía dinero a otras cuentas de forma segura
            </p>
          </div>
        </div>

        {/* Main Form Card */}
        {!showConfirmation ? (
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            <form onSubmit={handleShowConfirmation} className="space-y-6">
              {/* From Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Desde la cuenta
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm hover:border-gray-400 transition-colors text-gray-900"
                  required
                >
                  <option value="">Selecciona una cuenta</option>
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
                    Saldo disponible:{" "}
                    <span className="font-semibold">
                      ${selectedAccount.saldo.toFixed(2)}
                    </span>
                  </p>
                )}
              </div>

              {/* To Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Para la cuenta
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={toAccountNumber}
                    onChange={(e) => {
                      setToAccountNumber(e.target.value);
                      setAccountNumberError("");
                    }}
                    onBlur={(e) => {
                      const val = e.target.value;
                      if (val && !isValidAccountNumber(val)) {
                        setAccountNumberError(
                          getAccountNumberErrorMessage(val) || "Número de cuenta inválido"
                        );
                      }
                    }}
                    placeholder="Ej: 1234-5678-90 o 1234567890"
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 bg-white shadow-sm transition-colors placeholder:text-gray-400 text-gray-900 ${
                      accountNumberError
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                        : toAccountNumber && isValidAccountNumber(toAccountNumber)
                        ? "border-green-500 focus:border-green-500 focus:ring-green-500"
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500 hover:border-gray-400"
                    }`}
                    required
                  />
                  {toAccountNumber && isValidAccountNumber(toAccountNumber) && !accountNumberError && (
                    <CheckCircleIcon className="absolute right-3 top-3 w-6 h-6 text-green-500" />
                  )}
                </div>
                {accountNumberError && (
                  <p className="mt-2 text-sm text-red-600">{accountNumberError}</p>
                )}
                {!accountNumberError && toAccountNumber && (
                  <p className="mt-2 text-xs text-gray-500">
                    ✓ Número de cuenta válido: {formatAccountNumber(toAccountNumber)}
                  </p>
                )}
                {!toAccountNumber && (
                  <p className="mt-2 text-xs text-gray-500">
                    Ingresa el número de cuenta del destinatario (puede incluir guiones)
                  </p>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-gray-500 text-lg">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      setAmount(sanitizeAmountInput(e.target.value));
                      setAmountError("");
                    }}
                    onBlur={(e) => {
                      const val = e.target.value;
                      if (val && !isValidAmount(val)) {
                        setAmountError(
                          getAmountErrorMessage(val) || "Monto inválido"
                        );
                      }
                    }}
                    placeholder="0.00"
                    className={`w-full pl-8 pr-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white shadow-sm transition-colors text-lg placeholder:text-gray-600 placeholder:font-normal text-gray-900 ${
                      amountError
                        ? "border-red-500 focus:border-red-500"
                        : "border-gray-300 focus:border-blue-500 hover:border-gray-400"
                    }`}
                    required
                  />
                </div>
                {amountError && (
                  <p className="mt-2 text-sm text-red-600">{amountError}</p>
                )}
                {selectedAccount &&
                  amount &&
                  parseFloat(amount) > selectedAccount.saldo && (
                    <p className="mt-2 text-sm text-red-600">
                      Fondos insuficientes
                    </p>
                  )}
              </div>

              {/* Description (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Concepto de la transferencia"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm hover:border-gray-400 transition-colors placeholder:text-gray-400 text-gray-900 font-medium"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  !canProceed ||
                  (selectedAccount &&
                    parseFloat(amount) > selectedAccount.saldo)
                }
                className="w-full bg-linear-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <ArrowRightCircleIcon className="w-5 h-5" />
                Continuar
              </button>
            </form>
          </div>
        ) : (
          /* Confirmation Card */
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Confirmar Transferencia
            </h2>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center py-4 border-b-2 border-gray-200">
                <span className="text-sm font-medium text-gray-700">Desde:</span>
                <span className="font-semibold text-gray-900 text-lg">{selectedAccount?.nombre}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b-2 border-gray-200">
                <span className="text-sm font-medium text-gray-700">Cuenta origen:</span>
                <span className="font-mono font-semibold text-gray-900 text-base">
                  {selectedAccount?.numeroCuenta}
                </span>
              </div>
              <div className="flex justify-between items-center py-4 border-b-2 border-gray-200">
                <span className="text-sm font-medium text-gray-700">Cuenta destino:</span>
                <span className="font-mono font-semibold text-gray-900 text-base">{toAccountNumber}</span>
              </div>
              <div className="flex justify-between items-center py-4 bg-blue-50 rounded-lg px-4 border-2 border-blue-200">
                <span className="text-sm font-medium text-gray-700">Monto a transferir:</span>
                <span className="text-3xl font-bold text-blue-600">
                  ${parseFloat(amount).toFixed(2)}
                </span>
              </div>
              {description && (
                <div className="flex justify-between items-center py-4 border-b-2 border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Descripción:</span>
                  <span className="font-medium text-gray-900">{description}</span>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={loading}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmTransfer}
                disabled={loading}
                className="flex-1 bg-linear-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" color="border-white" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  "Confirmar Transferencia"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
