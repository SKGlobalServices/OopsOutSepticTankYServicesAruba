"use strict";
/**
 * Kommo data retrieval services (V1 — read-only, raw data).
 * Fetches leads, contacts, and chats from Kommo API v4.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLeads = fetchLeads;
exports.fetchChatEvents = fetchChatEvents;
exports.delay = delay;
exports.fetchContacts = fetchContacts;
exports.fetchContactChats = fetchContactChats;
exports.fetchTalkDetails = fetchTalkDetails;
exports.fetchLeadNotes = fetchLeadNotes;
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
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchContacts(client, page = 1, limit = 250) {
    console.log(`Fetching contacts from Kommo API, page: ${page}, limit: ${limit}`);
    try {
        const res = await client.get("/contacts", {
            params: {
                page,
                limit,
                with: "leads",
            },
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
async function fetchContactChats(client, contactId) {
    console.log(`Fetching chats for contact ${contactId}`);
    try {
        const res = await client.get("/contacts/chats", {
            params: { contact_id: contactId },
            validateStatus: () => true,
        });
        console.log(`Kommo /contacts/chats for ${contactId} status:`, res.status);
        if (res.status < 200 || res.status >= 300) {
            throw new Error(`Kommo /contacts/chats failed HTTP ${res.status}: ${JSON.stringify(res.data)}`);
        }
        return res.data;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Kommo fetchContactChats error:", msg);
        throw error;
    }
}
async function fetchTalkDetails(client, talkId) {
    console.log(`Fetching talk details for talk ${talkId}`);
    try {
        const res = await client.get(`/talks/${talkId}`, {
            validateStatus: () => true,
        });
        console.log(`Kommo /talks/${talkId} status:`, res.status);
        if (res.status === 404) {
            return null;
        }
        if (res.status < 200 || res.status >= 300) {
            throw new Error(`Kommo /talks/${talkId} failed HTTP ${res.status}: ${JSON.stringify(res.data)}`);
        }
        return res.data;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Kommo fetchTalkDetails error:", msg);
        throw error;
    }
}
async function fetchLeadNotes(client, entityId, page = 1) {
    console.log(`Fetching notes for lead ${entityId}, page ${page}`);
    try {
        const res = await client.get(`/leads/${entityId}/notes`, {
            params: { limit: 250, page, "order[id]": "asc" },
            validateStatus: () => true,
        });
        console.log(`Kommo /leads/${entityId}/notes response status:`, res.status);
        if (res.status === 204 || res.status === 404) {
            return { _embedded: { notes: [] } };
        }
        if (res.status < 200 || res.status >= 300) {
            throw new Error(`Kommo /leads/${entityId}/notes failed HTTP ${res.status}: ${JSON.stringify(res.data)}`);
        }
        return res.data;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Kommo fetchLeadNotes error:", msg);
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