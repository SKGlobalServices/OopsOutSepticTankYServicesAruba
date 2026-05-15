"use strict";
/**
 * Message thread retrieval for a specific Kommo lead.
 * Uses the Notes API (v4) which stores chat messages created by integrations
 * as service_message / extended_service_message notes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessages = getMessages;
const client_1 = require("./client");
const tokenManager_1 = require("./tokenManager");
const services_1 = require("./services");
function getClientId() {
    var _a;
    return (_a = process.env.KOMMO_CLIENT_ID) !== null && _a !== void 0 ? _a : "";
}
function getClientSecret() {
    var _a;
    return (_a = process.env.KOMMO_CLIENT_SECRET) !== null && _a !== void 0 ? _a : "";
}
function getDomain() {
    var _a;
    return (_a = process.env.KOMMO_DOMAIN) !== null && _a !== void 0 ? _a : "";
}
function validateConfig() {
    if (!getClientId())
        return "KOMMO_CLIENT_ID not set";
    if (!getClientSecret())
        return "KOMMO_CLIENT_SECRET not set";
    if (!getDomain())
        return "KOMMO_DOMAIN not set";
    return null;
}
async function getMessages(entityId, page = 1) {
    var _a, _b, _c;
    const configErr = validateConfig();
    if (configErr)
        return { success: false, error: configErr };
    if (!entityId || isNaN(entityId)) {
        return { success: false, error: "Invalid entityId" };
    }
    try {
        const accessToken = await (0, tokenManager_1.getValidAccessToken)(getClientId(), getClientSecret());
        const client = (0, client_1.createKommoClient)(accessToken, getDomain());
        const raw = (await (0, services_1.fetchLeadNotes)(client, entityId, page));
        const noteList = (_b = (_a = raw === null || raw === void 0 ? void 0 : raw._embedded) === null || _a === void 0 ? void 0 : _a.notes) !== null && _b !== void 0 ? _b : [];
        const normalized = noteList.map((n) => {
            var _a, _b, _c, _d, _e, _f, _g;
            return ({
                id: n.id,
                entityId: n.entity_id,
                createdBy: n.created_by,
                createdAt: n.created_at,
                noteType: n.note_type,
                text: (_b = (_a = n.params) === null || _a === void 0 ? void 0 : _a.text) !== null && _b !== void 0 ? _b : null,
                service: (_d = (_c = n.params) === null || _c === void 0 ? void 0 : _c.service) !== null && _d !== void 0 ? _d : null,
                phone: (_f = (_e = n.params) === null || _e === void 0 ? void 0 : _e.phone) !== null && _f !== void 0 ? _f : null,
                params: (_g = n.params) !== null && _g !== void 0 ? _g : {},
            });
        });
        console.log(`getMessages: ${normalized.length} notes for lead ${entityId}`);
        return {
            success: true,
            notes: {
                entityId,
                page,
                hasMore: !!((_c = raw === null || raw === void 0 ? void 0 : raw._links) === null || _c === void 0 ? void 0 : _c.next),
                items: normalized,
            },
        };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("getMessages error:", msg);
        return { success: false, error: msg };
    }
}
//# sourceMappingURL=messages.js.map