// ========================================
// 🎯 SISTEMA DE VALIDACIÓN CENTRALIZADO
// ========================================
// Validaciones reutilizables con mensajes de error claros
// Reemplaza validaciones dispersas por un sistema unificado
// ========================================

import { z } from "zod";
import { CONFIG, Validators } from "./config";

// ========================================
// 🎯 MENSAJES DE ERROR PERSONALIZADOS
// ========================================
export const ValidationMessages = {
  REQUIRED: "Este campo es requerido",
  INVALID_EMAIL: "Formato de email inválido",
  INVALID_PASSWORD: `La contraseña debe tener al menos ${CONFIG.AUTH.MIN_PASSWORD_LENGTH} caracteres`,
  INVALID_AMOUNT: `El monto debe ser mayor a $${CONFIG.BANKING.MIN_AMOUNT}`,
  INVALID_UUID: "ID inválido",
  INVALID_ACCOUNT_NUMBER: `Número de cuenta debe tener ${CONFIG.BANKING.ACCOUNT_NUMBER_LENGTH} dígitos`,
  INVALID_CARD_NUMBER: `Número de tarjeta debe tener ${CONFIG.BANKING.CARD_NUMBER_LENGTH} dígitos`,
  INVALID_VERIFICATION_CODE: `Código debe tener ${CONFIG.AUTH.VERIFICATION_CODE_LENGTH} dígitos`,
  INVALID_LAST_DIGITS: `Últimos dígitos deben ser ${CONFIG.AUTH.LAST_DIGITS_LENGTH} números`,
  AMOUNT_TOO_HIGH: `El monto no puede exceder $${CONFIG.BANKING.MAX_TRANSFER_AMOUNT.toLocaleString()}`,
  INVALID_ROLE: "Rol de usuario inválido",
  INVALID_CARD_STATE: "Estado de tarjeta inválido",
  INVALID_ACCOUNT_STATE: "Estado de cuenta inválido",
} as const;

// ========================================
// 🎯 SCHEMAS BASE REUTILIZABLES
// ========================================

// Validadores básicos
export const BaseSchemas = {
  email: z.string().email(ValidationMessages.INVALID_EMAIL),

  password: z
    .string()
    .min(CONFIG.AUTH.MIN_PASSWORD_LENGTH, ValidationMessages.INVALID_PASSWORD),

  uuid: z.string().uuid(ValidationMessages.INVALID_UUID),

  amount: z
    .number()
    .positive(ValidationMessages.INVALID_AMOUNT)
    .max(CONFIG.BANKING.MAX_TRANSFER_AMOUNT, ValidationMessages.AMOUNT_TOO_HIGH)
    .refine(Validators.isValidAmount, ValidationMessages.INVALID_AMOUNT),

  accountNumber: z
    .string()
    .refine(
      Validators.isValidAccountNumber,
      ValidationMessages.INVALID_ACCOUNT_NUMBER
    ),

  cardNumber: z
    .string()
    .refine(
      Validators.isValidCardNumber,
      ValidationMessages.INVALID_CARD_NUMBER
    ),

  verificationCode: z
    .string()
    .refine(
      Validators.isValidVerificationCode,
      ValidationMessages.INVALID_VERIFICATION_CODE
    ),

  lastDigits: z
    .string()
    .refine(
      Validators.isValidLastDigits,
      ValidationMessages.INVALID_LAST_DIGITS
    ),

  accountRole: z.enum(["TITULAR", "AUTORIZADO", "CONSULTA"] as const, {
    error: () => ({ message: ValidationMessages.INVALID_ROLE }),
  }),

  cardState: z.enum(["ACTIVA", "BLOQUEADA", "CANCELADA"] as const, {
    error: () => ({ message: ValidationMessages.INVALID_CARD_STATE }),
  }),

  accountState: z.enum(["ACTIVA", "BLOQUEADA", "CERRADA"] as const, {
    error: () => ({ message: ValidationMessages.INVALID_ACCOUNT_STATE }),
  }),

  accountType: z.enum(["CHEQUES", "DEBITO", "CREDITO"] as const),

  cardType: z.enum(["DEBITO", "CREDITO"] as const),

  priority: z.enum(["BAJA", "NORMAL", "ALTA", "CRITICA"] as const),
} as const;

// ========================================
// 🎯 SCHEMAS DE AUTENTICACIÓN
// ========================================
export const AuthSchemas = {
  register: z.object({
    nombre: z.string().min(1, ValidationMessages.REQUIRED),
    email: BaseSchemas.email,
    password: BaseSchemas.password,
  }),

  login: z.object({
    email: BaseSchemas.email,
    password: z.string().min(1, ValidationMessages.REQUIRED),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, ValidationMessages.REQUIRED),
    newPassword: BaseSchemas.password,
  }),
} as const;

// ========================================
// 🎯 SCHEMAS BANCARIOS
// ========================================
export const BankingSchemas = {
  transfer: z
    .object({
      cuentaOrigenId: BaseSchemas.uuid,
      cuentaDestinoId: BaseSchemas.uuid,
      monto: BaseSchemas.amount,
    })
    .refine((data) => data.cuentaOrigenId !== data.cuentaDestinoId, {
      message: "No se puede transferir a la misma cuenta",
      path: ["cuentaDestinoId"],
    }),

  deposit: z.object({
    cuentaId: BaseSchemas.uuid,
    monto: BaseSchemas.amount,
  }),

  withdraw: z.object({
    cuentaId: BaseSchemas.uuid,
    monto: BaseSchemas.amount,
  }),

  checkBalance: z.object({
    cuentaId: BaseSchemas.uuid,
  }),
} as const;

// ========================================
// 🎯 SCHEMAS DE CUENTAS COMPARTIDAS
// ========================================
export const SharedAccountSchemas = {
  addUser: z.object({
    emailUsuario: BaseSchemas.email,
    rol: BaseSchemas.accountRole.optional().default("AUTORIZADO"),
  }),

  removeUser: z.object({
    usuarioId: BaseSchemas.uuid,
  }),

  createAccount: z.object({
    tipoCuenta: BaseSchemas.accountType,
    nombre: z.string().optional(),
  }),

  createCard: z.object({
    tipoTarjeta: BaseSchemas.cardType.optional().default("DEBITO"),
  }),

  changeCardState: z.object({
    estado: BaseSchemas.cardState,
  }),
} as const;

// ========================================
// 🎯 SCHEMAS DE ASESORES
// ========================================
export const AdvisorSchemas = {
  verifyClient: z.object({
    asesorId: BaseSchemas.uuid,
    numeroRecurso: z.string().min(1, ValidationMessages.REQUIRED),
    ultimosDigitos: BaseSchemas.lastDigits,
    codigo: BaseSchemas.verificationCode,
  }),

  generateVerificationCode: z.object({}), // No requiere parámetros

  advisorAction: z.object({
    usuarioId: BaseSchemas.uuid,
  }),
} as const;

// ========================================
// 🎯 SCHEMAS DE LOCKS DISTRIBUIDOS
// ========================================
export const LockSchemas = {
  lockRequest: z.object({
    recursos: z
      .array(
        z.object({
          tipo: z.enum(["CUENTA", "TARJETA"] as const),
          id: BaseSchemas.uuid,
        })
      )
      .min(1, "Debe especificar al menos un recurso"),
    prioridad: z.number().min(0).max(3).default(1),
    timeout: z
      .number()
      .positive()
      .max(CONFIG.TIMEOUTS.MAX_LOCK_TIME)
      .default(CONFIG.TIMEOUTS.DEFAULT_LOCK_TIMEOUT),
    operacion: z.string().min(1, ValidationMessages.REQUIRED),
  }),

  lockRelease: z.object({
    lockId: z.string().min(1, ValidationMessages.REQUIRED),
    recursos: z
      .array(BaseSchemas.uuid)
      .min(1, "Debe especificar al menos un recurso"),
  }),
} as const;

// ========================================
// 🎯 CLASE VALIDADOR PRINCIPAL
// ========================================
export class ValidationService {
  // ========================================
  // 🎯 MÉTODOS DE VALIDACIÓN GENÉRICOS
  // ========================================

  static validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Datos de entrada inválidos", error.issues);
      }
      throw error;
    }
  }

  static validateAsync<T>(schema: z.ZodSchema<T>, data: unknown): Promise<T> {
    return schema.parseAsync(data).catch((error) => {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Datos de entrada inválidos", error.issues);
      }
      throw error;
    });
  }

  // ========================================
  // 🎯 VALIDACIONES ESPECÍFICAS
  // ========================================

  // Autenticación
  static validateRegister(data: unknown) {
    return this.validate(AuthSchemas.register, data);
  }

  static validateLogin(data: unknown) {
    return this.validate(AuthSchemas.login, data);
  }

  // Operaciones bancarias
  static validateTransfer(data: unknown) {
    return this.validate(BankingSchemas.transfer, data);
  }

  static validateDeposit(data: unknown) {
    return this.validate(BankingSchemas.deposit, data);
  }

  static validateWithdraw(data: unknown) {
    return this.validate(BankingSchemas.withdraw, data);
  }

  // Cuentas compartidas
  static validateAddUser(data: unknown) {
    return this.validate(SharedAccountSchemas.addUser, data);
  }

  static validateRemoveUser(data: unknown) {
    return this.validate(SharedAccountSchemas.removeUser, data);
  }

  static validateCreateAccount(data: unknown) {
    return this.validate(SharedAccountSchemas.createAccount, data);
  }

  // Asesores
  static validateVerifyClient(data: unknown) {
    return this.validate(AdvisorSchemas.verifyClient, data);
  }

  // ========================================
  // 🎯 VALIDACIONES DE NEGOCIO
  // ========================================

  static validateBusinessRules(operation: string, data: any): void {
    switch (operation) {
      case "transfer":
        this.validateTransferRules(data);
        break;
      case "withdraw":
        this.validateWithdrawRules(data);
        break;
      case "deposit":
        this.validateDepositRules(data);
        break;
      default:
        break;
    }
  }

  private static validateTransferRules(data: {
    cuentaOrigenId: string;
    cuentaDestinoId: string;
    monto: number;
  }): void {
    if (data.cuentaOrigenId === data.cuentaDestinoId) {
      throw new BusinessRuleError(
        "No se puede transferir dinero a la misma cuenta"
      );
    }

    if (data.monto > CONFIG.BANKING.MAX_DAILY_LIMIT) {
      throw new BusinessRuleError(
        `El monto excede el límite diario de $${CONFIG.BANKING.MAX_DAILY_LIMIT.toLocaleString()}`
      );
    }
  }

  private static validateWithdrawRules(data: { monto: number }): void {
    if (data.monto > CONFIG.BANKING.MAX_DAILY_LIMIT) {
      throw new BusinessRuleError(
        `El monto excede el límite diario de retiro de $${CONFIG.BANKING.MAX_DAILY_LIMIT.toLocaleString()}`
      );
    }
  }

  private static validateDepositRules(data: { monto: number }): void {
    if (data.monto > CONFIG.BANKING.MAX_DAILY_LIMIT) {
      throw new BusinessRuleError(
        `El monto excede el límite diario de depósito de $${CONFIG.BANKING.MAX_DAILY_LIMIT.toLocaleString()}`
      );
    }
  }
}

// ========================================
// 🎯 ERRORES PERSONALIZADOS
// ========================================
export class ValidationError extends Error {
  public readonly errors: z.ZodIssue[];

  constructor(message: string, errors: z.ZodIssue[]) {
    super(message);
    this.name = "ValidationError";
    this.errors = errors;
  }

  getFormattedErrors(): Record<string, string> {
    const formatted: Record<string, string> = {};

    for (const error of this.errors) {
      const path = error.path.join(".");
      formatted[path] = error.message;
    }

    return formatted;
  }

  getFirstError(): string {
    return this.errors[0]?.message || this.message;
  }
}

export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}

// ========================================
// 🎯 MIDDLEWARE DE VALIDACIÓN PARA EXPRESS
// ========================================
import type { Request, Response, NextFunction } from "express";

export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = ValidationService.validate(schema, req.body);
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: "Datos de entrada inválidos",
          details: error.getFormattedErrors(),
        });
      }

      if (error instanceof BusinessRuleError) {
        return res.status(400).json({
          error: error.message,
        });
      }

      next(error);
    }
  };
}
