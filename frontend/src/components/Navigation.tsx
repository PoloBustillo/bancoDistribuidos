"use client";

import { useApp } from "@/context/AppContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import WorkerSelector from "./WorkerSelector";
import {
  HomeIcon,
  CreditCardIcon,
  BanknotesIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ArrowsRightLeftIcon,
  ChevronDownIcon,
  ServerIcon,
  PlusCircleIcon,
  XMarkIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";

export default function Navigation() {
  const {
    isAuthenticated,
    user,
    logout,
    workers,
    selectedWorker,
    setSelectedWorker,
  } = useApp();
  const pathname = usePathname();
  const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const navLinks = [
    { href: "/", label: "Inicio", icon: HomeIcon },
    { href: "/movements", label: "Movimientos", icon: BanknotesIcon },
    { href: "/transfer", label: "Transferir", icon: ArrowsRightLeftIcon },
    { href: "/accounts", label: "Cuentas", icon: BanknotesIcon },
    { href: "/cards", label: "Tarjetas", icon: CreditCardIcon },
    { href: "/transactions", label: "Historial", icon: DocumentTextIcon },
    { href: "/settings", label: "Ajustes", icon: Cog6ToothIcon },
  ];

  const isActive = (href: string) => pathname === href;

  const handleWorkerChange = (workerId: string) => {
    const worker = workers.find((w) => w.id === workerId);
    if (worker) {
      setSelectedWorker(worker);
      setShowWorkerDropdown(false);
    }
  };

  return (
    <nav className="bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <span className="text-2xl">🏦</span>
            <span className="font-bold text-xl text-gray-900 hidden sm:inline">
              Banco Distribuido
            </span>
            <span className="font-bold text-xl text-gray-900 sm:hidden">
              Banco
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          {isAuthenticated && (
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                      isActive(link.href)
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 font-medium"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Mobile Menu Button */}
          {isAuthenticated && (
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Menu"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
          )}

          {/* Right Side: Worker Selector & User/Auth */}
          <div className="flex items-center gap-3">
            {/* Worker Dropdown - Always visible */}
            <div className="relative">
              <button
                onClick={() => setShowWorkerDropdown(!showWorkerDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm border-2 border-gray-300 shadow-sm"
                style={{ borderLeft: `4px solid ${selectedWorker.color}` }}
              >
                <ServerIcon className="w-4 h-4 text-gray-700" />
                <span
                  className="font-semibold hidden sm:inline"
                  style={{
                    color:
                      selectedWorker.color &&
                      selectedWorker.color.startsWith("#")
                        ? selectedWorker.color
                        : selectedWorker.color || "#2563eb",
                  }}
                >
                  {selectedWorker.name.replace(/\s*\(.*\)/, "")}
                </span>
                <ChevronDownIcon className="w-4 h-4 text-gray-600" />
              </button>

              {showWorkerDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowWorkerDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-2xl border-2 border-gray-200 z-20">
                    <div className="p-2">
                      <div className="px-3 py-2 text-xs text-gray-600 font-bold">
                        SELECCIONAR SERVIDOR
                      </div>
                      {workers.map((worker) => (
                        <button
                          key={worker.id}
                          onClick={() => handleWorkerChange(worker.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${
                            worker.id === selectedWorker.id
                              ? "shadow-md text-white"
                              : "text-gray-700 hover:bg-gray-100 font-medium"
                          }`}
                          style={{
                            borderLeft: `4px solid ${worker.color}`,
                            backgroundColor:
                              worker.id === selectedWorker.id &&
                              worker.color &&
                              worker.color.startsWith("#")
                                ? worker.color
                                : worker.id === selectedWorker.id
                                ? "#2563eb"
                                : undefined,
                          }}
                        >
                          <ServerIcon className="w-4 h-4" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm">
                              {worker.name}
                            </div>
                            <div className="text-xs opacity-75 truncate">
                              {worker.url}
                            </div>
                          </div>
                        </button>
                      ))}
                      <div className="border-t-2 border-gray-200 mt-2 pt-2">
                        <button
                          onClick={() => {
                            setShowWorkerDropdown(false);
                            setShowWorkerModal(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left text-blue-600 hover:bg-blue-50 font-semibold"
                        >
                          <PlusCircleIcon className="w-4 h-4" />
                          <span className="text-sm">Gestionar servidores</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Info & Logout - Only when authenticated */}
            {isAuthenticated && user ? (
              <>
                <div className="text-right hidden lg:block">
                  <p className="text-sm font-semibold text-gray-900">
                    {user.nombre}
                  </p>
                  <p className="text-xs text-gray-600">{user.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-red-50 border-2 border-red-500 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-semibold shadow-sm"
                >
                  Salir
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {showMobileMenu && isAuthenticated && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setShowMobileMenu(false)}
          />
          <div className="lg:hidden absolute top-16 left-0 right-0 bg-white border-b-2 border-gray-200 shadow-2xl z-50">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setShowMobileMenu(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive(link.href)
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 font-medium"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-base font-medium">{link.label}</span>
                  </Link>
                );
              })}
              {user && (
                <div className="border-t-2 border-gray-200 pt-3 mt-3">
                  <div className="px-4 py-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {user.nombre}
                    </p>
                    <p className="text-xs text-gray-600">{user.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Worker Management Modal */}
      {showWorkerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border-2 border-gray-200">
            <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Gestionar Servidores
              </h2>
              <button
                onClick={() => setShowWorkerModal(false)}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <WorkerSelector />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
