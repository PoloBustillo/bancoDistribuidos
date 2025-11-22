"use client";

import { useApp } from "@/context/AppContext";
import AccountCard from "./AccountCard";
import ConnectionStatus from "./ConnectionStatus";
import { VerificationModal } from "./VerificationModal";
import { useState } from "react";
import Link from "next/link";
import {
  PlusCircleIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  CreditCardIcon,
} from "@heroicons/react/24/outline";

export default function Dashboard() {
  const { user, accounts, cards } = useApp();
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* User Info */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {user?.nombre}
                  </h2>
                  <p className="text-gray-600">{user?.email}</p>
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
                className="w-full sm:w-auto min-w-0 px-4 py-2 bg-purple-50 border-2 border-purple-500 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base font-medium shadow-sm"
                aria-label="Atención con Asesor"
              >
                <span>👤</span>
                <span className="truncate">Atención con Asesor</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/movements"
            className="bg-linear-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl p-6 text-white transition-all hover:scale-105 shadow-lg"
          >
            <BanknotesIcon className="w-8 h-8 mb-3" />
            <h3 className="font-bold text-lg">Movimientos</h3>
            <p className="text-sm text-green-100">Depósitos y retiros</p>
          </Link>

          <Link
            href="/transfer"
            className="bg-linear-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl p-6 text-white transition-all hover:scale-105 shadow-lg"
          >
            <ArrowsRightLeftIcon className="w-8 h-8 mb-3" />
            <h3 className="font-bold text-lg">Transferir</h3>
            <p className="text-sm text-blue-100">Entre cuentas</p>
          </Link>

          <Link
            href="/accounts"
            className="bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl p-6 text-white transition-all hover:scale-105 shadow-lg"
          >
            <PlusCircleIcon className="w-8 h-8 mb-3" />
            <h3 className="font-bold text-lg">Cuentas</h3>
            <p className="text-sm text-purple-100">Crear y gestionar</p>
          </Link>

          <Link
            href="/cards"
            className="bg-linear-to-br from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 rounded-xl p-6 text-white transition-all hover:scale-105 shadow-lg"
          >
            <CreditCardIcon className="w-8 h-8 mb-3" />
            <h3 className="font-bold text-lg">Tarjetas</h3>
            <p className="text-sm text-orange-100">Gestionar tarjetas</p>
          </Link>
        </div>

        {/* Accounts Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900">Tus Cuentas</h3>
            <Link
              href="/accounts"
              className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
            >
              Ver todas →
            </Link>
          </div>

          {accounts.length === 0 ? (
            <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-lg p-8 text-center">
              <p className="text-gray-600 mb-4">No tienes cuentas todavía</p>
              <Link
                href="/accounts"
                className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-md"
              >
                Crear tu primera cuenta
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.slice(0, 6).map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </div>
          )}
        </div>

        {/* Cards Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900">Tus Tarjetas</h3>
            <Link
              href="/cards"
              className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
            >
              Ver todas →
            </Link>
          </div>

          {cards.length === 0 ? (
            <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-lg p-8 text-center">
              <p className="text-gray-600 mb-4">No tienes tarjetas todavía</p>
              <Link
                href="/cards"
                className="inline-block px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors shadow-md"
              >
                Solicitar una tarjeta
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.slice(0, 3).map((card) => (
                <div
                  key={card.id}
                  className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-lg hover:shadow-xl transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <CreditCardIcon className="w-8 h-8 text-gray-700" />
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        card.estado === "ACTIVA"
                          ? "bg-green-100 text-green-700 border border-green-300"
                          : card.estado === "BLOQUEADA"
                          ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                          : "bg-red-100 text-red-700 border border-red-300"
                      }`}
                    >
                      {card.estado}
                    </span>
                  </div>
                  <p className="text-gray-900 font-mono text-lg mb-2 font-semibold">
                    •••• •••• •••• {card.numeroTarjeta.slice(-4)}
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">
                      {card.tipoTarjeta}
                    </span>
                    <span className="text-gray-500">
                      {card.fechaExpiracion}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Verification Modal */}
        <VerificationModal
          isOpen={showVerificationModal}
          onClose={() => setShowVerificationModal(false)}
        />
      </div>
    </div>
  );
}
