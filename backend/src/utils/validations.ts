import { z } from "zod";

// ============== SCHEMAS DE VALIDACIÓN ==============

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Password debe tener mínimo 8 caracteres"),
});

export const registerSchema = z.object({
  nombre: z.string().min(2, "Nombre debe tener mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Password debe tener mínimo 8 caracteres"),
});

export const changePasswordSchema = z.object({
  passwordActual: z.string().min(1, "Password actual requerido"),
  passwordNueva: z
    .string()
    .min(8, "Password nueva debe tener mínimo 8 caracteres"),
});

export const transferenciaSchema = z.object({
  cuentaOrigen: z
    .string()
    .regex(/^\d{4}-\d{4}-\d{4}$/, "Formato de cuenta inválido"),
  cuentaDestino: z
    .string()
    .regex(/^\d{4}-\d{4}-\d{4}$/, "Formato de cuenta inválido"),
  monto: z
    .number()
    .positive("Monto debe ser positivo")
    .max(50000, "Monto excede límite"),
  descripcion: z.string().optional(),
});

export const depositoSchema = z.object({
  numeroCuenta: z
    .string()
    .regex(/^\d{4}-\d{4}-\d{4}$/, "Formato de cuenta inválido"),
  monto: z
    .number()
    .positive("Monto debe ser positivo")
    .max(100000, "Monto excede límite"),
  descripcion: z.string().optional(),
});

export const retiroSchema = z.object({
  numeroCuenta: z
    .string()
    .regex(/^\d{4}-\d{4}-\d{4}$/, "Formato de cuenta inválido"),
  monto: z
    .number()
    .positive("Monto debe ser positivo")
    .max(10000, "Monto excede límite"),
  descripcion: z.string().optional(),
});

// ============== TIPOS ==============

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type TransferenciaInput = z.infer<typeof transferenciaSchema>;
export type DepositoInput = z.infer<typeof depositoSchema>;
export type RetiroInput = z.infer<typeof retiroSchema>;
