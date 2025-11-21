"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
// Lista de posibles workers a escanear
const WORKER_SCAN_LIST = [
  // Localhost
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  // HTTPS dominios
  "https://api1.psic-danieladiaz.com",
  "https://api2.psic-danieladiaz.com",
  "https://api3.psic-danieladiaz.com",
  // HTTP dominios
  "http://api1.psic-danieladiaz.com",
  "http://api2.psic-danieladiaz.com",
  "http://api3.psic-danieladiaz.com",
];
// ...existing code...

// Use HEX colors to match AppContext.tsx
const workerColors = [
  "#2563eb", // blue
  "#22c55e", // green
  "#a21caf", // purple
  "#f59e42", // orange
  "#ec4899", // pink
  "#eab308", // yellow
];

export default function WorkerSelector() {
  const {
    selectedWorker,
    setSelectedWorker,
    workers,
    addWorker,
    removeWorker,
  } = useApp();
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorkerPort, setNewWorkerPort] = useState("");
  const [newWorkerHost, setNewWorkerHost] = useState("localhost");
  const [newWorkerName, setNewWorkerName] = useState("");
  const [useCustomUrl, setUseCustomUrl] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<{ found: number; total: number } | null>(null);

  // Escaneo manual al hacer clic en botón
  const handleScanWorkers = async () => {
    setScanning(true);
    setScanResults(null);
    
    let foundCount = 0;
    const results = await Promise.allSettled(
      WORKER_SCAN_LIST.map(async (baseUrl) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const res = await fetch(`${baseUrl}/api/health`, {
            method: "GET",
            mode: "cors",
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (!res.ok) return null;
          const data = await res.json();
          if (data.status !== "OK") return null;
          
          foundCount++;
          return {
            id: data.workerId || baseUrl,
            name: data.workerId || baseUrl.replace(/^https?:\/\//, ""),
            url: baseUrl,
            color: workerColors[Math.floor(Math.random() * workerColors.length)],
          };
        } catch {
          return null;
        }
      })
    );
    
    const discoveredWorkers = results
      .filter((r) => r.status === "fulfilled" && r.value !== null)
      .map((r: any) => r.value);

    let addedCount = 0;
    discoveredWorkers.forEach((worker) => {
      if (!workers.some((w) => w.url === worker.url)) {
        addWorker(worker);
        addedCount++;
      }
    });

    setScanResults({ found: foundCount, total: WORKER_SCAN_LIST.length });
    setScanning(false);
    
    // Limpiar mensaje después de 5 segundos
    setTimeout(() => setScanResults(null), 5000);
  };

  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();

    let workerUrl: string;
    let workerId: string;
    let workerName: string;

    if (useCustomUrl) {
      // Modo URL personalizada
      const urlInput = newWorkerHost.trim();

      // Validar que sea una URL válida
      try {
        const url = new URL(
          urlInput.startsWith("http") ? urlInput : `http://${urlInput}`
        );
        workerUrl = url.origin;
        workerId = `worker-${url.hostname}-${url.port || "80"}`;
        workerName =
          newWorkerName.trim() || `${url.hostname}:${url.port || "80"}`;
      } catch {
        alert("URL inválida. Usa el formato: http://host:puerto o host:puerto");
        return;
      }
    } else {
      // Modo puerto localhost
      const port = parseInt(newWorkerPort);
      if (port < 1024 || port > 65535) {
        alert("El puerto debe estar entre 1024 y 65535");
        return;
      }

      workerId = `worker-${port}`;
      workerUrl = `http://localhost:${port}`;
      workerName = newWorkerName.trim() || `Worker ${port}`;
    }

    // Verificar que no exista ya
    if (workers.some((w) => w.id === workerId || w.url === workerUrl)) {
      alert("Ya existe un worker con ese ID o URL");
      return;
    }

    const newWorker = {
      id: workerId,
      name: workerName,
      url: workerUrl,
      color: workerColors[workers.length % workerColors.length],
    };

    addWorker(newWorker);
    setNewWorkerPort("");
    setNewWorkerHost("localhost");
    setNewWorkerName("");
    setShowAddWorker(false);
    setUseCustomUrl(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        🔌 Selección de Worker
      </h3>

      <div className="flex flex-wrap gap-2 mb-3">
        {workers.map((worker) => (
          <div key={worker.id} className="flex items-center gap-1">
            <button
              onClick={() => setSelectedWorker(worker)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedWorker.id === worker.id
                  ? "text-white shadow-lg"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              style={
                selectedWorker.id === worker.id &&
                worker.color &&
                worker.color.startsWith("#")
                  ? { backgroundColor: worker.color }
                  : undefined
              }
            >
              <div className="flex items-center justify-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    selectedWorker.id === worker.id
                      ? "bg-white animate-pulse"
                      : "bg-gray-500"
                  }`}
                />
                {worker.name}
              </div>
              <div className="text-xs mt-1 opacity-75">{worker.url}</div>
            </button>
            {workers.length > 1 && (
              <button
                onClick={() => removeWorker(worker.id)}
                className="px-2 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-xs"
                title="Eliminar worker"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <button
          onClick={() => setShowAddWorker(!showAddWorker)}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
        >
          ➕ Agregar Worker
        </button>
        
        <button
          onClick={handleScanWorkers}
          disabled={scanning}
          className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scanning ? "🔍 Escaneando..." : "🔍 Buscar Workers"}
        </button>
      </div>

      {scanResults && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            ✅ Escaneo completado: {scanResults.found} workers encontrados de {scanResults.total} direcciones
          </p>
        </div>
      )}

      {showAddWorker && (
        <form
          onSubmit={handleAddWorker}
          className="p-4 bg-white border border-gray-200 rounded-lg space-y-3"
        >
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => setUseCustomUrl(false)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                !useCustomUrl
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              🏠 Localhost
            </button>
            <button
              type="button"
              onClick={() => setUseCustomUrl(true)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                useCustomUrl
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              🌐 Servidor Remoto
            </button>
          </div>

          {!useCustomUrl ? (
            // Modo Localhost - Solo puerto
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Puerto
                </label>
                <input
                  type="number"
                  value={newWorkerPort}
                  onChange={(e) => setNewWorkerPort(e.target.value)}
                  placeholder="3001, 3002, 3003..."
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:border-blue-500"
                  required
                  min="1024"
                  max="65535"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Nombre (opcional)
                </label>
                <input
                  type="text"
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
                  placeholder="Ej: Worker Principal"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
                📍 Se conectará a:{" "}
                <span className="font-mono text-blue-600">
                  http://localhost:{newWorkerPort || "XXXX"}
                </span>
              </div>
            </div>
          ) : (
            // Modo Remoto - URL completa
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  URL del Servidor
                </label>
                <input
                  type="text"
                  value={newWorkerHost}
                  onChange={(e) => setNewWorkerHost(e.target.value)}
                  placeholder="http://146.190.119.145:3001 o servidor.com:3001"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Puedes usar IP, dominio, con o sin http://
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Nombre del Worker
                </label>
                <input
                  type="text"
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
                  placeholder="Ej: Worker Producción"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
                💡 <strong>Ejemplos válidos:</strong>
                <ul className="mt-1 ml-4 space-y-1 font-mono text-blue-600">
                  <li>• http://146.190.119.145:3001</li>
                  <li>• worker1.midominio.com:3001</li>
                  <li>• 192.168.1.100:3001</li>
                  <li>• api1.psic-danieladiaz.com</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition-colors"
            >
              ✅ Agregar Worker
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddWorker(false);
                setUseCustomUrl(false);
                setNewWorkerPort("");
                setNewWorkerHost("localhost");
                setNewWorkerName("");
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded font-medium transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mt-3 text-xs text-gray-400">
        💡 Las solicitudes se enviarán a{" "}
        <span className="font-mono text-gray-200">{selectedWorker.url}</span>
      </div>
    </div>
  );
}
