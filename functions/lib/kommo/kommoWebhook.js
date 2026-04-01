"use strict";
/**
 * Single HTTP endpoint for Kommo CRM webhooks: POST /kommo/webhook
 * Responds 200 immediately and processes payload asynchronously.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createKommoWebhookHandler = createKommoWebhookHandler;
const kommoService_1 = require("./kommoService");
/**
 * Kommo sends webhooks as x-www-form-urlencoded. Parse body accordingly.
 * Payload may be in a single field (e.g. payload or the entity object).
 */
function parseWebhookBody(req) {
    var _a, _b, _c, _d, _e;
    const body = req.body;
    if (body && typeof body === "object" && !Array.isArray(body)) {
        const rec = body;
        if ((_c = (_b = (_a = rec.leads) !== null && _a !== void 0 ? _a : rec.contacts) !== null && _b !== void 0 ? _b : rec.notes) !== null && _c !== void 0 ? _c : rec.messages) {
            return rec;
        }
        const payloadStr = (_e = (_d = rec.payload) !== null && _d !== void 0 ? _d : rec.data) !== null && _e !== void 0 ? _e : rec.body;
        if (typeof payloadStr === "string") {
            try {
                const parsed = JSON.parse(payloadStr);
                return parsed;
            }
            catch (_f) {
                return rec;
            }
        }
        return rec;
    }
    if (typeof body === "string") {
        try {
            return JSON.parse(body);
        }
        catch (_g) {
            return { raw: body.slice(0, 500) };
        }
    }
    return {};
}
/**
 * Handle POST /kommo/webhook: respond 200 immediately, then process async.
 * Processing only writes to Firestore (no Kommo API calls), so no OAuth needed here.
 */
function createKommoWebhookHandler() {
    return async (req, res) => {
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }
        const payload = parseWebhookBody(req);
        res.status(200).send("ok");
        (0, kommoService_1.processWebhookAsync)(payload).catch((err) => {
            console.error("Kommo webhook processing error:", err);
        });
    };
}
//# sourceMappingURL=kommoWebhook.js.map