"use strict";
/**
 * Phone number normalization for matching Kommo contacts/leads with RTDB clientes.
 * Rules: remove spaces and special characters, keep digits only, optional E.164 prefix.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = normalizePhone;
exports.normalizePhoneE164 = normalizePhoneE164;
exports.phoneMatchCandidates = phoneMatchCandidates;
exports.phoneVariantsOverlap = phoneVariantsOverlap;
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
/**
 * Variants used for matching RTDB telefono* against Kommo (different formats).
 */
function phoneMatchCandidates(input, defaultCountryCode = "297") {
    const raw = normalizePhone(input);
    if (!raw)
        return [];
    const out = new Set();
    out.add(raw);
    const e164 = normalizePhoneE164(input, defaultCountryCode);
    if (e164)
        out.add(e164);
    if (defaultCountryCode && e164.startsWith(defaultCountryCode) && e164.length > defaultCountryCode.length) {
        out.add(e164.slice(defaultCountryCode.length));
    }
    // If Kommo sends 297... and DB has local 7 digits, also compare last 7 (Aruba mobile block)
    if (raw.length >= 7) {
        out.add(raw.slice(-7));
    }
    if (e164.length >= 7) {
        out.add(e164.slice(-7));
    }
    return Array.from(out).filter(Boolean);
}
/**
 * True if any candidate from A matches any candidate from B (exact string match on digits variants).
 */
function phoneVariantsOverlap(a, b, defaultCountryCode = "297") {
    const setA = new Set(phoneMatchCandidates(a, defaultCountryCode));
    const setB = new Set(phoneMatchCandidates(b, defaultCountryCode));
    for (const x of setA) {
        if (setB.has(x))
            return true;
    }
    return false;
}
//# sourceMappingURL=phoneUtils.js.map