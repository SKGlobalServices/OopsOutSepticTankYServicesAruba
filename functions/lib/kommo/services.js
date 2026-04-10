"use strict";
/**
 * Kommo data retrieval services (V1 — read-only, raw data).
 * Fetches leads, contacts, and chats from Kommo API v4.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLeads = fetchLeads;
exports.fetchContacts = fetchContacts;
exports.fetchChatEvents = fetchChatEvents;
exports.fetchLeadsByIds = fetchLeadsByIds;
async function fetchLeads(client) {
    console.log("Fetching leads from Kommo API...");
    try {
        const res = await client.get("/leads", {
            validateStatus: () => true,
        });
        console.log("Kommo /leads response status:", res.status);
        if (res.status < 200 || res.status >= 300) {
            throw new Error(`Kommo /leads failed HTTP ${res.status}: ${JSON.stringify(res.data)}`);
        }
        return res.data;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Kommo fetchLeads error:", msg);
        throw error;
    }
}
async function fetchContacts(client) {
    console.log("Fetching contacts from Kommo API...");
    try {
        const res = await client.get("/contacts", {
            validateStatus: () => true,
        });
        console.log("Kommo /contacts response status:", res.status);
        if (res.status < 200 || res.status >= 300) {
            throw new Error(`Kommo /contacts failed HTTP ${res.status}: ${JSON.stringify(res.data)}`);
        }
        return res.data;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Kommo fetchContacts error:", msg);
        throw error;
    }
}
async function fetchChatEvents(client, page = 1) {
    const chatTypes = [
        "incoming_chat_message",
        "outgoing_chat_message",
        "talk_created",
        "talk_closed",
    ].join(",");
    console.log("Fetching chat events from Kommo API, page:", page);
    try {
        const res = await client.get("/events", {
            params: {
                "filter[type]": chatTypes,
                with: "contact_name,lead_name",
                limit: 250,
                page,
            },
            validateStatus: () => true,
        });
        console.log("Kommo /events (chat) response status:", res.status);
        if (res.status < 200 || res.status >= 300) {
            throw new Error(`Kommo /events failed HTTP ${res.status}: ${JSON.stringify(res.data)}`);
        }
        return res.data;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Kommo fetchChatEvents error:", msg);
        throw error;
    }
}
async function fetchLeadsByIds(client, ids) {
    var _a;
    if (ids.length === 0)
        return { _embedded: { leads: [] } };
    const batchSize = 50;
    const allLeads = [];
    for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        console.log(`Fetching leads batch ${i / batchSize + 1}, ids:`, batch.length);
        const res = await client.get("/leads", {
            params: { "filter[id]": batch.join(",") },
            validateStatus: () => true,
        });
        if (res.status >= 200 && res.status < 300) {
            const embedded = (_a = res.data) === null || _a === void 0 ? void 0 : _a._embedded;
            if (Array.isArray(embedded === null || embedded === void 0 ? void 0 : embedded.leads)) {
                allLeads.push(...embedded.leads);
            }
        }
        else {
            console.warn(`Leads batch fetch HTTP ${res.status}, skipping`);
        }
    }
    return { _embedded: { leads: allLeads } };
}
//# sourceMappingURL=services.js.map