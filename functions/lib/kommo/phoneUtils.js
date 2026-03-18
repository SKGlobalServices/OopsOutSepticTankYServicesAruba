"use strict";
/**
 * Phone number normalization for matching Kommo contacts/leads with RTDB clientes.
 * Rules: remove spaces and special characters, keep digits only, optional E.164 prefix.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = normalizePhone;
exports.normalizePhoneE164 = normalizePhoneE164;
const NON_DIGIT_REGEX = /[\s\-\.\(\)\+]/g;
/**
 * Normalizes a phone number to digits only (optionally with leading country code).
 * Example: "+1 555 123-4567" → "15551234567"
 */
function normalizePhone(phone) {
    if (phone == null || typeof phone !== "string")
        return "";
    const digits = phone.replace(NON_DIGIT_REGEX, "");
    return digits;
}
/**
 * Optional: ensure E.164 format by adding a default country code when missing.
 * Adjust defaultCountryCode for your region (e.g. 297 for Aruba).
 */
function normalizePhoneE164(phone, defaultCountryCode = "297") {
    const digits = normalizePhone(phone);
    if (!digits)
        return "";
    if (digits.startsWith("1") && digits.length >= 11)
        return digits;
    if (digits.length <= 10 && defaultCountryCode) {
        return `${defaultCountryCode}${digits}`;
    }
    return digits;
}
//# sourceMappingURL=phoneUtils.js.map