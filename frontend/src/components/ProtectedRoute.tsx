"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import LoadingOverlay from "@/components/ui/LoadingOverlay";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useApp();
  const router = useRouter();

  useEffect(() => {
    // Si no hay usuario autenticado, redirigir a login
    if (!isAuthenticated && !user) {
      console.warn("🚫 Acceso denegado - Redirigiendo a login");
      router.push("/");
    }
  }, [isAuthenticated, user, router]);

  // Mostrar loading mientras verifica autenticación
  if (!isAuthenticated || !user) {
    return <LoadingOverlay message="Verificando sesión..." />;
  }

  return <>{children}</>;
}
