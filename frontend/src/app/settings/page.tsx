"use client";

import { useApp } from "@/context/AppContext";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function SettingsPage() {
  const router = useRouter();
  const { user, selectedWorker } = useApp();

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors"
          >
            <ArrowLeftIcon className="w-6 h-6 text-gray-700" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
            <p className="text-gray-600">Ajustes de tu cuenta y preferencias</p>
          </div>
        </div>

        {/* Settings Cards */}
        <div className="space-y-6">
          {/* Account Info */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Información de la Cuenta
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">Nombre</label>
                <p className="text-lg font-medium text-gray-900">
                  {user?.nombre}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Email</label>
                <p className="text-lg font-medium text-gray-900">
                  {user?.email}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600">ID de Usuario</label>
                <p className="text-sm font-mono text-gray-700">{user?.id}</p>
              </div>
            </div>
          </div>

          {/* Worker Connection */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Conexión al Servidor
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">Worker Actual</label>
                <p className="text-lg font-medium text-gray-900">
                  {selectedWorker.name}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600">URL</label>
                <p className="text-sm font-mono text-gray-700">
                  {selectedWorker.url}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
