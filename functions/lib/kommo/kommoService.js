"use strict";
/**
 * Kommo business logic: send real WhatsApp/channel messages (Amojo), optional CRM note fallback, webhook processing.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPhoneCandidatesFromPayload = extractPhoneCandidatesFromPayload;
exports.extractWebhookDedupKey = extractWebhookDedupKey;
exports.sendKommoOutboundMessage = sendKommoOutboundMessage;
exports.sendMessageToLead = sendMessageToLead;
exports.extractPhoneFromPayload = extractPhoneFromPayload;
exports.extractIdsFromPayload = extractIdsFromPayload;
exports.extractMessageTextFromPayload = extractMessageTextFromPayload;
exports.extractInboundMeta = extractInboundMeta;
exports.processWebhookAsync = processWebhookAsync;
const crypto = __importStar(require("crypto"));
const firestore_1 = require("firebase-admin/firestore");
const kommoClient_1 = require("./kommoClient");
const kommoOAuth_1 = require("./kommoOAuth");
const firestoreHelpers_1 = require("./firestoreHelpers");
const rtdbHelpers_1 = require("./rtdbHelpers");
const phoneUtils_1 = require("./phoneUtils");
const amojoClient_1 = require("./amojoClient");
const kommoTalks_1 = require("./kommoTalks");
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
            fieldCode.includes("tel");
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
/** Flatten Chats-style sections: messages.add / update */
function chatSectionEntries(payload, key) {
    const section = payload[key];
    if (!isRecord(section))
        return [];
    return [
        ...(Array.isArray(section.add) ? section.add : []),
        ...(Array.isArray(section.update) ? section.update : []),
    ];
}
function unwrapNestedPayload(payload) {
    var _a, _b, _c, _d, _e;
    const inner = (_b = (_a = payload.payload) !== null && _a !== void 0 ? _a : payload.content) !== null && _b !== void 0 ? _b : payload.data;
    if (isRecord(inner) && ((_e = (_d = (_c = inner.leads) !== null && _c !== void 0 ? _c : inner.contacts) !== null && _d !== void 0 ? _d : inner.notes) !== null && _e !== void 0 ? _e : inner.messages)) {
        return inner;
    }
    return payload;
}
/**
 * Extract all phone candidates from Kommo webhook (CRM + Chats shapes).
 */
function extractPhoneCandidatesFromPayload(payload) {
    var _a, _b, _c, _d, _e;
    const root = unwrapNestedPayload(payload);
    const candidates = new Set();
    const sections = ["leads", "contacts"];
    for (const sectionName of sections) {
        const section = root[sectionName];
        if (!isRecord(section))
            continue;
        const entries = [
            ...(Array.isArray(section.add) ? section.add : []),
            ...(Array.isArray(section.update) ? section.update : []),
        ];
        for (const entry of entries) {
            if (!isRecord(entry))
                continue;
            const customFields = (_a = entry.custom_fields_values) !== null && _a !== void 0 ? _a : entry.custom_fields;
            for (const phone of collectPhoneValuesFromFields(customFields)) {
                candidates.add(phone);
            }
            const direct = (_c = (_b = extractStringValue(entry.phone)) !== null && _b !== void 0 ? _b : extractStringValue(entry.client_phone)) !== null && _c !== void 0 ? _c : extractStringValue(entry.sender_phone);
            if (direct)
                candidates.add(direct);
        }
    }
    const notes = root.notes;
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
    for (const entry of chatSectionEntries(root, "messages")) {
        if (!isRecord(entry))
            continue;
        const phone = (_e = (_d = extractStringValue(entry.phone)) !== null && _d !== void 0 ? _d : extractStringValue(entry.client_phone)) !== null && _e !== void 0 ? _e : extractStringValue(entry.sender_phone);
        if (phone)
            candidates.add(phone);
        const sender = entry.sender;
        if (isRecord(sender)) {
            const sp = extractStringValue(sender.phone);
            if (sp)
                candidates.add(sp);
        }
    }
    return Array.from(candidates);
}
function textFromChatEntry(entry) {
    if (typeof entry.text === "string" && entry.text.trim() !== "")
        return entry.text;
    const message = entry.message;
    if (isRecord(message)) {
        if (typeof message.text === "string")
            return message.text;
        const content = message.content;
        if (typeof content === "string")
            return content;
    }
    return undefined;
}
function messageIdFromChatEntry(entry) {
    var _a, _b, _c;
    return ((_c = (_b = (_a = extractStringValue(entry.msgid)) !== null && _a !== void 0 ? _a : extractStringValue(entry.message_id)) !== null && _b !== void 0 ? _b : extractStringValue(entry.id)) !== null && _c !== void 0 ? _c : extractStringValue(entry.uuid));
}
/**
 * Dedup key for inbound messages (prefer stable Kommo / Amojo ids).
 */
function extractWebhookDedupKey(payload) {
    const root = unwrapNestedPayload(payload);
    for (const entry of chatSectionEntries(root, "messages")) {
        if (!isRecord(entry))
            continue;
        const mid = messageIdFromChatEntry(entry);
        if (mid)
            return `msg:${mid}`;
    }
    const notes = root.notes;
    if (isRecord(notes) && Array.isArray(notes.add)) {
        const first = notes.add[0];
        if (isRecord(first) && first.id != null) {
            return `note:${first.id}`;
        }
    }
    return `hash:${crypto.createHash("sha256").update(JSON.stringify(root)).digest("hex")}`;
}
async function resolveConversationId(accessToken, input) {
    if (input.conversationId && input.conversationId.trim() !== "") {
        return { conversationId: input.conversationId.trim(), talkId: input.talkId };
    }
    const api = (0, kommoClient_1.createKommoClient)(accessToken, KOMMO_DOMAIN);
    if (input.talkId != null) {
        const talk = await (0, kommoTalks_1.getTalkById)(api, input.talkId);
        if (!talk) {
            return { error: `Talk ${input.talkId} not found in Kommo` };
        }
        const cid = (0, kommoTalks_1.conversationIdFromTalk)(talk);
        if (!cid) {
            return { error: "Could not derive conversation_id from talk" };
        }
        return { conversationId: cid, talkId: input.talkId };
    }
    if (input.leadId != null) {
        const talks = await (0, kommoTalks_1.findTalksForLead)(api, input.leadId);
        for (const t of talks) {
            const cid = (0, kommoTalks_1.conversationIdFromTalk)(t);
            if (cid) {
                return { conversationId: cid, talkId: typeof t.id === "number" ? t.id : undefined };
            }
        }
        return {
            error: "No open talk/conversation for this lead. Open a WhatsApp chat in Kommo for the lead first, or pass talkId / conversationId.",
        };
    }
    return { error: "Provide leadId, talkId, or conversationId" };
}
/**
 * Send outbound: Amojo Chats API (real WhatsApp/channel) when configured; optional CRM note fallback.
 */
async function sendKommoOutboundMessage(input, clientId, clientSecret) {
    var _a, _b, _c, _d, _e;
    const channelSecret = (_a = process.env.KOMMO_CHANNEL_SECRET) !== null && _a !== void 0 ? _a : "";
    const scopeId = (_b = process.env.KOMMO_SCOPE_ID) !== null && _b !== void 0 ? _b : "";
    const accountId = (_c = process.env.KOMMO_AMOJO_ACCOUNT_ID) !== null && _c !== void 0 ? _c : "";
    const senderId = (_d = process.env.KOMMO_AMOJO_SENDER_ID) !== null && _d !== void 0 ? _d : "integration";
    const senderName = (_e = process.env.KOMMO_AMOJO_SENDER_NAME) !== null && _e !== void 0 ? _e : "Oops";
    const fallbackNotes = process.env.KOMMO_SEND_FALLBACK_NOTES === "true";
    const accessToken = await (0, kommoOAuth_1.getValidAccessToken)(clientId, clientSecret);
    const firestore = (0, firestore_1.getFirestore)();
    const clienteId = input.leadId != null
        ? await (0, rtdbHelpers_1.resolveClienteIdRTDB)({ kommo_lead_id: input.leadId })
        : null;
    const amojoReady = channelSecret !== "" && scopeId !== "" && accountId !== "";
    if (amojoReady) {
        const resolved = await resolveConversationId(accessToken, input);
        if ("error" in resolved) {
            if (fallbackNotes && input.leadId != null) {
                return sendCrmNoteFallback(input.leadId, input.message, accessToken, firestore, clienteId);
            }
            return { success: false, error: resolved.error };
        }
        const msgid = crypto.randomUUID();
        const now = Date.now();
        const body = {
            event_type: "new_message",
            payload: {
                timestamp: Math.floor(now / 1000),
                msec_timestamp: now,
                msgid,
                conversation_id: resolved.conversationId,
                silent: false,
                sender: {
                    id: senderId,
                    name: senderName,
                },
                message: {
                    type: "text",
                    text: input.message,
                },
            },
            account_id: accountId,
        };
        const { status, data } = await (0, amojoClient_1.postAmojoNewMessage)({
            scopeId,
            channelSecret,
            accountId,
            body,
        });
        if (status >= 200 && status < 300) {
            await (0, firestoreHelpers_1.saveMessage)(firestore, {
                clienteId,
                text: input.message,
                direction: "outbound",
                lead_id: input.leadId,
                talk_id: resolved.talkId,
                conversation_id: resolved.conversationId,
                channel: "whatsapp",
                delivery: "amojo",
                kommo_message_id: msgid,
                meta: { amojoResponse: data },
            });
            return { success: true, delivery: "amojo", amojoStatus: status };
        }
        const errDetail = typeof data === "object" && data !== null && "detail" in data
            ? JSON.stringify(data)
            : String(data);
        if (fallbackNotes && input.leadId != null) {
            const fb = await sendCrmNoteFallback(input.leadId, `[Amojo ${status}] ${input.message}`, accessToken, firestore, clienteId);
            if (fb.success) {
                return {
                    success: true,
                    delivery: "crm_note",
                    noteId: fb.noteId,
                    error: `Amojo failed (${status}): ${errDetail}. Logged as CRM note.`,
                };
            }
        }
        return {
            success: false,
            error: `Amojo send failed HTTP ${status}: ${errDetail}`,
            amojoStatus: status,
        };
    }
    if (fallbackNotes && input.leadId != null) {
        return sendCrmNoteFallback(input.leadId, input.message, accessToken, firestore, clienteId);
    }
    return {
        success: false,
        error: "Chats API not configured. Set KOMMO_CHANNEL_SECRET, KOMMO_SCOPE_ID, KOMMO_AMOJO_ACCOUNT_ID (from Kommo channel connection), or set KOMMO_SEND_FALLBACK_NOTES=true for CRM notes only.",
    };
}
async function sendCrmNoteFallback(leadId, message, accessToken, firestore, clienteId) {
    var _a, _b, _c, _d;
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
        await (0, firestoreHelpers_1.saveMessage)(firestore, {
            clienteId,
            text: message,
            direction: "outbound",
            lead_id: leadId,
            delivery: "crm_note",
        });
        return { success: true, noteId };
    }
    catch (err) {
        const msg = err && typeof err === "object" && "message" in err
            ? String(err.message)
            : "Unknown error";
        return { success: false, error: msg };
    }
}
/** @deprecated Use sendKommoOutboundMessage — kept for tests */
async function sendMessageToLead(leadId, message, clientId, clientSecret) {
    const r = await sendKommoOutboundMessage({ leadId, message }, clientId, clientSecret);
    return {
        success: r.success,
        noteId: r.noteId,
        error: r.error,
    };
}
function extractPhoneFromPayload(payload) {
    return extractPhoneCandidatesFromPayload(payload)[0];
}
function extractIdsFromPayload(payload) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const root = unwrapNestedPayload(payload);
    const out = {};
    const leads = root.leads;
    if (leads) {
        const add = (_a = leads.add) === null || _a === void 0 ? void 0 : _a[0];
        const upd = (_b = leads.update) === null || _b === void 0 ? void 0 : _b[0];
        const item = add !== null && add !== void 0 ? add : upd;
        if (item === null || item === void 0 ? void 0 : item.id)
            out.lead_id = Number(item.id);
    }
    const contacts = root.contacts;
    if (contacts) {
        const add = (_c = contacts.add) === null || _c === void 0 ? void 0 : _c[0];
        const upd = (_d = contacts.update) === null || _d === void 0 ? void 0 : _d[0];
        const item = add !== null && add !== void 0 ? add : upd;
        if (item === null || item === void 0 ? void 0 : item.id)
            out.contact_id = String(item.id);
    }
    const notes = root.notes;
    if (notes === null || notes === void 0 ? void 0 : notes.add) {
        const add = (_e = notes.add) === null || _e === void 0 ? void 0 : _e[0];
        if (add === null || add === void 0 ? void 0 : add.entity_id)
            out.lead_id = Number(add.entity_id);
    }
    for (const entry of chatSectionEntries(root, "messages")) {
        if (!isRecord(entry))
            continue;
        const lid = (_g = (_f = extractStringValue(entry.lead_id)) !== null && _f !== void 0 ? _f : extractStringValue(entry.entity_id)) !== null && _g !== void 0 ? _g : extractStringValue(entry.entityId);
        if (lid && !Number.isNaN(Number(lid)))
            out.lead_id = Number(lid);
        const cid = (_h = extractStringValue(entry.contact_id)) !== null && _h !== void 0 ? _h : extractStringValue(entry.contactId);
        if (cid)
            out.contact_id = cid;
        const conv = (_k = (_j = extractStringValue(entry.conversation_id)) !== null && _j !== void 0 ? _j : extractStringValue(entry.conversationId)) !== null && _k !== void 0 ? _k : extractStringValue(entry.chat_id);
        if (conv)
            out.conversation_id = conv;
        const tid = (_l = entry.talk_id) !== null && _l !== void 0 ? _l : entry.talkId;
        if (typeof tid === "number")
            out.talk_id = tid;
        else if (typeof tid === "string" && !Number.isNaN(Number(tid))) {
            out.talk_id = Number(tid);
        }
    }
    return out;
}
function extractMessageTextFromPayload(payload) {
    var _a;
    const root = unwrapNestedPayload(payload);
    const notes = root.notes;
    if (notes === null || notes === void 0 ? void 0 : notes.add) {
        const add = (_a = notes.add) === null || _a === void 0 ? void 0 : _a[0];
        const params = add === null || add === void 0 ? void 0 : add.params;
        if (params === null || params === void 0 ? void 0 : params.text)
            return params.text;
    }
    for (const entry of chatSectionEntries(root, "messages")) {
        if (!isRecord(entry))
            continue;
        const t = textFromChatEntry(entry);
        if (t)
            return t;
    }
    return undefined;
}
function extractInboundMeta(payload) {
    var _a, _b;
    const root = unwrapNestedPayload(payload);
    for (const entry of chatSectionEntries(root, "messages")) {
        if (!isRecord(entry))
            continue;
        const mid = messageIdFromChatEntry(entry);
        const src = entry.source;
        const channel = (_b = (_a = extractStringValue(entry.messenger_type)) !== null && _a !== void 0 ? _a : extractStringValue(entry.channel)) !== null && _b !== void 0 ? _b : (isRecord(src) ? extractStringValue(src.type) : undefined);
        if (mid || channel) {
            return { kommo_message_id: mid, channel: channel !== null && channel !== void 0 ? channel : undefined };
        }
    }
    return {};
}
const DEFAULT_CC = (_b = process.env.KOMMO_DEFAULT_COUNTRY_CODE) !== null && _b !== void 0 ? _b : "297";
async function processWebhookAsync(payload) {
    var _a, _b;
    const firestore = (0, firestore_1.getFirestore)();
    const phoneCandidates = extractPhoneCandidatesFromPayload(payload);
    const phoneNormalizedCandidates = phoneCandidates.flatMap((p) => (0, phoneUtils_1.phoneMatchCandidates)(p, DEFAULT_CC));
    const uniquePhones = Array.from(new Set(phoneNormalizedCandidates.filter(Boolean)));
    const primaryPhone = (_a = uniquePhones[0]) !== null && _a !== void 0 ? _a : (0, phoneUtils_1.normalizePhone)((_b = phoneCandidates[0]) !== null && _b !== void 0 ? _b : "");
    const { lead_id, contact_id, talk_id, conversation_id } = extractIdsFromPayload(payload);
    const { kommo_message_id, channel } = extractInboundMeta(payload);
    let clienteId = await (0, rtdbHelpers_1.resolveClienteIdRTDB)({
        kommo_contact_id: contact_id,
        kommo_lead_id: lead_id,
    });
    if (!clienteId) {
        for (const phone of uniquePhones) {
            const resolved = await (0, rtdbHelpers_1.resolveClienteIdRTDB)({ phone });
            if (resolved) {
                clienteId = resolved;
                break;
            }
        }
    }
    if (clienteId && (contact_id || lead_id != null)) {
        await (0, rtdbHelpers_1.updateClienteKommoIdsRTDB)(clienteId, Object.assign(Object.assign({}, (contact_id && { kommo_contact_id: contact_id })), (lead_id != null && { kommo_lead_id: lead_id })));
    }
    const text = extractMessageTextFromPayload(payload);
    if (text) {
        const dedupKey = extractWebhookDedupKey(payload);
        if (await (0, firestoreHelpers_1.isWebhookDuplicate)(firestore, dedupKey)) {
            return;
        }
        await (0, firestoreHelpers_1.saveMessage)(firestore, {
            clienteId,
            phoneNormalized: primaryPhone || undefined,
            text,
            direction: "inbound",
            kommo_message_id,
            lead_id,
            talk_id,
            conversation_id,
            channel,
            delivery: "unknown",
            meta: { dedupKeyPreview: dedupKey.slice(0, 120) },
        });
        await (0, firestoreHelpers_1.recordWebhookProcessed)(firestore, dedupKey, {
            lead_id,
            contact_id,
            inbound: true,
        });
    }
}
//# sourceMappingURL=kommoService.js.map