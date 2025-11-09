// Types for the distributed banking system

export interface Worker {
  id: string;
  name: string;
  url: string;
  color: string;
}

export interface User {
  id: string;
  nombre: string;
  email: string;
}

export interface Account {
  id: string;
  numeroCuenta: string;
  nombre: string;
  tipoCuenta: 'CHEQUES' | 'DEBITO' | 'CREDITO';
  saldo: number;
  estado: 'ACTIVA' | 'BLOQUEADA';
  rol?: 'TITULAR' | 'AUTORIZADO' | 'CONSULTA';
}

export interface Card {
  id: string;
  numeroTarjeta: string;
  tipoTarjeta: 'DEBITO' | 'CREDITO';
  estado: 'ACTIVA' | 'BLOQUEADA' | 'CANCELADA';
  fechaExpiracion: string;
}

export interface LoginResponse {
  token: string;
  usuario: User;
  cuentas: Account[];
  tarjetas: Card[];
}

export interface RegisterResponse {
  token: string;
  usuarioId: string;
  nombre: string;
  email: string;
  numeroCuenta: string;
  cuentaId: string;
  tarjeta: {
    numeroTarjeta: string;
    tipo: string;
    expiracion: string;
  };
}

export interface TransferRequest {
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  monto: number;
}

export interface DepositRequest {
  cuentaId: string;
  monto: number;
}

export interface WithdrawRequest {
  cuentaId: string;
  monto: number;
}

export interface AccountUser {
  id: string;
  nombre: string;
  email: string;
  rol: 'TITULAR' | 'AUTORIZADO' | 'CONSULTA';
}

export interface ShareAccountRequest {
  emailUsuario: string;
  rol: 'TITULAR' | 'AUTORIZADO' | 'CONSULTA';
}
