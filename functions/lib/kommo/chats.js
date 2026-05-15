"use strict";
/**
 * Chat inbox endpoint for Kommo V1.
 * Fetches conversations using the proper Kommo API:
 * - GET /api/v4/contacts - List contacts
 * - GET /api/v4/contacts/chats - Get chats per contact
 * - GET /api/v4/talks/{id} - Get talk details
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
const RATE_LIMIT_DELAY_MS = 50;
const BATCH_SIZE = 50;
const MAX_CONTACTS_PER_PAGE = 100;
async function getChats(page = 1) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const configErr = validateConfig();
    if (configErr)
        return { success: false, error: configErr };
    try {
        const accessToken = await (0, tokenManager_1.getValidAccessToken)(getClientId(), getClientSecret());
        const client = (0, client_1.createKommoClient)(accessToken, getDomain());
        console.log(`Fetching contacts page ${page}...`);
        const contactsData = (await (0, services_1.fetchContacts)(client, page, MAX_CONTACTS_PER_PAGE));
        const contacts = (_b = (_a = contactsData._embedded) === null || _a === void 0 ? void 0 : _a.contacts) !== null && _b !== void 0 ? _b : [];
        if (contacts.length === 0) {
            return { success: true, conversations: [], total: 0, hasMore: false };
        }
        const totalContacts = (_c = contactsData._total) !== null && _c !== void 0 ? _c : contacts.length;
        const hasMore = !!((_d = contactsData._links) === null || _d === void 0 ? void 0 : _d.next);
        console.log(`Found ${contacts.length} contacts on page ${page}, total: ${totalContacts}`);
        const conversations = [];
        const talkIdsToFetch = [];
        const contactsWithLeads = contacts.filter(c => { var _a, _b; return (_b = (_a = c._embedded) === null || _a === void 0 ? void 0 : _a.leads) === null || _b === void 0 ? void 0 : _b.length; });
        const contactsWithoutLeads = contacts.filter(c => { var _a, _b; return !((_b = (_a = c._embedded) === null || _a === void 0 ? void 0 : _a.leads) === null || _b === void 0 ? void 0 : _b.length); });
        console.log(`Contacts with leads: ${contactsWithLeads.length}, without: ${contactsWithoutLeads.length}`);
        for (const contact of contactsWithoutLeads) {
            const contactId = contact.id;
            const contactName = (_e = contact.name) !== null && _e !== void 0 ? _e : (`${(_f = contact.first_name) !== null && _f !== void 0 ? _f : ""} ${(_g = contact.last_name) !== null && _g !== void 0 ? _g : ""}`.trim() || "Unknown");
            conversations.push({
                talkId: null,
                chatId: null,
                contactId,
                contactName,
                leadId: null,
                leadName: "",
                origin: "",
                createdAt: null,
                updatedAt: null,
                isInWork: false,
                unreadCount: 0,
                lastMessage: null,
            });
        }
        const fetchChatsForContact = async (contact) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            const contactId = contact.id;
            const contactName = (_a = contact.name) !== null && _a !== void 0 ? _a : (`${(_b = contact.first_name) !== null && _b !== void 0 ? _b : ""} ${(_c = contact.last_name) !== null && _c !== void 0 ? _c : ""}`.trim() || "Unknown");
            const lead = (_e = (_d = contact._embedded) === null || _d === void 0 ? void 0 : _d.leads) === null || _e === void 0 ? void 0 : _e[0];
            const leadId = (_f = lead === null || lead === void 0 ? void 0 : lead.id) !== null && _f !== void 0 ? _f : null;
            const leadName = (_g = lead === null || lead === void 0 ? void 0 : lead.name) !== null && _g !== void 0 ? _g : "";
            try {
                await (0, services_1.delay)(RATE_LIMIT_DELAY_MS);
                const chatsData = (await (0, services_1.fetchContactChats)(client, contactId));
                const chats = (_j = (_h = chatsData._embedded) === null || _h === void 0 ? void 0 : _h.chats) !== null && _j !== void 0 ? _j : [];
                if (chats.length === 0) {
                    return [{
                            talkId: null,
                            chatId: null,
                            contactId,
                            contactName,
                            leadId,
                            leadName,
                            origin: "",
                            createdAt: null,
                            updatedAt: null,
                            isInWork: false,
                            unreadCount: 0,
                            lastMessage: null,
                        }];
                }
                const result = chats.map(chat => {
                    var _a, _b;
                    const talkId = (_a = chat.id) !== null && _a !== void 0 ? _a : null;
                    const chatId = (_b = chat.chat_id) !== null && _b !== void 0 ? _b : null;
                    if (talkId !== null && !talkIdsToFetch.includes(talkId)) {
                        talkIdsToFetch.push(talkId);
                    }
                    return {
                        talkId,
                        chatId,
                        contactId,
                        contactName,
                        leadId,
                        leadName,
                        origin: "",
                        createdAt: null,
                        updatedAt: null,
                        isInWork: false,
                        unreadCount: 0,
                        lastMessage: null,
                    };
                });
                return result;
            }
            catch (chatErr) {
                console.warn(`Failed to fetch chats for contact ${contactId}:`, chatErr);
                return [{
                        talkId: null,
                        chatId: null,
                        contactId,
                        contactName,
                        leadId,
                        leadName,
                        origin: "",
                        createdAt: null,
                        updatedAt: null,
                        isInWork: false,
                        unreadCount: 0,
                        lastMessage: null,
                    }];
            }
        };
        const CONCURRENCY = 5;
        for (let i = 0; i < contactsWithLeads.length; i += CONCURRENCY) {
            const batch = contactsWithLeads.slice(i, i + CONCURRENCY);
            const results = await Promise.all(batch.map(fetchChatsForContact));
            for (const result of results) {
                conversations.push(...result);
            }
            console.log(`Processed ${Math.min(i + CONCURRENCY, contactsWithLeads.length)}/${contactsWithLeads.length} contacts with leads`);
        }
        console.log(`Collected ${talkIdsToFetch.length} unique talk IDs to enrich`);
        const talkDetailsMap = new Map();
        for (let i = 0; i < talkIdsToFetch.length; i += BATCH_SIZE) {
            const batch = talkIdsToFetch.slice(i, i + BATCH_SIZE);
            console.log(`Fetching talk details batch ${Math.floor(i / BATCH_SIZE) + 1}, talk IDs: ${batch.length}`);
            const fetchTalk = async (talkId) => {
                await (0, services_1.delay)(RATE_LIMIT_DELAY_MS);
                try {
                    const talkData = (await (0, services_1.fetchTalkDetails)(client, talkId));
                    if (talkData) {
                        talkDetailsMap.set(talkId, talkData);
                    }
                }
                catch (talkErr) {
                    console.warn(`Failed to fetch talk ${talkId}:`, talkErr);
                }
            };
            const talkBatch = [];
            for (const talkId of batch) {
                talkBatch.push(fetchTalk(talkId));
            }
            await Promise.all(talkBatch);
        }
        for (const convo of conversations) {
            if (convo.talkId !== null) {
                const talkData = talkDetailsMap.get(convo.talkId);
                if (talkData) {
                    convo.origin = (_h = talkData.origin) !== null && _h !== void 0 ? _h : "";
                    convo.createdAt = (_j = talkData.created_at) !== null && _j !== void 0 ? _j : null;
                    convo.updatedAt = (_k = talkData.updated_at) !== null && _k !== void 0 ? _k : null;
                    convo.isInWork = (_l = talkData.is_in_work) !== null && _l !== void 0 ? _l : false;
                    convo.unreadCount = (_m = talkData.unread_count) !== null && _m !== void 0 ? _m : 0;
                }
            }
        }
        conversations.sort((a, b) => {
            var _a, _b, _c, _d;
            const aTime = (_b = (_a = a.updatedAt) !== null && _a !== void 0 ? _a : a.createdAt) !== null && _b !== void 0 ? _b : 0;
            const bTime = (_d = (_c = b.updatedAt) !== null && _c !== void 0 ? _c : b.createdAt) !== null && _d !== void 0 ? _d : 0;
            const aActive = a.isInWork ? 1 : 0;
            const bActive = b.isInWork ? 1 : 0;
            if (aActive !== bActive)
                return bActive - aActive;
            if (aTime === 0 && bTime === 0)
                return 0;
            if (aTime === 0)
                return 1;
            if (bTime === 0)
                return -1;
            return bTime - aTime;
        });
        console.log(`Returning ${conversations.length} conversations, hasMore: ${hasMore}`);
        return {
            success: true,
            conversations,
            total: totalContacts,
            hasMore,
        };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Get chats error:", msg);
        return { success: false, error: msg };
    }
}
//# sourceMappingURL=chats.js.map