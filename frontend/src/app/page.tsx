"use client";

import { useApp } from "@/context/AppContext";
import AuthForm from "@/components/AuthForm";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <header className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-2 text-gray-900">
              🏦 Banco Distribuido
            </h1>
            <p className="text-gray-600 mb-6 font-medium">
              Sistema bancario con arquitectura distribuida
            </p>
          </header>

          <AuthForm />

          <footer className="mt-8 text-center text-gray-600 text-xs font-medium">
            <p>Locks coordinados • Cuentas compartidas • Control de roles</p>
          </footer>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}
