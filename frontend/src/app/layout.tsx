import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { ToastProvider } from "@/context/ToastContext";
import NotificationCenter from "@/components/NotificationCenter";
import Navigation from "@/components/Navigation";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Banco Distribuido",
  description: "Proyecto",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white`}
      >
        <ErrorBoundary>
          <ToastProvider>
            <AppProvider>
              <Navigation />
              <main>{children}</main>
              <NotificationCenter />
            </AppProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
