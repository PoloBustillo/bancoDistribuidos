"use client";

import { Account, AccountUser } from "@/types";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import Spinner from "@/components/ui/Spinner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { isValidEmail, getEmailErrorMessage } from "@/lib/validation";

interface AccountCardProps {
  account: Account;
}

export default function AccountCard({ account }: AccountCardProps) {
  const { refreshUserData } = useApp();
  const { showSuccess, showError } = useToast();
  const [showShare, setShowShare] = useState(false);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"TITULAR" | "AUTORIZADO" | "CONSULTA">(
    "AUTORIZADO"
  );
  const [sharing, setSharing] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const [users, setUsers] = useState<AccountUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Cargar usuarios compartidos al expandir la card
  useEffect(() => {
    if (showShare) {
      setLoadingUsers(true);
      apiClient
        .getAccountUsers(account.id)
        .then((res) => {
          setUsers(Array.isArray(res.usuarios) ? res.usuarios : []);
        })
        .catch(() => setUsers([]))
        .finally(() => setLoadingUsers(false));
    }
  }, [showShare, account.id]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar email
    const error = getEmailErrorMessage(email);
    if (error) {
      setEmailError(error);
      return;
    }
    
    setEmailError(null);
    setShowConfirm(true);
  };
  
  const confirmShare = async () => {
    setSharing(true);
    try {
      await apiClient.shareAccount(account.id, email, rol);

      showSuccess(
        "Cuenta compartida",
        `Se compartió la cuenta con ${email} como ${rol}`
      );

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

      // Recargar usuarios
      const res = await apiClient.getAccountUsers(account.id);
      setUsers(Array.isArray(res.usuarios) ? res.usuarios : []);

      setEmail("");
      setShowConfirm(false);
    } catch (error) {
      console.error("Error sharing account:", error);
      showError(
        "Error al compartir cuenta",
        (error as Error).message || "No se pudo compartir la cuenta"
      );
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

      {/* Usuarios compartidos */}
      {showShare && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 font-semibold mb-2">
            Usuarios con acceso
          </p>
          {loadingUsers ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Spinner size="sm" />
              <span>Cargando usuarios...</span>
            </div>
          ) : users.length === 0 ? (
            <p className="text-gray-400 text-sm">No hay usuarios compartidos</p>
          ) : (
            <ul className="space-y-1">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-2 text-sm text-gray-700"
                >
                  <span className="font-medium">{u.nombre}</span>
                  <span className="text-gray-500">({u.email})</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs border ${
                      roleColors[u.rol]
                    }`}
                  >
                    {u.rol}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(null);
                  }}
                  onBlur={() => {
                    if (email) {
                      const error = getEmailErrorMessage(email);
                      setEmailError(error);
                    }
                  }}
                  placeholder="Correo del usuario"
                  className={`w-full px-3 py-2 bg-white border rounded text-gray-900 text-sm focus:outline-none ${
                    emailError ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                  }`}
                  required
                />
                {emailError && (
                  <p className="text-red-600 text-xs mt-1">{emailError}</p>
                )}
              </div>
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
                className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sharing ? (
                  <>
                    <Spinner size="sm" color="border-white" />
                    <span>Compartiendo...</span>
                  </>
                ) : (
                  "Compartir"
                )}
              </button>
            </form>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setSharing(false);
        }}
        onConfirm={confirmShare}
        title="Confirmar compartir cuenta"
        message={
          <div>
            <p className="mb-2">Estás a punto de compartir esta cuenta con:</p>
            <div className="bg-blue-50 p-3 rounded-lg space-y-1">
              <p className="font-semibold text-gray-900">{email}</p>
              <p className="text-sm text-gray-600">Rol: {rol}</p>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Esta persona tendrá acceso a la cuenta según los permisos del rol asignado.
            </p>
          </div>
        }
        confirmText="Compartir"
        type="warning"
        loading={sharing}
      />
    </div>
  );
}
