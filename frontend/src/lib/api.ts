// API client for distributed banking system

import { Worker } from '@/types';

class ApiClient {
  private baseUrl: string = '';
  private token: string | null = null;

  setWorker(worker: Worker) {
    this.baseUrl = worker.url;
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error en la solicitud');
    }

    return data;
  }

  // Auth endpoints
  async register(nombre: string, email: string, password: string) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nombre, email, password }),
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async getMe() {
    return this.request('/api/auth/me');
  }

  async logout() {
    await this.request('/api/auth/logout', { method: 'POST' });
    this.setToken(null);
  }

  // Banking endpoints
  async transfer(cuentaOrigenId: string, cuentaDestinoId: string, monto: number) {
    return this.request('/api/banco/transferir', {
      method: 'POST',
      body: JSON.stringify({ cuentaOrigenId, cuentaDestinoId, monto }),
    });
  }

  async deposit(cuentaId: string, monto: number) {
    return this.request('/api/banco/depositar', {
      method: 'POST',
      body: JSON.stringify({ cuentaId, monto }),
    });
  }

  async withdraw(cuentaId: string, monto: number) {
    return this.request('/api/banco/retirar', {
      method: 'POST',
      body: JSON.stringify({ cuentaId, monto }),
    });
  }

  async getBalance(cuentaId: string) {
    return this.request('/api/banco/consultar-saldo', {
      method: 'POST',
      body: JSON.stringify({ cuentaId }),
    });
  }

  // Shared accounts endpoints
  async shareAccount(cuentaId: string, emailUsuario: string, rol: string) {
    return this.request(`/api/cuentas-compartidas/${cuentaId}/agregar-usuario`, {
      method: 'POST',
      body: JSON.stringify({ emailUsuario, rol }),
    });
  }

  async getAccountUsers(cuentaId: string) {
    return this.request(`/api/cuentas-compartidas/${cuentaId}/usuarios`);
  }

  async removeUserFromAccount(cuentaId: string, usuarioId: string) {
    return this.request(`/api/cuentas-compartidas/${cuentaId}/remover-usuario`, {
      method: 'DELETE',
      body: JSON.stringify({ usuarioId }),
    });
  }

  async createCard(cuentaId: string, tipoTarjeta: string) {
    return this.request(`/api/cuentas-compartidas/${cuentaId}/tarjetas`, {
      method: 'POST',
      body: JSON.stringify({ tipoTarjeta }),
    });
  }

  async getAccountCards(cuentaId: string) {
    return this.request(`/api/cuentas-compartidas/${cuentaId}/tarjetas`);
  }

  async changeCardStatus(tarjetaId: string, estado: string) {
    return this.request(`/api/tarjetas/${tarjetaId}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    });
  }

  async createAdditionalAccount(tipoCuenta: string, nombre?: string) {
    return this.request('/api/cuentas/crear', {
      method: 'POST',
      body: JSON.stringify({ tipoCuenta, nombre }),
    });
  }
}

export const apiClient = new ApiClient();
