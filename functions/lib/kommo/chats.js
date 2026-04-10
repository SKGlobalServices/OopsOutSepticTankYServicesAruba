"use strict";
/**
 * Chat inbox endpoint for Kommo V1.
 * Fetches chat-related events from the Events API, then enriches each
 * event with the lead name via a batched /leads lookup.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChats = getChats;
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
async function getChats(page = 1) {
    var _a, _b, _c, _d, _e;
    const configErr = validateConfig();
    if (configErr)
        return { success: false, error: configErr };
    try {
        const accessToken = await (0, tokenManager_1.getValidAccessToken)(getClientId(), getClientSecret());
        const client = (0, client_1.createKommoClient)(accessToken, getDomain());
        const rawEvents = (await (0, services_1.fetchChatEvents)(client, page));
        const eventList = (_b = (_a = rawEvents === null || rawEvents === void 0 ? void 0 : rawEvents._embedded) === null || _a === void 0 ? void 0 : _a.events) !== null && _b !== void 0 ? _b : [];
        const leadIds = [
            ...new Set(eventList
                .filter((e) => e.entity_type === "lead" && e.entity_id)
                .map((e) => e.entity_id)),
        ];
        const leadNameMap = new Map();
        if (leadIds.length > 0) {
            const leadsData = (await (0, services_1.fetchLeadsByIds)(client, leadIds));
            for (const lead of (_d = (_c = leadsData === null || leadsData === void 0 ? void 0 : leadsData._embedded) === null || _c === void 0 ? void 0 : _c.leads) !== null && _d !== void 0 ? _d : []) {
                leadNameMap.set(lead.id, (_e = lead.name) !== null && _e !== void 0 ? _e : "");
            }
            console.log("Enriched with", leadNameMap.size, "lead names");
        }
        const enriched = eventList.map((ev) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            return (Object.assign(Object.assign({}, ev), { lead_name: (_a = leadNameMap.get(ev.entity_id)) !== null && _a !== void 0 ? _a : "", talk_id: (_e = (_d = (_c = (_b = ev.value_after) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.talk_id) !== null && _e !== void 0 ? _e : null, message_id: (_j = (_h = (_g = (_f = ev.value_after) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.message) === null || _h === void 0 ? void 0 : _h.id) !== null && _j !== void 0 ? _j : null, origin: (_o = (_m = (_l = (_k = ev.value_after) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.message) === null || _m === void 0 ? void 0 : _m.origin) !== null && _o !== void 0 ? _o : "", contact_id: (_r = (_q = (_p = ev._embedded) === null || _p === void 0 ? void 0 : _p.entity) === null || _q === void 0 ? void 0 : _q.linked_talk_contact_id) !== null && _r !== void 0 ? _r : null }));
        });
        const result = {
            _page: rawEvents._page,
            _links: rawEvents._links,
            _embedded: { events: enriched },
        };
        console.log("Get chat events completed:", enriched.length, "events enriched");
        return { success: true, events: result };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Get chat events error:", msg);
        return { success: false, error: msg };
    }
}
//# sourceMappingURL=chats.js.map