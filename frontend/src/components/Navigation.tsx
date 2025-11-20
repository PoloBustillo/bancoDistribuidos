"use client";

import { useApp } from "@/context/AppContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const { isAuthenticated, user, logout } = useApp();
  const pathname = usePathname();

  // No mostrar en la página principal si no está autenticado
  if (!isAuthenticated && pathname === "/") {
    return null;
  }

  return (
    <nav className="bg-gray-800 border-b border-gray-700 mb-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <span className="text-2xl">🏦</span>
            <span className="font-bold text-xl text-white">
              Banco Distribuido
            </span>
          </Link>

          {/* User Info & Logout (solo cuando está autenticado) */}
          {isAuthenticated && user && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{user.nombre}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-500/20 border border-red-500 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
