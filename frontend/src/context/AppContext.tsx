'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Worker, User, Account, Card } from '@/types';
import { apiClient } from '@/lib/api';

interface AppState {
  selectedWorker: Worker;
  setSelectedWorker: (worker: Worker) => void;
  workers: Worker[];
  addWorker: (worker: Worker) => void;
  removeWorker: (workerId: string) => void;
  user: User | null;
  setUser: (user: User | null) => void;
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  cards: Card[];
  setCards: (cards: Card[]) => void;
  isAuthenticated: boolean;
  logout: () => void;
  refreshUserData: () => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

const defaultWorkers: Worker[] = [
  { id: 'worker1', name: 'Worker 1', url: 'http://localhost:3001', color: 'bg-blue-500' },
  { id: 'worker2', name: 'Worker 2', url: 'http://localhost:3002', color: 'bg-green-500' },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [workers, setWorkers] = useState<Worker[]>(defaultWorkers);
  const [selectedWorker, setSelectedWorkerState] = useState<Worker>(defaultWorkers[0]);
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    apiClient.setWorker(selectedWorker);
  }, [selectedWorker]);

  // Sincronizar logout entre pestañas (permitir múltiples usuarios en diferentes tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Solo sincronizar cuando se hace logout explícito
      if (e.key === 'logout-event') {
        const logoutData = e.newValue ? JSON.parse(e.newValue) : null;
        if (logoutData && user && logoutData.userId === user.id) {
          // Solo cerrar sesión si es el mismo usuario
          setUser(null);
          setAccounts([]);
          setCards([]);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user]);

  const setSelectedWorker = (worker: Worker) => {
    setSelectedWorkerState(worker);
    apiClient.setWorker(worker);
  };

  const addWorker = (worker: Worker) => {
    setWorkers((prev) => [...prev, worker]);
  };

  const removeWorker = (workerId: string) => {
    setWorkers((prev) => prev.filter((w) => w.id !== workerId));
    if (selectedWorker.id === workerId && workers.length > 1) {
      const remainingWorkers = workers.filter((w) => w.id !== workerId);
      setSelectedWorker(remainingWorkers[0]);
    }
  };

  const refreshUserData = async () => {
    try {
      const data = await apiClient.getMe();
      setUser(data.usuario);
      setAccounts(data.cuentas || []);
      setCards(data.tarjetas || []);
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const logout = () => {
    // Emitir evento de logout para sincronizar con otras pestañas
    if (user) {
      localStorage.setItem('logout-event', JSON.stringify({ 
        userId: user.id, 
        timestamp: Date.now() 
      }));
      // Limpiar el evento después de un momento
      setTimeout(() => localStorage.removeItem('logout-event'), 100);
    }
    
    apiClient.logout();
    setUser(null);
    setAccounts([]);
    setCards([]);
  };

  const isAuthenticated = user !== null;

  return (
    <AppContext.Provider
      value={{
        selectedWorker,
        setSelectedWorker,
        workers,
        addWorker,
        removeWorker,
        user,
        setUser,
        accounts,
        setAccounts,
        cards,
        setCards,
        isAuthenticated,
        logout,
        refreshUserData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
