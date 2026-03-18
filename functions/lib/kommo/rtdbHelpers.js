"use strict";
/**
 * Realtime Database helpers for clientes (Kommo integration).
 * App stores clientes in RTDB; these helpers find and update them by telefono / kommo IDs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.findClienteByPhoneRTDB = findClienteByPhoneRTDB;
exports.findClienteByKommoContactIdRTDB = findClienteByKommoContactIdRTDB;
exports.findClienteByKommoLeadIdRTDB = findClienteByKommoLeadIdRTDB;
exports.resolveClienteIdRTDB = resolveClienteIdRTDB;
exports.updateClienteKommoIdsRTDB = updateClienteKommoIdsRTDB;
const database_1 = require("firebase-admin/database");
const phoneUtils_1 = require("./phoneUtils");
const CLIENTES_PATH = "clientes";
const PHONE_FIELDS = ["telefono1", "telefono2", "telefono3"];
function normalizeFromRecord(phone) {
    if (phone == null)
        return "";
    return phone.toString().replace(/\D/g, "");
}
/**
 * Find a client in Realtime DB by normalized phone number.
 * Matches against telefono1, telefono2, or telefono3 (and legacy telefono if present).
 */
async function findClienteByPhoneRTDB(phone) {
    const normalized = (0, phoneUtils_1.normalizePhone)(phone);
    if (!normalized)
        return null;
    const db = (0, database_1.getDatabase)();
    const snapshot = await db.ref(CLIENTES_PATH).once("value");
    const val = snapshot.val();
    if (!val || typeof val !== "object")
        return null;
    for (const [id, c] of Object.entries(val)) {
        const fieldsToCheck = [...PHONE_FIELDS, "telefono"];
        for (const key of fieldsToCheck) {
            const tel = normalizeFromRecord(c === null || c === void 0 ? void 0 : c[key]);
            if (tel && tel === normalized) {
                return Object.assign({ id }, c);
            }
        }
    }
    return null;
}
/**
 * Find a client by Kommo contact ID.
 */
async function findClienteByKommoContactIdRTDB(kommoContactId) {
    var _a;
    const db = (0, database_1.getDatabase)();
    const snapshot = await db.ref(CLIENTES_PATH).once("value");
    const val = snapshot.val();
    if (!val || typeof val !== "object")
        return null;
    for (const [id, c] of Object.entries(val)) {
        if (((_a = c === null || c === void 0 ? void 0 : c.kommo_contact_id) !== null && _a !== void 0 ? _a : "") === kommoContactId) {
            return Object.assign({ id }, c);
        }
    }
    return null;
}
/**
 * Find a client by Kommo lead ID.
 */
async function findClienteByKommoLeadIdRTDB(kommoLeadId) {
    const db = (0, database_1.getDatabase)();
    const snapshot = await db.ref(CLIENTES_PATH).once("value");
    const val = snapshot.val();
    if (!val || typeof val !== "object")
        return null;
    for (const [id, c] of Object.entries(val)) {
        const leadId = c === null || c === void 0 ? void 0 : c.kommo_lead_id;
        if (leadId !== undefined && leadId !== null && Number(leadId) === kommoLeadId) {
            return Object.assign({ id }, c);
        }
    }
    return null;
}
/**
 * Resolve RTDB cliente id from phone or Kommo IDs.
 */
async function resolveClienteIdRTDB(payload) {
    if (payload.phone) {
        const byPhone = await findClienteByPhoneRTDB(payload.phone);
        if (byPhone)
            return byPhone.id;
    }
    if (payload.kommo_contact_id) {
        const byContact = await findClienteByKommoContactIdRTDB(payload.kommo_contact_id);
        if (byContact)
            return byContact.id;
    }
    if (payload.kommo_lead_id != null) {
        const byLead = await findClienteByKommoLeadIdRTDB(payload.kommo_lead_id);
        if (byLead)
            return byLead.id;
    }
    return null;
}
/**
 * Update a cliente in RTDB with Kommo IDs (merge).
 */
async function updateClienteKommoIdsRTDB(clienteId, updates) {
    const db = (0, database_1.getDatabase)();
    await db.ref(`${CLIENTES_PATH}/${clienteId}`).update(updates);
}
//# sourceMappingURL=rtdbHelpers.js.map