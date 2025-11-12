"use client";

import { useApp } from "@/context/AppContext";
import WorkerSelector from "@/components/WorkerSelector";
import AuthForm from "@/components/AuthForm";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const { isAuthenticated } = useApp();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            🏦 Sistema Bancario Distribuido
          </h1>
        </header>

        {/* Worker Selector - Always visible */}
        <div className="mb-6">
          <WorkerSelector />
        </div>

        {/* Main Content */}
        {isAuthenticated ? <Dashboard /> : <AuthForm />}

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
          <p className="mt-2">
            Conceptos: Cuentas Compartidas (locks distribuidos) • Tarjetas
            Individuales (sin locks) • Control de Acceso Basado en Roles
          </p>
        </footer>
      </div>
    </div>
  );
}
