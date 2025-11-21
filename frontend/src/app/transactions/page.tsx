"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";

interface Transaction {
  id: string;
  fecha: string;
  tipo: "TRANSFERENCIA" | "DEPOSITO" | "RETIRO";
  monto: number;
  cuentaOrigen?: string;
  cuentaDestino?: string;
  descripcion?: string;
  estado: "COMPLETADA" | "PENDIENTE" | "FALLIDA";
}

export default function TransactionsPage() {
  const router = useRouter();
  const { accounts } = useApp();
  const [transactions] = useState<Transaction[]>(() => {
    // Simulated data - en producción esto vendría del API
    return [
      {
        id: "1",
        fecha: new Date().toISOString(),
        tipo: "TRANSFERENCIA" as const,
        monto: 500.0,
        cuentaOrigen: accounts[0]?.numeroCuenta,
        cuentaDestino: "1234567890",
        descripcion: "Pago de renta",
        estado: "COMPLETADA" as const,
      },
      {
        id: "2",
        fecha: new Date(Date.now() - 86400000).toISOString(),
        tipo: "DEPOSITO" as const,
        monto: 1000.0,
        cuentaDestino: accounts[0]?.numeroCuenta,
        descripcion: "Nómina",
        estado: "COMPLETADA" as const,
      },
      {
        id: "3",
        fecha: new Date(Date.now() - 172800000).toISOString(),
        tipo: "RETIRO" as const,
        monto: 200.0,
        cuentaOrigen: accounts[0]?.numeroCuenta,
        descripcion: "ATM - Centro comercial",
        estado: "COMPLETADA" as const,
      },
    ];
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<
    "ALL" | "TRANSFERENCIA" | "DEPOSITO" | "RETIRO"
  >("ALL");
  const [filterAccount, setFilterAccount] = useState<string>("ALL");
  const [showFilters, setShowFilters] = useState(false);

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Filter by type
    if (filterType !== "ALL") {
      filtered = filtered.filter((t) => t.tipo === filterType);
    }

    // Filter by account
    if (filterAccount !== "ALL") {
      filtered = filtered.filter(
        (t) =>
          t.cuentaOrigen === filterAccount || t.cuentaDestino === filterAccount
      );
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (t) =>
          t.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.cuentaOrigen?.includes(searchTerm) ||
          t.cuentaDestino?.includes(searchTerm) ||
          t.monto.toString().includes(searchTerm)
      );
    }

    return filtered;
  }, [searchTerm, filterType, filterAccount, transactions]);

  const getTransactionIcon = (tipo: string) => {
    switch (tipo) {
      case "TRANSFERENCIA":
        return <ArrowsRightLeftIcon className="w-5 h-5" />;
      case "DEPOSITO":
        return <ArrowDownIcon className="w-5 h-5" />;
      case "RETIRO":
        return <ArrowUpIcon className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getTransactionColor = (tipo: string) => {
    switch (tipo) {
      case "TRANSFERENCIA":
        return "bg-blue-100 text-blue-800";
      case "DEPOSITO":
        return "bg-green-100 text-green-800";
      case "RETIRO":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors"
          >
            <ArrowLeftIcon className="w-6 h-6 text-gray-700" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Historial de Transacciones
            </h1>
            <p className="text-gray-600">
              Revisa todas tus operaciones bancarias
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por monto, cuenta o descripción..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm hover:border-gray-400 transition-colors placeholder:text-gray-600 placeholder:font-normal"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 justify-center"
            >
              <FunnelIcon className="w-5 h-5" />
              Filtros
            </button>
          </div>

          {showFilters && (
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de transacción
                </label>
                <select
                  value={filterType}
                  onChange={(e) =>
                    setFilterType(e.target.value as typeof filterType)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="" disabled hidden selected>
                    Tipo de transacción
                  </option>
                  <option value="ALL">Todas</option>
                  <option value="TRANSFERENCIA">Transferencias</option>
                  <option value="DEPOSITO">Depósitos</option>
                  <option value="RETIRO">Retiros</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cuenta
                </label>
                <select
                  value={filterAccount}
                  onChange={(e) => setFilterAccount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="" disabled hidden selected>
                    Selecciona una cuenta
                  </option>
                  <option value="ALL">Todas las cuentas</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.numeroCuenta}>
                      {account.nombre} - {account.numeroCuenta}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Transactions List */}
        <div className="space-y-4">
          {filteredTransactions.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <p className="text-gray-500 text-lg">
                No se encontraron transacciones
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Intenta ajustar los filtros de búsqueda
              </p>
            </div>
          ) : (
            filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className={`p-3 rounded-lg ${getTransactionColor(
                        transaction.tipo
                      )}`}
                    >
                      {getTransactionIcon(transaction.tipo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {transaction.tipo}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            transaction.estado === "COMPLETADA"
                              ? "bg-green-100 text-green-800"
                              : transaction.estado === "PENDIENTE"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {transaction.estado}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {formatDate(transaction.fecha)}
                      </p>
                      {transaction.descripcion && (
                        <p className="text-sm text-gray-700 mb-2">
                          {transaction.descripcion}
                        </p>
                      )}
                      <div className="text-xs text-gray-500 space-y-1">
                        {transaction.cuentaOrigen && (
                          <p>
                            Origen:{" "}
                            <span className="font-mono">
                              {transaction.cuentaOrigen}
                            </span>
                          </p>
                        )}
                        {transaction.cuentaDestino && (
                          <p>
                            Destino:{" "}
                            <span className="font-mono">
                              {transaction.cuentaDestino}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p
                      className={`text-2xl font-bold ${
                        transaction.tipo === "DEPOSITO"
                          ? "text-green-600"
                          : "text-gray-900"
                      }`}
                    >
                      {transaction.tipo === "DEPOSITO" ? "+" : "-"}$
                      {transaction.monto.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info Note */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Nota:</strong> Esta es una vista preliminar con datos de
            ejemplo. Conecta con el API del worker para obtener tu historial
            real de transacciones.
          </p>
        </div>
      </div>
    </div>
  );
}
