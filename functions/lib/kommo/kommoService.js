"use strict";
/**
 * Kommo business logic: send message to lead (CRM API), process webhook payload.
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPhoneCandidatesFromPayload = extractPhoneCandidatesFromPayload;
exports.sendMessageToLead = sendMessageToLead;
exports.extractPhoneFromPayload = extractPhoneFromPayload;
exports.extractIdsFromPayload = extractIdsFromPayload;
exports.extractMessageTextFromPayload = extractMessageTextFromPayload;
exports.processWebhookAsync = processWebhookAsync;
const firestore_1 = require("firebase-admin/firestore");
const kommoClient_1 = require("./kommoClient");
const kommoOAuth_1 = require("./kommoOAuth");
const firestoreHelpers_1 = require("./firestoreHelpers");
const rtdbHelpers_1 = require("./rtdbHelpers");
const phoneUtils_1 = require("./phoneUtils");
const KOMMO_DOMAIN = (_a = process.env.KOMMO_DOMAIN) !== null && _a !== void 0 ? _a : "";
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function extractStringValue(value) {
    if (typeof value === "string")
        return value;
    if (typeof value === "number")
        return String(value);
    return undefined;
}
function collectPhoneValuesFromFields(fields) {
    var _a, _b, _c, _d, _e, _f;
    if (!Array.isArray(fields))
        return [];
    const phones = [];
    for (const field of fields) {
        if (!isRecord(field))
            continue;
        const fieldName = (_b = (_a = extractStringValue(field.name)) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : "";
        const fieldLabel = (_d = (_c = extractStringValue(field.field_name)) === null || _c === void 0 ? void 0 : _c.toLowerCase()) !== null && _d !== void 0 ? _d : "";
        const fieldCode = (_f = (_e = extractStringValue(field.field_code)) === null || _e === void 0 ? void 0 : _e.toLowerCase()) !== null && _f !== void 0 ? _f : "";
        const isPhoneField = fieldName.includes("phone") ||
            fieldName.includes("tel") ||
            fieldName.includes("telefono") ||
            fieldLabel.includes("phone") ||
            fieldLabel.includes("tel") ||
            fieldLabel.includes("telefono") ||
            fieldCode.includes("phone") ||
            fieldCode.includes("tel") ||
            fieldCode.includes("phone");
        if (!isPhoneField)
            continue;
        const values = Array.isArray(field.values) ? field.values : [];
        for (const valueEntry of values) {
            if (!isRecord(valueEntry))
                continue;
            const value = extractStringValue(valueEntry.value);
            if (value)
                phones.push(value);
        }
    }
    return phones;
}
/**
 * Extract all phone candidates from Kommo webhook payload (leads or contacts).
 */
function extractPhoneCandidatesFromPayload(payload) {
    var _a, _b;
    const candidates = new Set();
    const sections = ["leads", "contacts"];
    for (const sectionName of sections) {
        const section = payload[sectionName];
        if (!isRecord(section))
            continue;
        const entries = [
            ...(Array.isArray(section.add) ? section.add : []),
            ...(Array.isArray(section.update) ? section.update : []),
        ];
        for (const entry of entries) {
            if (!isRecord(entry))
                continue;
            const customFields = (_b = (_a = entry.custom_fields_values) !== null && _a !== void 0 ? _a : entry.custom_fields) !== null && _b !== void 0 ? _b : entry.custom_fields_values;
            for (const phone of collectPhoneValuesFromFields(customFields)) {
                candidates.add(phone);
            }
        }
    }
    const notes = payload.notes;
    if (isRecord(notes) && Array.isArray(notes.add)) {
        for (const entry of notes.add) {
            if (!isRecord(entry))
                continue;
            const params = isRecord(entry.params) ? entry.params : undefined;
            const phone = extractStringValue(params === null || params === void 0 ? void 0 : params.phone);
            if (phone)
                candidates.add(phone);
        }
    }
    return Array.from(candidates);
}
/**
 * Send a text message to a lead via Kommo CRM API (add note to lead).
 * Uses POST /api/v4/leads/notes with note_type that creates a message on the lead.
 */
async function sendMessageToLead(leadId, message, clientId, clientSecret) {
    var _a, _b, _c, _d;
    const accessToken = await (0, kommoOAuth_1.getValidAccessToken)(clientId, clientSecret);
    const client = (0, kommoClient_1.createKommoClient)(accessToken, KOMMO_DOMAIN);
    try {
        const res = await client.post("/leads/notes", [
            {
                entity_id: leadId,
                note_type: "common",
                params: {
                    text: message,
                },
            },
        ]);
        const noteId = (_d = (_c = (_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a._embedded) === null || _b === void 0 ? void 0 : _b.notes) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.id;
        const firestore = (0, firestore_1.getFirestore)();
        const clienteId = await (0, rtdbHelpers_1.resolveClienteIdRTDB)({ kommo_lead_id: leadId });
        await (0, firestoreHelpers_1.saveMessage)(firestore, {
            clienteId,
            text: message,
            direction: "outbound",
            lead_id: leadId,
        });
        return { success: true, noteId };
    }
    catch (err) {
        const message = err && typeof err === "object" && "message" in err
            ? String(err.message)
            : "Unknown error";
        return { success: false, error: message };
    }
}
/**
 * Extract phone from Kommo webhook payload (leads or contacts).
 */
function extractPhoneFromPayload(payload) {
    return extractPhoneCandidatesFromPayload(payload)[0];
}
/**
 * Extract lead_id and contact id from webhook payload.
 */
function extractIdsFromPayload(payload) {
    var _a, _b, _c, _d, _e;
    const out = {};
    const leads = payload.leads;
    if (leads) {
        const add = (_a = leads.add) === null || _a === void 0 ? void 0 : _a[0];
        const upd = (_b = leads.update) === null || _b === void 0 ? void 0 : _b[0];
        const item = add !== null && add !== void 0 ? add : upd;
        if (item === null || item === void 0 ? void 0 : item.id)
            out.lead_id = Number(item.id);
    }
    const contacts = payload.contacts;
    if (contacts) {
        const add = (_c = contacts.add) === null || _c === void 0 ? void 0 : _c[0];
        const upd = (_d = contacts.update) === null || _d === void 0 ? void 0 : _d[0];
        const item = add !== null && add !== void 0 ? add : upd;
        if (item === null || item === void 0 ? void 0 : item.id)
            out.contact_id = String(item.id);
    }
    const notes = payload.notes;
    if (notes === null || notes === void 0 ? void 0 : notes.add) {
        const add = (_e = notes.add) === null || _e === void 0 ? void 0 : _e[0];
        if (add === null || add === void 0 ? void 0 : add.entity_id)
            out.lead_id = Number(add.entity_id);
    }
    return out;
}
/**
 * Extract message text from webhook (e.g. from notes.add).
 */
function extractMessageTextFromPayload(payload) {
    var _a;
    const notes = payload.notes;
    if (notes === null || notes === void 0 ? void 0 : notes.add) {
        const add = (_a = notes.add) === null || _a === void 0 ? void 0 : _a[0];
        const params = add === null || add === void 0 ? void 0 : add.params;
        if (params === null || params === void 0 ? void 0 : params.text)
            return params.text;
    }
    return undefined;
}
/**
 * Process webhook payload asynchronously: normalize phone, find client, save message, optionally link Kommo IDs.
 */
async function processWebhookAsync(payload) {
    const firestore = (0, firestore_1.getFirestore)();
    const phoneCandidates = extractPhoneCandidatesFromPayload(payload);
    const phoneNormalizedCandidates = phoneCandidates
        .map((phone) => (0, phoneUtils_1.normalizePhone)(phone))
        .filter((phone) => Boolean(phone));
    const { lead_id, contact_id } = extractIdsFromPayload(payload);
    let clienteId = await (0, rtdbHelpers_1.resolveClienteIdRTDB)({
        kommo_contact_id: contact_id,
        kommo_lead_id: lead_id,
    });
    if (!clienteId) {
        for (const phone of phoneNormalizedCandidates) {
            const resolved = await (0, rtdbHelpers_1.resolveClienteIdRTDB)({ phone });
            if (resolved) {
                clienteId = resolved;
                break;
            }
        }
    }
    const text = extractMessageTextFromPayload(payload);
    if (text) {
        await (0, firestoreHelpers_1.saveMessage)(firestore, {
            clienteId,
            phoneNormalized: phoneNormalizedCandidates[0],
            text,
            direction: "inbound",
            kommo_message_id: undefined,
            lead_id,
        });
    }
    if (clienteId && (contact_id || lead_id != null)) {
        await (0, rtdbHelpers_1.updateClienteKommoIdsRTDB)(clienteId, Object.assign(Object.assign({}, (contact_id && { kommo_contact_id: contact_id })), (lead_id != null && { kommo_lead_id: lead_id })));
    }
}
//# sourceMappingURL=kommoService.js.map