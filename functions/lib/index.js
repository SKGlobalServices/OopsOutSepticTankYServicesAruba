"use strict";
/**
 * Firebase Cloud Functions — Kommo CRM Integration V1.
 *
 * Endpoints:
 * - kommoAuthRedirect:  GET  → redirects to Kommo OAuth
 * - kommoAuthCallback:  GET  → handles OAuth callback, stores tokens in RTDB
 * - kommoTestFetch:     GET  → validates connection, returns raw leads/contacts
 * - kommoSync:          POST → fetches leads/contacts and saves raw to RTDB
 * - kommoGetChats:      GET  → returns chats/conversations from Kommo
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kommoGetChats = exports.kommoSync = exports.kommoTestFetch = exports.kommoAuthCallback = exports.kommoAuthRedirect = void 0;
const cors_1 = __importDefault(require("cors"));
const app_1 = require("firebase-admin/app");
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("./kommo/auth");
const chats_1 = require("./kommo/chats");
const sync_1 = require("./kommo/sync");
(0, app_1.initializeApp)();
/** Allows browser requests from any origin (Kommo + SPA). Handles OPTIONS preflight. */
const corsHandler = (0, cors_1.default)({ origin: true });
exports.kommoAuthRedirect = (0, https_1.onRequest)({ region: "us-central1", invoker: "public" }, (req, res) => {
    corsHandler(req, res, () => {
        (0, auth_1.handleAuthRedirect)(req, res);
    });
});
exports.kommoAuthCallback = (0, https_1.onRequest)({ region: "us-central1", invoker: "public" }, (req, res) => {
    corsHandler(req, res, async () => {
        await (0, auth_1.handleAuthCallback)(req, res);
    });
});
exports.kommoTestFetch = (0, https_1.onRequest)({ region: "us-central1", invoker: "public" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "GET") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        const result = await (0, sync_1.testFetch)();
        res.status(result.success ? 200 : 500).json(result);
    });
});
exports.kommoSync = (0, https_1.onRequest)({ region: "us-central1", invoker: "public" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        const result = await (0, sync_1.syncData)();
        res.status(result.success ? 200 : 500).json(result);
    });
});
exports.kommoGetChats = (0, https_1.onRequest)({ region: "us-central1", invoker: "public" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "GET") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
        const result = await (0, chats_1.getChats)(page);
        res.status(result.success ? 200 : 500).json(result);
    });
});
//# sourceMappingURL=index.js.map