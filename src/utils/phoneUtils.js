/**
 * Phone normalization for Kommo integration (match with backend).
 * Removes spaces, dashes, parentheses; keeps digits only. Optional E.164 for Aruba (+297).
 */

const NON_DIGIT_REGEX = /[\s\-\.()\+]/g;

/**
 * Normalizes phone to digits only. e.g. "+1 555 123-4567" -> "15551234567"
 * @param {string|null|undefined} phone
 * @returns {string}
 */
export function normalizePhone(phone) {
  if (phone == null || typeof phone !== "string") return "";
  return phone.replace(NON_DIGIT_REGEX, "");
}

/**
 * Optional: E.164 for Aruba (default country code 297).
 * @param {string|null|undefined} phone
 * @param {string} [defaultCountryCode="297"]
 * @returns {string}
 */
export function normalizePhoneE164(phone, defaultCountryCode = "297") {
  const digits = normalizePhone(phone);
  if (!digits) return "";
  if (digits.startsWith("1") && digits.length >= 11) return digits;
  if (digits.length <= 10 && defaultCountryCode) {
    return `${defaultCountryCode}${digits}`;
  }
  return digits;
}
