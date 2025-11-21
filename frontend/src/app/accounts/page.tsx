"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/api";
import { useRouter } from "next/navigation";
import Spinner from "@/components/ui/Spinner";
import {
  ArrowLeftIcon,
  PlusCircleIcon,
  UserGroupIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { Account, AccountUser } from "@/types";

export default function AccountsPage() {
  const router = useRouter();
  const { accounts, refreshUserData } = useApp();
  const { showSuccess, showError } = useToast();
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [accountUsers, setAccountUsers] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Create account form
  const [newAccountType, setNewAccountType] = useState<
    "CHEQUES" | "DEBITO" | "CREDITO"
  >("CHEQUES");
  const [newAccountName, setNewAccountName] = useState("");

  // Share account form
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<"AUTORIZADO" | "CONSULTA">(
    "AUTORIZADO"
  );

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.createAdditionalAccount(newAccountType, newAccountName);
      showSuccess(
        "Cuenta creada",
        `Se creó exitosamente la cuenta ${newAccountName}`
      );
      await refreshUserData();

      setShowCreateModal(false);
      setNewAccountName("");
      setNewAccountType("CHEQUES");
    } catch (error) {
      showError(
        "Error al crear cuenta",
        (error as Error).message || "No se pudo crear la cuenta"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLoadAccountUsers = async (account: Account) => {
    setSelectedAccount(account);
    setShowShareModal(true);
    setLoadingUsers(true);

    try {
      const usersResponse = await apiClient.getAccountUsers(account.id);
      setAccountUsers(
        Array.isArray(usersResponse.usuarios) ? usersResponse.usuarios : []
      );
    } catch (error) {
      console.error("Error loading account users:", error);
      showError(
        "Error al cargar usuarios",
        "No se pudieron cargar los usuarios de la cuenta"
      );
      setAccountUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleShareAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    setLoading(true);

    try {
      await apiClient.shareAccount(selectedAccount.id, shareEmail, shareRole);
      showSuccess(
        "Usuario agregado",
        `Se compartió la cuenta con ${shareEmail} como ${shareRole}`
      );
      // Reload users
      const usersResponse = await apiClient.getAccountUsers(selectedAccount.id);
      setAccountUsers(
        Array.isArray(usersResponse.usuarios) ? usersResponse.usuarios : []
      );
      setShareEmail("");
    } catch (error) {
      showError(
        "Error al compartir cuenta",
        (error as Error).message || "No se pudo agregar el usuario"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!selectedAccount || !confirm("¿Estás seguro de remover este usuario?"))
      return;

    try {
      await apiClient.removeUserFromAccount(selectedAccount.id, userId);
      showSuccess(
        "Usuario removido",
        "Se eliminó el acceso del usuario a la cuenta"
      );
      const usersResponse = await apiClient.getAccountUsers(selectedAccount.id);
      setAccountUsers(
        Array.isArray(usersResponse.usuarios) ? usersResponse.usuarios : []
      );
    } catch (error) {
      showError(
        "Error al remover usuario",
        (error as Error).message || "No se pudo remover el usuario"
      );
    }
  };

  const getAccountTypeColor = (tipo: string) => {
    switch (tipo) {
      case "CHEQUES":
        return "bg-blue-100 text-blue-800";
      case "DEBITO":
        return "bg-green-100 text-green-800";
      case "CREDITO":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getAccountTypeLabel = (tipo: string) => {
    switch (tipo) {
      case "CHEQUES":
        return "Cuenta de Cheques";
      case "DEBITO":
        return "Cuenta de Débito";
      case "CREDITO":
        return "Cuenta de Crédito";
      default:
        return tipo;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="p-2 rounded-lg hover:bg-white/50 transition-colors"
            >
              <ArrowLeftIcon className="w-6 h-6 text-gray-700" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mis Cuentas</h1>
              <p className="text-gray-600">Administra tus cuentas bancarias</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-linear-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2"
          >
            <PlusCircleIcon className="w-5 h-5" />
            Nueva Cuenta
          </button>
        </div>

        {/* Accounts Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getAccountTypeColor(
                      account.tipoCuenta
                    )}`}
                  >
                    {getAccountTypeLabel(account.tipoCuenta)}
                  </span>
                  {account.rol && (
                    <span className="ml-2 inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {account.rol}
                    </span>
                  )}
                </div>
                {account.estado === "BLOQUEADA" && (
                  <LockClosedIcon className="w-5 h-5 text-red-500" />
                )}
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {account.nombre}
              </h3>
              <p className="text-sm text-gray-600 font-mono mb-4">
                {account.numeroCuenta}
              </p>

              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-1">Saldo disponible</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${account.saldo.toFixed(2)}
                </p>
              </div>

              <button
                onClick={() => handleLoadAccountUsers(account)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <UserGroupIcon className="w-5 h-5" />
                Compartir cuenta
              </button>
            </div>
          ))}
        </div>

        {/* Create Account Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Crear Nueva Cuenta
              </h2>

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de cuenta
                  </label>
                  <select
                    value={newAccountType}
                    onChange={(e) =>
                      setNewAccountType(
                        e.target.value as "CHEQUES" | "DEBITO" | "CREDITO"
                      )
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm hover:border-gray-400 transition-colors text-gray-900"
                  >
                    <option value="" disabled hidden>
                      Selecciona el tipo de cuenta
                    </option>
                    <option value="CHEQUES">Cuenta de Cheques</option>
                    <option value="DEBITO">Cuenta de Débito</option>
                    <option value="CREDITO">Cuenta de Crédito</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de la cuenta (opcional)
                  </label>
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="Ej: Ahorros, Gastos personales"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm hover:border-gray-400 transition-colors placeholder:text-gray-600 placeholder:font-normal text-gray-900"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    disabled={loading}
                    className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-linear-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Spinner size="sm" color="border-white" />
                        <span>Creando...</span>
                      </>
                    ) : (
                      "Crear"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Share Account Modal */}
        {showShareModal && selectedAccount && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-2xl w-full my-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Compartir Cuenta
                  </h2>
                  <p className="text-gray-600">
                    {selectedAccount.nombre} - {selectedAccount.numeroCuenta}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowShareModal(false);
                    setSelectedAccount(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <LockClosedIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Add User Form */}
              <form
                onSubmit={handleShareAccount}
                className="mb-6 p-4 bg-gray-50 rounded-lg"
              >
                <h3 className="font-semibold text-gray-900 mb-4">
                  Agregar Usuario
                </h3>
                <div className="space-y-4">
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="Email del usuario"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm hover:border-gray-400 transition-colors placeholder:text-gray-600 placeholder:font-normal text-gray-900"
                    required
                  />
                  <select
                    value={shareRole}
                    onChange={(e) =>
                      setShareRole(e.target.value as "AUTORIZADO" | "CONSULTA")
                    }
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm hover:border-gray-400 transition-colors text-gray-900"
                  >
                    <option value="" disabled hidden>
                      Selecciona el rol
                    </option>
                    <option value="AUTORIZADO">
                      Autorizado (puede realizar transacciones)
                    </option>
                    <option value="CONSULTA">
                      Solo Consulta (solo ver saldo)
                    </option>
                  </select>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Spinner size="sm" color="border-white" />
                        <span>Agregando...</span>
                      </>
                    ) : (
                      "Agregar Usuario"
                    )}
                  </button>
                </div>
              </form>

              {/* Users List */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">
                  Usuarios con Acceso
                </h3>
                {loadingUsers ? (
                  <div className="flex items-center justify-center gap-2 text-gray-500 py-4">
                    <Spinner size="sm" />
                    <span>Cargando usuarios...</span>
                  </div>
                ) : accountUsers.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No hay usuarios compartidos
                  </p>
                ) : (
                  <div className="space-y-2">
                    {accountUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.nombre}
                          </p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm px-3 py-1 rounded-full bg-blue-100 text-blue-800">
                            {user.rol}
                          </span>
                          {user.rol !== "TITULAR" && (
                            <button
                              onClick={() => handleRemoveUser(user.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
