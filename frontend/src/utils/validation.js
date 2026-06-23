export const PHONE_ERROR =
  "Phone must be 11 digits and start with 0 (e.g. 03001234567).";
export const EMAIL_ERROR = "Enter a valid email address.";

export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isValidPkPhone(value) {
  const normalized = normalizePhone(value);
  return /^0\d{10}$/.test(normalized);
}

export function isValidEmail(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function validatePhone(value, { required = false } = {}) {
  const normalized = normalizePhone(value);
  if (!normalized) {
    return required ? PHONE_ERROR : null;
  }
  return isValidPkPhone(normalized) ? null : PHONE_ERROR;
}

export function validateEmail(value, { required = false } = {}) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return required ? EMAIL_ERROR : null;
  }
  return isValidEmail(trimmed) ? null : EMAIL_ERROR;
}
