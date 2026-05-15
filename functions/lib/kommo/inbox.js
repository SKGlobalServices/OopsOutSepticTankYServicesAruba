"use strict";
/**
 * Inbox endpoint for Kommo - fetches chat conversations from Events API.
 * Groups events by talk_id or entity_id to create conversation threads.
 * Enriches contacts/leads with names via batch API calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.delay = delay;
exports.resolveNames = resolveNames;
exports.getInbox = getInbox;
const client_1 = require("./client");
const tokenManager_1 = require("./tokenManager");
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
const CHAT_EVENT_TYPES = [
    "incoming_chat_message",
    "outgoing_chat_message",
    "talk_created",
].join(",");
const BATCH_SIZE = 50;
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
const contactCache = new Map();
const leadCache = new Map();
const talkCache = new Map();
async function fetchContactsBatch(client, contactIds) {
    var _a, _b;
    const contactMap = new Map();
    const idsToFetch = [];
    for (const id of contactIds) {
        if (contactCache.has(id)) {
            contactMap.set(id, contactCache.get(id));
        }
        else {
            idsToFetch.push(id);
        }
    }
    if (idsToFetch.length === 0) {
        console.log(`[Contacts] All ${contactMap.size} from cache`);
        return contactMap;
    }
    console.log(`[Contacts] Fetching ${idsToFetch.length} new, ${contactMap.size} from cache`);
    for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
        const batch = idsToFetch.slice(i, i + BATCH_SIZE);
        try {
            const res = await client.get("/contacts", {
                params: { "filter[id]": batch },
                validateStatus: () => true,
            });
            if (res.status >= 200 && res.status < 300) {
                const data = res.data;
                const contacts = (_b = (_a = data._embedded) === null || _a === void 0 ? void 0 : _a.contacts) !== null && _b !== void 0 ? _b : [];
                console.log(`[Contacts] Batch ${Math.floor(i / BATCH_SIZE) + 1}: got ${contacts.length} contacts`);
                for (const contact of contacts) {
                    if (contact.id && contact.name) {
                        contactMap.set(contact.id, contact.name);
                        contactCache.set(contact.id, contact.name);
                    }
                }
            }
            else {
                console.error(`[Contacts] Batch failed HTTP ${res.status}:`, JSON.stringify(res.data).slice(0, 200));
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error(`[Contacts] Batch error: ${msg}`);
        }
    }
    return contactMap;
}
async function fetchLeadsBatch(client, leadIds) {
    var _a, _b;
    const leadMap = new Map();
    const idsToFetch = [];
    for (const id of leadIds) {
        if (leadCache.has(id)) {
            leadMap.set(id, leadCache.get(id));
        }
        else {
            idsToFetch.push(id);
        }
    }
    if (idsToFetch.length === 0) {
        console.log(`[Leads] All ${leadMap.size} from cache`);
        return leadMap;
    }
    console.log(`[Leads] Fetching ${idsToFetch.length} new, ${leadMap.size} from cache`);
    for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
        const batch = idsToFetch.slice(i, i + BATCH_SIZE);
        try {
            const res = await client.get("/leads", {
                params: { "filter[id]": batch },
                validateStatus: () => true,
            });
            if (res.status >= 200 && res.status < 300) {
                const data = res.data;
                const leads = (_b = (_a = data._embedded) === null || _a === void 0 ? void 0 : _a.leads) !== null && _b !== void 0 ? _b : [];
                console.log(`[Leads] Batch ${Math.floor(i / BATCH_SIZE) + 1}: got ${leads.length} leads`);
                for (const lead of leads) {
                    if (lead.id && lead.name) {
                        leadMap.set(lead.id, lead.name);
                        leadCache.set(lead.id, lead.name);
                    }
                }
            }
            else {
                console.error(`[Leads] Batch failed HTTP ${res.status}:`, JSON.stringify(res.data).slice(0, 200));
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error(`[Leads] Batch error: ${msg}`);
        }
    }
    return leadMap;
}
async function fetchTalksBatch(client, talkIds) {
    var _a, _b;
    const talkMap = new Map();
    const idsToFetch = [];
    for (const id of talkIds) {
        if (talkCache.has(id)) {
            talkMap.set(id, talkCache.get(id));
        }
        else {
            idsToFetch.push(id);
        }
    }
    if (idsToFetch.length === 0) {
        console.log(`[Talks] All ${talkMap.size} from cache`);
        return talkMap;
    }
    console.log(`[Talks] Fetching ${idsToFetch.length} new, ${talkMap.size} from cache`);
    for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
        const batch = idsToFetch.slice(i, i + BATCH_SIZE);
        try {
            const res = await client.get("/talks", {
                params: { "filter[id]": batch },
                validateStatus: () => true,
            });
            if (res.status >= 200 && res.status < 300) {
                const data = res.data;
                const talks = (_b = (_a = data._embedded) === null || _a === void 0 ? void 0 : _a.talks) !== null && _b !== void 0 ? _b : [];
                console.log(`[Talks] Batch ${Math.floor(i / BATCH_SIZE) + 1}: got ${talks.length} talks`);
                for (const talk of talks) {
                    if (talk.id && talk.name) {
                        talkMap.set(talk.id, talk.name);
                        talkCache.set(talk.id, talk.name);
                    }
                }
            }
            else {
                console.error(`[Talks] Batch failed HTTP ${res.status}:`, JSON.stringify(res.data).slice(0, 200));
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error(`[Talks] Batch error: ${msg}`);
        }
    }
    return talkMap;
}
async function fetchChatEventsForInbox(client, page = 1) {
    console.log(`Fetching chat events for inbox, page: ${page}`);
    try {
        const res = await client.get("/events", {
            params: {
                "filter[type]": CHAT_EVENT_TYPES,
                with: "contact_name,lead_name",
                limit: 250,
                page,
            },
            validateStatus: () => true,
        });
        console.log("Kommo /events (inbox) response status:", res.status);
        if (res.status < 200 || res.status >= 300) {
            throw new Error(`Kommo /events failed HTTP ${res.status}: ${JSON.stringify(res.data)}`);
        }
        return res.data;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Kommo fetchChatEventsForInbox error:", msg);
        throw error;
    }
}
function extractMessageInfo(event) {
    var _a, _b, _c;
    const messageData = (_b = (_a = event.value_after) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message;
    if (!(messageData === null || messageData === void 0 ? void 0 : messageData.id))
        return null;
    const isIncoming = event.type === "incoming_chat_message";
    const isOutgoing = event.type === "outgoing_chat_message";
    if (!isIncoming && !isOutgoing)
        return null;
    return {
        id: messageData.id,
        type: isIncoming ? "incoming" : "outgoing",
        timestamp: (_c = event.created_at) !== null && _c !== void 0 ? _c : 0,
    };
}
function groupEventsByConversation(events) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
    const conversationMap = new Map();
    for (const event of events) {
        const talkId = (_d = (_c = (_b = (_a = event.value_after) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.talk_id) !== null && _d !== void 0 ? _d : null;
        const entityId = (_e = event.entity_id) !== null && _e !== void 0 ? _e : null;
        const entityType = (_f = event.entity_type) !== null && _f !== void 0 ? _f : "lead";
        const key = talkId !== null
            ? `talk_${talkId}`
            : `entity_${entityType}_${entityId}`;
        if (!conversationMap.has(key)) {
            const entity = (_g = event._embedded) === null || _g === void 0 ? void 0 : _g.entity;
            const contactId = (_h = entity === null || entity === void 0 ? void 0 : entity.linked_talk_contact_id) !== null && _h !== void 0 ? _h : null;
            let contactName = "";
            let leadId = null;
            let leadName = "";
            if (event.type === "incoming_chat_message" || event.type === "outgoing_chat_message") {
                contactName = (_j = event.contact_name) !== null && _j !== void 0 ? _j : "";
                leadName = (_k = event.lead_name) !== null && _k !== void 0 ? _k : "";
                if (!contactName && !leadName) {
                    const entityLink = (_o = (_m = (_l = entity === null || entity === void 0 ? void 0 : entity._links) === null || _l === void 0 ? void 0 : _l.self) === null || _m === void 0 ? void 0 : _m.href) !== null && _o !== void 0 ? _o : "";
                    if (entityLink.includes("/contacts/")) {
                        contactName = (_p = entity === null || entity === void 0 ? void 0 : entity.name) !== null && _p !== void 0 ? _p : "";
                    }
                    else if (entityLink.includes("/leads/")) {
                        leadId = entityId;
                        leadName = (_q = entity === null || entity === void 0 ? void 0 : entity.name) !== null && _q !== void 0 ? _q : "";
                    }
                }
            }
            conversationMap.set(key, {
                events: [],
                talkId,
                entityId,
                entityType,
                contactId,
                contactName,
                leadId,
                leadName,
                origin: (_u = (_t = (_s = (_r = event.value_after) === null || _r === void 0 ? void 0 : _r[0]) === null || _s === void 0 ? void 0 : _s.message) === null || _t === void 0 ? void 0 : _t.origin) !== null && _u !== void 0 ? _u : "",
                createdAt: (_v = event.created_at) !== null && _v !== void 0 ? _v : 0,
                lastMessage: null,
            });
        }
        const conv = conversationMap.get(key);
        conv.events.push(event);
        if (event.created_at && event.created_at > conv.createdAt) {
            conv.createdAt = event.created_at;
        }
        const msgInfo = extractMessageInfo(event);
        if (msgInfo) {
            if (!conv.lastMessage || msgInfo.timestamp > conv.lastMessage.timestamp) {
                conv.lastMessage = msgInfo;
            }
        }
    }
    return conversationMap;
}
async function resolveNames(conversations, client) {
    const uniqueContactIds = new Set();
    const uniqueLeadIds = new Set();
    const uniqueTalkIds = new Set();
    for (const conv of conversations) {
        if (conv.contactId !== null) {
            uniqueContactIds.add(conv.contactId);
        }
        if (conv.leadId !== null) {
            uniqueLeadIds.add(conv.leadId);
        }
        if (conv.isDirectTalk && conv.entityId !== null) {
            uniqueTalkIds.add(conv.entityId);
        }
    }
    const contactIds = Array.from(uniqueContactIds);
    const leadIds = Array.from(uniqueLeadIds);
    const talkIds = Array.from(uniqueTalkIds);
    console.log(`[resolveNames] ${contactIds.length} contacts, ${leadIds.length} leads, ${talkIds.length} direct talks to resolve`);
    const [contactMap, leadMap, talkMap] = await Promise.all([
        contactIds.length > 0 ? fetchContactsBatch(client, contactIds) : Promise.resolve(new Map()),
        leadIds.length > 0 ? fetchLeadsBatch(client, leadIds) : Promise.resolve(new Map()),
        talkIds.length > 0 ? fetchTalksBatch(client, talkIds) : Promise.resolve(new Map()),
    ]);
    console.log(`[resolveNames] Resolved: ${contactMap.size} contacts, ${leadMap.size} leads, ${talkMap.size} talks`);
    return { contactMap, leadMap, talkMap };
}
function applyNames(conversations, contactMap, leadMap, talkMap) {
    let contactResolved = 0;
    let leadResolved = 0;
    let talkResolved = 0;
    let unknown = 0;
    for (const conv of conversations) {
        if (conv.contactName && conv.contactName.trim() !== "") {
            continue;
        }
        if (conv.contactId && contactMap.has(conv.contactId)) {
            conv.contactName = contactMap.get(conv.contactId);
            contactResolved++;
        }
        else if (conv.leadId && leadMap.has(conv.leadId)) {
            conv.contactName = leadMap.get(conv.leadId);
            leadResolved++;
        }
        else if (conv.entityId && talkMap.has(conv.entityId)) {
            conv.contactName = talkMap.get(conv.entityId);
            talkResolved++;
        }
        else {
            conv.contactName = "Unknown";
            unknown++;
        }
    }
    console.log(`[applyNames] Applied: ${contactResolved} contacts, ${leadResolved} leads, ${talkResolved} talks, ${unknown} unknown`);
    return conversations;
}
async function getInbox(page = 1) {
    var _a, _b, _c, _d, _e;
    const configErr = validateConfig();
    if (configErr)
        return { success: false, error: configErr };
    let client = null;
    try {
        const accessToken = await (0, tokenManager_1.getValidAccessToken)(getClientId(), getClientSecret());
        client = (0, client_1.createKommoClient)(accessToken, getDomain());
        console.log(`Fetching inbox page ${page}...`);
        const eventsData = await fetchChatEventsForInbox(client, page);
        const events = (_b = (_a = eventsData._embedded) === null || _a === void 0 ? void 0 : _a.events) !== null && _b !== void 0 ? _b : [];
        if (events.length === 0) {
            return { success: true, conversations: [], total: 0, hasMore: false };
        }
        const hasMore = !!((_c = eventsData._links) === null || _c === void 0 ? void 0 : _c.next);
        console.log(`Found ${events.length} events on page ${page}, hasMore: ${hasMore}`);
        const conversationMap = groupEventsByConversation(events);
        const conversations = [];
        const conversationsInput = [];
        for (const [, conv] of Array.from(conversationMap.entries())) {
            const conversation = {
                id: conv.talkId !== null
                    ? `talk_${conv.talkId}`
                    : `entity_${conv.entityType}_${conv.entityId}`,
                talkId: conv.talkId,
                entityId: conv.entityId,
                entityType: conv.entityType,
                contactId: conv.contactId,
                contactName: conv.contactName || "",
                leadId: conv.leadId,
                leadName: conv.leadName,
                lastMessage: conv.lastMessage,
                totalMessages: conv.events.length,
                origin: conv.origin,
                createdAt: conv.createdAt,
                updatedAt: (_e = (_d = conv.lastMessage) === null || _d === void 0 ? void 0 : _d.timestamp) !== null && _e !== void 0 ? _e : conv.createdAt,
            };
            conversations.push(conversation);
            const isDirectTalk = conv.entityType === "talk" && conv.talkId === null;
            conversationsInput.push({
                talkId: conv.talkId,
                entityId: conv.entityId,
                entityType: conv.entityType,
                contactId: conv.contactId,
                leadId: conv.leadId,
                isDirectTalk,
            });
        }
        const { contactMap, leadMap, talkMap } = await resolveNames(conversationsInput, client);
        applyNames(conversations, contactMap, leadMap, talkMap);
        conversations.sort((a, b) => {
            if (a.talkId !== null && b.talkId === null)
                return -1;
            if (a.talkId === null && b.talkId !== null)
                return 1;
            return b.updatedAt - a.updatedAt;
        });
        console.log(`Returning ${conversations.length} conversations`);
        return {
            success: true,
            conversations,
            total: events.length,
            hasMore,
        };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Get inbox error:", msg);
        return { success: false, error: msg };
    }
}
//# sourceMappingURL=inbox.js.map