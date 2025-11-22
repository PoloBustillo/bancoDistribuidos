// Utilidades de validación para formularios

/**
 * Valida que un email tenga formato válido
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Valida que un monto sea válido
 */
export function isValidAmount(amount: string | number): boolean {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return !isNaN(num) && num > 0 && isFinite(num);
}

/**
 * Valida que un monto no exceda un límite
 */
export function isAmountWithinLimit(
  amount: string | number,
  max: number
): boolean {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return isValidAmount(num) && num <= max;
}

/**
 * Formatea un monto a formato de moneda
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}

/**
 * Valida que un monto tenga máximo 2 decimales
 */
export function hasValidDecimals(amount: string): boolean {
  if (!amount) return true;
  const parts = amount.split(".");
  if (parts.length === 1) return true;
  if (parts.length === 2) return parts[1].length <= 2;
  return false;
}

/**
 * Determina si un retiro es considerado "grande" (más del 50% del saldo o más de $10,000)
 */
export function isLargeWithdrawal(amount: number, balance: number): boolean {
  return amount > balance * 0.5 || amount > 10000;
}

/**
 * Limpia y formatea un input de monto
 */
export function sanitizeAmountInput(value: string): string {
  // Remover caracteres no numéricos excepto punto decimal
  let cleaned = value.replace(/[^\d.]/g, "");

  // Asegurar solo un punto decimal
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = parts[0] + "." + parts.slice(1).join("");
  }

  // Limitar a 2 decimales
  if (parts.length === 2 && parts[1].length > 2) {
    cleaned = parts[0] + "." + parts[1].substring(0, 2);
  }

  return cleaned;
}

/**
 * Obtiene el mensaje de error apropiado para una validación de email
 */
export function getEmailErrorMessage(email: string): string | null {
  if (!email.trim()) {
    return "El email es requerido";
  }
  if (!isValidEmail(email)) {
    return "Formato de email inválido";
  }
  return null;
}

/**
 * Obtiene el mensaje de error apropiado para una validación de monto
 */
export function getAmountErrorMessage(
  amount: string,
  balance?: number
): string | null {
  if (!amount) {
    return "El monto es requerido";
  }

  if (!isValidAmount(amount)) {
    return "Monto inválido";
  }

  const num = parseFloat(amount);

  if (num <= 0) {
    return "El monto debe ser mayor a $0";
  }

  if (!hasValidDecimals(amount)) {
    return "Máximo 2 decimales permitidos";
  }

  if (balance !== undefined && num > balance) {
    return "Fondos insuficientes";
  }

  return null;
}

/**
 * Valida que un número de cuenta tenga formato válido
 * Acepta formatos: 1234567890, 1234-5678-90, 1234 5678 90
 */
export function isValidAccountNumber(accountNumber: string): boolean {
  if (!accountNumber || !accountNumber.trim()) {
    return false;
  }

  // Remover guiones y espacios
  const cleaned = accountNumber.replace(/[-\s]/g, "");

  // Debe tener al menos 4 dígitos y máximo 20
  // Solo números permitidos
  const accountRegex = /^\d{4,20}$/;
  return accountRegex.test(cleaned);
}

/**
 * Valida si un string es un UUID válido
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Formatea un número de cuenta para mostrar
 * Ejemplo: 1234567890 → 1234-5678-90
 */
export function formatAccountNumber(accountNumber: string): string {
  // Remover caracteres no numéricos
  const cleaned = accountNumber.replace(/\D/g, "");

  // Si tiene más de 4 dígitos, agregar guiones
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 8) return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;

  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
}

/**
 * Obtiene el mensaje de error para número de cuenta
 */
export function getAccountNumberErrorMessage(
  accountNumber: string
): string | null {
  if (!accountNumber || !accountNumber.trim()) {
    return "El número de cuenta es requerido";
  }

  if (!isValidAccountNumber(accountNumber)) {
    return "Formato de cuenta inválido. Debe contener entre 4 y 20 dígitos";
  }

  return null;
}
