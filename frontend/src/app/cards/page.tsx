"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { apiClient } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CreditCardIcon,
  PlusCircleIcon,
  LockClosedIcon,
  LockOpenIcon,
  XCircleIcon as XCircleIconOutline,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

export default function CardsPage() {
  const router = useRouter();
  const { accounts, cards, refreshUserData } = useApp();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [cardType, setCardType] = useState<"DEBITO" | "CREDITO">("DEBITO");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "ACTIVA" | "BLOQUEADA" | "CANCELADA"
  >("ALL");

  const filteredCards = useMemo(() => {
    if (filterStatus === "ALL") return cards;
    return cards.filter((card) => card.estado === filterStatus);
  }, [cards, filterStatus]);

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      await apiClient.createCard(selectedAccountId, cardType);
      setResult({ success: true, message: "Tarjeta creada exitosamente" });
      await refreshUserData();

      setTimeout(() => {
        setShowCreateModal(false);
        setSelectedAccountId("");
        setCardType("DEBITO");
        setResult(null);
      }, 2000);
    } catch (error) {
      setResult({ success: false, message: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleChangeCardStatus = async (
    cardId: string,
    newStatus: "ACTIVA" | "BLOQUEADA" | "CANCELADA"
  ) => {
    const confirmMessages = {
      ACTIVA: "¿Deseas activar esta tarjeta?",
      BLOQUEADA: "¿Deseas bloquear esta tarjeta temporalmente?",
      CANCELADA:
        "¿Deseas cancelar esta tarjeta permanentemente? Esta acción no se puede deshacer.",
    };

    if (!confirm(confirmMessages[newStatus])) return;

    try {
      await apiClient.changeCardStatus(cardId, newStatus);
      await refreshUserData();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const getCardStatusColor = (estado: string) => {
    switch (estado) {
      case "ACTIVA":
        return "bg-green-100 text-green-800";
      case "BLOQUEADA":
        return "bg-yellow-100 text-yellow-800";
      case "CANCELADA":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCardTypeColor = (tipo: string) => {
    return tipo === "DEBITO"
      ? "from-blue-500 to-blue-700"
      : "from-purple-500 to-purple-700";
  };

  const formatCardNumber = (numero: string) => {
    return numero.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const maskCardNumber = (numero: string) => {
    return numero.replace(/\d(?=\d{4})/g, "*");
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="p-2 rounded-lg hover:bg-white/50 transition-colors"
            >
              <ArrowLeftIcon className="w-6 h-6 text-gray-700" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mis Tarjetas</h1>
              <p className="text-gray-600">
                Administra tus tarjetas de débito y crédito
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-linear-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2"
          >
            <PlusCircleIcon className="w-5 h-5" />
            Nueva Tarjeta
          </button>
        </div>

        {/* Filter */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-4">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterStatus("ALL")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === "ALL"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Todas ({cards.length})
            </button>
            <button
              onClick={() => setFilterStatus("ACTIVA")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === "ACTIVA"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Activas ({cards.filter((c) => c.estado === "ACTIVA").length})
            </button>
            <button
              onClick={() => setFilterStatus("BLOQUEADA")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === "BLOQUEADA"
                  ? "bg-yellow-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Bloqueadas ({cards.filter((c) => c.estado === "BLOQUEADA").length}
              )
            </button>
            <button
              onClick={() => setFilterStatus("CANCELADA")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === "CANCELADA"
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Canceladas ({cards.filter((c) => c.estado === "CANCELADA").length}
              )
            </button>
          </div>
        </div>

        {/* Cards Grid */}
        {filteredCards.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <CreditCardIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">
              {filterStatus === "ALL"
                ? "No tienes tarjetas"
                : `No tienes tarjetas ${filterStatus.toLowerCase()}s`}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Crear tu primera tarjeta
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCards.map((card) => (
              <div key={card.id} className="group">
                {/* Card Visual */}
                <div
                  className={`bg-linear-to-br ${getCardTypeColor(
                    card.tipoTarjeta
                  )} rounded-2xl p-6 text-white shadow-xl mb-4 transform transition-transform group-hover:scale-105`}
                >
                  <div className="flex justify-between items-start mb-8">
                    <CreditCardIcon className="w-10 h-10" />
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getCardStatusColor(
                        card.estado
                      )} backdrop-blur-sm`}
                    >
                      {card.estado}
                    </span>
                  </div>
                  <div className="mb-6">
                    <p className="text-2xl font-mono tracking-wider mb-2">
                      {formatCardNumber(maskCardNumber(card.numeroTarjeta))}
                    </p>
                    <p className="text-sm opacity-90">
                      Vence: {card.fechaExpiracion}
                    </p>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs opacity-75 mb-1">TIPO</p>
                      <p className="font-semibold">{card.tipoTarjeta}</p>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="bg-white rounded-lg shadow-md p-4 space-y-2">
                  {card.estado === "ACTIVA" && (
                    <button
                      onClick={() =>
                        handleChangeCardStatus(card.id, "BLOQUEADA")
                      }
                      className="w-full bg-yellow-50 hover:bg-yellow-100 text-yellow-800 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <LockClosedIcon className="w-4 h-4" />
                      Bloquear temporalmente
                    </button>
                  )}
                  {card.estado === "BLOQUEADA" && (
                    <button
                      onClick={() => handleChangeCardStatus(card.id, "ACTIVA")}
                      className="w-full bg-green-50 hover:bg-green-100 text-green-800 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <LockOpenIcon className="w-4 h-4" />
                      Desbloquear
                    </button>
                  )}
                  {card.estado !== "CANCELADA" && (
                    <button
                      onClick={() =>
                        handleChangeCardStatus(card.id, "CANCELADA")
                      }
                      className="w-full bg-red-50 hover:bg-red-100 text-red-800 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircleIconOutline className="w-4 h-4" />
                      Cancelar tarjeta
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Card Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Crear Nueva Tarjeta
              </h2>

              <form onSubmit={handleCreateCard} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cuenta asociada
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm hover:border-gray-400 transition-colors placeholder:text-gray-600 placeholder:font-normal text-gray-900"
                    required
                  >
                    <option value="">Selecciona una cuenta</option>
                    {accounts
                      .filter((acc) => acc.estado === "ACTIVA")
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.nombre} - {account.numeroCuenta}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de tarjeta
                  </label>
                  <select
                    value={cardType}
                    onChange={(e) =>
                      setCardType(e.target.value as "DEBITO" | "CREDITO")
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm hover:border-gray-400 transition-colors text-gray-900"
                  >
                    <option value="DEBITO">Tarjeta de Débito</option>
                    <option value="CREDITO">Tarjeta de Crédito</option>
                  </select>
                </div>

                {result && (
                  <div
                    className={`p-4 rounded-lg flex items-center gap-3 ${
                      result.success
                        ? "bg-green-50 text-green-800"
                        : "bg-red-50 text-red-800"
                    }`}
                  >
                    {result.success ? (
                      <CheckCircleIcon className="w-5 h-5 shrink-0" />
                    ) : (
                      <XCircleIconOutline className="w-5 h-5 shrink-0" />
                    )}
                    <p className="text-sm">{result.message}</p>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setResult(null);
                    }}
                    disabled={loading}
                    className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !selectedAccountId}
                    className="flex-1 bg-linear-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
                  >
                    {loading ? "Creando..." : "Crear"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
