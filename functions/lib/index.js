"use strict";
/**
 * Firebase Cloud Functions for Kommo CRM integration.
 * - kommoWebhook: POST HTTP endpoint for Kommo CRM webhooks
 * - kommoSendMessage: Callable to send message to a lead
 * - kommoOAuth: Callable to exchange code for tokens (admin only)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.kommoOAuth = exports.kommoSendMessage = exports.kommoWebhook = void 0;
const app_1 = require("firebase-admin/app");
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
const kommoWebhook_1 = require("./kommo/kommoWebhook");
const kommoService_1 = require("./kommo/kommoService");
const kommoOAuth_1 = require("./kommo/kommoOAuth");
(0, app_1.initializeApp)();
function getKommoClientId() {
    var _a;
    return (_a = process.env.KOMMO_CLIENT_ID) !== null && _a !== void 0 ? _a : "";
}
function getKommoClientSecret() {
    var _a;
    return (_a = process.env.KOMMO_CLIENT_SECRET) !== null && _a !== void 0 ? _a : "";
}
function getKommoDomain() {
    var _a;
    return (_a = process.env.KOMMO_DOMAIN) !== null && _a !== void 0 ? _a : "";
}
const webhookHandler = (0, kommoWebhook_1.createKommoWebhookHandler)();
/**
 * Single webhook endpoint for Kommo CRM.
 * Configure in Kommo: Ajustes → Integración → Webhooks → URL = this function's URL.
 * Events: leads.*, contacts.*, notes.*, and Chats API message events (configure in Kommo).
 */
exports.kommoWebhook = (0, https_1.onRequest)({
    region: "us-central1",
    invoker: "public",
}, webhookHandler);
/**
 * Callable: send WhatsApp/channel message via Kommo Chats API (Amojo) when configured;
 * optional CRM note fallback if KOMMO_SEND_FALLBACK_NOTES=true.
 * Input: { message: string, leadId?: number, talkId?: number, conversationId?: string }
 * — at least one of leadId / talkId / conversationId is required.
 */
exports.kommoSendMessage = (0, https_2.onCall)({
    region: "us-central1",
}, async (request) => {
    var _a;
    const auth = request.auth;
    if (!auth) {
        throw new https_2.HttpsError("unauthenticated", "Must be logged in");
    }
    const data = request.data;
    if (!data || typeof data.message !== "string" || !data.message.trim()) {
        throw new https_2.HttpsError("invalid-argument", "message (non-empty string) is required");
    }
    const hasLead = typeof data.leadId === "number";
    const hasTalk = typeof data.talkId === "number";
    const hasConv = typeof data.conversationId === "string" &&
        data.conversationId.trim() !== "";
    if (!hasLead && !hasTalk && !hasConv) {
        throw new https_2.HttpsError("invalid-argument", "Provide at least one of: leadId, talkId, or conversationId");
    }
    const clientId = getKommoClientId();
    const clientSecret = getKommoClientSecret();
    if (!clientId || !clientSecret) {
        throw new https_2.HttpsError("failed-precondition", "Kommo OAuth not configured (KOMMO_CLIENT_ID, KOMMO_CLIENT_SECRET)");
    }
    if (!getKommoDomain().trim()) {
        throw new https_2.HttpsError("failed-precondition", "KOMMO_DOMAIN is not set (subdomain only, e.g. youraccount for youraccount.kommo.com)");
    }
    const result = await (0, kommoService_1.sendKommoOutboundMessage)({
        message: data.message.trim(),
        leadId: hasLead ? data.leadId : undefined,
        talkId: hasTalk ? data.talkId : undefined,
        conversationId: hasConv ? data.conversationId.trim() : undefined,
    }, clientId, clientSecret);
    if (!result.success) {
        throw new https_2.HttpsError("internal", (_a = result.error) !== null && _a !== void 0 ? _a : "Failed to send message");
    }
    return {
        success: true,
        delivery: result.delivery,
        noteId: result.noteId,
        amojoStatus: result.amojoStatus,
    };
});
/**
 * Callable: exchange OAuth authorization code for tokens and store in Firestore.
 * Requires Firebase Auth (e.g. user signed in with Google before opening Kommo OAuth).
 * Input: { code: string, redirectUri: string }
 */
exports.kommoOAuth = (0, https_2.onCall)({
    region: "us-central1",
}, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError("unauthenticated", "Must be logged in with Firebase Auth to complete Kommo OAuth");
    }
    const data = request.data;
    if (!(data === null || data === void 0 ? void 0 : data.code) || !(data === null || data === void 0 ? void 0 : data.redirectUri)) {
        throw new https_2.HttpsError("invalid-argument", "Input must be { code: string, redirectUri: string }");
    }
    const clientId = getKommoClientId();
    const clientSecret = getKommoClientSecret();
    if (!clientId || !clientSecret) {
        throw new https_2.HttpsError("failed-precondition", "Kommo OAuth not configured");
    }
    try {
        await (0, kommoOAuth_1.exchangeCodeForTokens)(data.code, clientId, clientSecret, data.redirectUri);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new https_2.HttpsError("failed-precondition", `Kommo OAuth: ${msg}`);
    }
    return { success: true };
});
//# sourceMappingURL=index.js.map