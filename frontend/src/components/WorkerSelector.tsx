'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';

const workerColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-yellow-500'];

export default function WorkerSelector() {
  const { selectedWorker, setSelectedWorker, workers, addWorker, removeWorker } = useApp();
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorkerPort, setNewWorkerPort] = useState('');

  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();
    const port = parseInt(newWorkerPort);
    if (port < 1024 || port > 65535) {
      alert('El puerto debe estar entre 1024 y 65535');
      return;
    }

    const workerId = `worker-${port}`;
    if (workers.some(w => w.id === workerId)) {
      alert('Ya existe un worker en ese puerto');
      return;
    }

    const newWorker = {
      id: workerId,
      name: `Worker ${port}`,
      url: `http://localhost:${port}`,
      color: workerColors[workers.length % workerColors.length],
    };

    addWorker(newWorker);
    setNewWorkerPort('');
    setShowAddWorker(false);
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        🔌 Selección de Worker
      </h3>
      
      <div className="flex flex-wrap gap-2 mb-3">
        {workers.map((worker) => (
          <div key={worker.id} className="flex items-center gap-1">
            <button
              onClick={() => setSelectedWorker(worker)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedWorker.id === worker.id
                  ? `${worker.color} text-white shadow-lg`
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    selectedWorker.id === worker.id ? 'bg-white animate-pulse' : 'bg-gray-500'
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
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium transition-colors"
        >
          ➕ Agregar Worker
        </button>
      </div>

      {showAddWorker && (
        <form onSubmit={handleAddWorker} className="flex gap-2 p-3 bg-gray-700/50 rounded-lg">
          <input
            type="number"
            value={newWorkerPort}
            onChange={(e) => setNewWorkerPort(e.target.value)}
            placeholder="Puerto (ej: 3003)"
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            required
            min="1024"
            max="65535"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
          >
            Agregar
          </button>
          <button
            type="button"
            onClick={() => setShowAddWorker(false)}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors"
          >
            Cancelar
          </button>
        </form>
      )}

      <div className="mt-3 text-xs text-gray-400">
        💡 Las solicitudes se enviarán a <span className="font-mono text-gray-200">{selectedWorker.url}</span>
      </div>
    </div>
  );
}
