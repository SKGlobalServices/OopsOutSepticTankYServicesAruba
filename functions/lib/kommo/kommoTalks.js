"use strict";
/**
 * Resolve Kommo talk / conversation for CRM entities (leads) via API v4.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.findTalksForLead = findTalksForLead;
exports.getTalkById = getTalkById;
exports.conversationIdFromTalk = conversationIdFromTalk;
/**
 * List talks linked to a lead (entity_type is typically "leads" in amo/Kommo).
 */
async function findTalksForLead(api, leadId) {
    var _a, _b, _c, _d;
    const res = await api.get("/talks", {
        params: {
            "filter[entity_id]": leadId,
            "filter[entity_type]": "leads",
            limit: 10,
        },
        validateStatus: () => true,
    });
    if (res.status >= 400) {
        const alt = await api.get("/talks", {
            params: {
                "filter[entity_id]": leadId,
                "filter[entity_type]": "lead",
                limit: 10,
            },
            validateStatus: () => true,
        });
        if (alt.status < 400 && ((_b = (_a = alt.data._embedded) === null || _a === void 0 ? void 0 : _a.talks) === null || _b === void 0 ? void 0 : _b.length)) {
            return alt.data._embedded.talks;
        }
        return [];
    }
    return (_d = (_c = res.data._embedded) === null || _c === void 0 ? void 0 : _c.talks) !== null && _d !== void 0 ? _d : [];
}
async function getTalkById(api, talkId) {
    const res = await api.get(`/talks/${talkId}`, {
        validateStatus: () => true,
    });
    if (res.status >= 400)
        return null;
    return res.data;
}
/**
 * Pick conversation_id for Amojo: prefer explicit chat_id on talk, else string talk id.
 */
function conversationIdFromTalk(talk) {
    if (talk.chat_id && String(talk.chat_id).trim() !== "") {
        return String(talk.chat_id);
    }
    if (talk.id != null) {
        return String(talk.id);
    }
    return undefined;
}
//# sourceMappingURL=kommoTalks.js.map