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
const webhookHandler = (0, kommoWebhook_1.createKommoWebhookHandler)();
/**
 * Single webhook endpoint for Kommo CRM.
 * Configure in Kommo: Ajustes → Integración → Webhooks → URL = this function's URL.
 * Events: leads.add, leads.update, contacts.add, contacts.update, notes.add
 */
exports.kommoWebhook = (0, https_1.onRequest)({
    region: "us-central1",
    invoker: "public",
}, webhookHandler);
/**
 * Callable: send a message to a Kommo lead (adds note to lead and saves to Firestore).
 * Input: { leadId: number, message: string }
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
    if (!data || typeof data.leadId !== "number" || typeof data.message !== "string") {
        throw new https_2.HttpsError("invalid-argument", "Input must be { leadId: number, message: string }");
    }
    const clientId = getKommoClientId();
    const clientSecret = getKommoClientSecret();
    if (!clientId || !clientSecret) {
        throw new https_2.HttpsError("failed-precondition", "Kommo OAuth not configured (KOMMO_CLIENT_ID, KOMMO_CLIENT_SECRET)");
    }
    const result = await (0, kommoService_1.sendMessageToLead)(data.leadId, data.message, clientId, clientSecret);
    if (!result.success) {
        throw new https_2.HttpsError("internal", (_a = result.error) !== null && _a !== void 0 ? _a : "Failed to send message");
    }
    return { success: true, noteId: result.noteId };
});
/**
 * Callable: exchange OAuth authorization code for tokens and store in Firestore.
 * Only call from a trusted admin context (e.g. after redirect from Kommo).
 * Input: { code: string, redirectUri: string }
 */
exports.kommoOAuth = (0, https_2.onCall)({
    region: "us-central1",
}, async (request) => {
    const data = request.data;
    if (!(data === null || data === void 0 ? void 0 : data.code) || !(data === null || data === void 0 ? void 0 : data.redirectUri)) {
        throw new https_2.HttpsError("invalid-argument", "Input must be { code: string, redirectUri: string }");
    }
    const clientId = getKommoClientId();
    const clientSecret = getKommoClientSecret();
    if (!clientId || !clientSecret) {
        throw new https_2.HttpsError("failed-precondition", "Kommo OAuth not configured");
    }
    await (0, kommoOAuth_1.exchangeCodeForTokens)(data.code, clientId, clientSecret, data.redirectUri);
    return { success: true };
});
//# sourceMappingURL=index.js.map