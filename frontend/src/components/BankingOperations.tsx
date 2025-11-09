'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { apiClient } from '@/lib/api';

export default function BankingOperations() {
  const { accounts, refreshUserData, selectedWorker } = useApp();
  const [operation, setOperation] = useState<'transfer' | 'deposit' | 'withdraw'>('transfer');
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      let response;
      const monto = parseFloat(amount);

      if (operation === 'transfer') {
        response = await apiClient.transfer(fromAccount, toAccount, monto);
      } else if (operation === 'deposit') {
        response = await apiClient.deposit(fromAccount, monto);
      } else {
        response = await apiClient.withdraw(fromAccount, monto);
      }

      setResult({ success: true, message: response.mensaje || 'Operation successful' });
      await refreshUserData();
      setAmount('');
    } catch (error) {
      setResult({ success: false, message: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-bold text-white mb-4">💰 Operaciones Bancarias</h3>
      
      <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500 rounded-lg">
        <p className="text-sm text-blue-400">
          🔌 Las operaciones se enviarán a: <span className="font-mono font-bold">{selectedWorker.name}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tipo de Operación
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'transfer', label: 'Transferir' },
              { value: 'deposit', label: 'Depositar' },
              { value: 'withdraw', label: 'Retirar' }
            ].map((op) => (
              <button
                key={op.value}
                type="button"
                onClick={() => setOperation(op.value as 'transfer' | 'deposit' | 'withdraw')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  operation === op.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {operation === 'transfer' ? 'Desde la Cuenta' : 'Cuenta'}
          </label>
          <select
            value={fromAccount}
            onChange={(e) => setFromAccount(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            required
          >
            <option value="">Seleccionar cuenta</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.nombre} ({account.numeroCuenta}) - ${account.saldo.toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        {operation === 'transfer' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Hacia la Cuenta
            </label>
            <select
              value={toAccount}
              onChange={(e) => setToAccount(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option value="">Seleccionar destino</option>
              {accounts
                .filter((acc) => acc.id !== fromAccount)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.nombre} ({account.numeroCuenta})
                  </option>
                ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Monto ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        {result && (
          <div
            className={`p-4 rounded-lg border ${
              result.success
                ? 'bg-green-500/10 border-green-500 text-green-400'
                : 'bg-red-500/10 border-red-500 text-red-400'
            }`}
          >
            {result.message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Procesando...' : `Ejecutar ${operation === 'transfer' ? 'Transferencia' : operation === 'deposit' ? 'Depósito' : 'Retiro'}`}
        </button>
      </form>
    </div>
  );
}
