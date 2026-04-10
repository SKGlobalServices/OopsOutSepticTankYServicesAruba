"use strict";
/**
 * Kommo OAuth 2.0 token management via Realtime Database.
 * Handles: exchange code → tokens, refresh, read with auto-refresh.
 * Tokens stored at kommo_tokens/default in RTDB.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStoredTokens = getStoredTokens;
exports.saveTokens = saveTokens;
exports.exchangeCodeForTokens = exchangeCodeForTokens;
exports.refreshAccessToken = refreshAccessToken;
exports.getValidAccessToken = getValidAccessToken;
const database_1 = require("firebase-admin/database");
const axios_1 = __importStar(require("axios"));
const KOMMO_TOKEN_PATH = "kommo_tokens/default";
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
function getSubdomain() {
    var _a;
    const sub = (_a = process.env.KOMMO_DOMAIN) !== null && _a !== void 0 ? _a : "";
    if (!sub)
        throw new Error("KOMMO_DOMAIN env var is not set");
    return sub;
}
function tokenEndpoint() {
    return `https://${getSubdomain()}.kommo.com/oauth2/access_token`;
}
async function getStoredTokens() {
    const db = (0, database_1.getDatabase)();
    const snap = await db.ref(KOMMO_TOKEN_PATH).once("value");
    const val = snap.val();
    if (!val || !val.access_token)
        return null;
    return val;
}
async function saveTokens(tokens) {
    const db = (0, database_1.getDatabase)();
    await db.ref(KOMMO_TOKEN_PATH).set(tokens);
    console.log("Kommo tokens saved to RTDB, expires_at:", new Date(tokens.expires_at).toISOString());
}
async function exchangeCodeForTokens(code, clientId, clientSecret, redirectUri) {
    var _a;
    console.log("Exchanging OAuth code for tokens...");
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
    });
    let res;
    try {
        res = await axios_1.default.post(tokenEndpoint(), body.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            validateStatus: () => true,
        });
    }
    catch (e) {
        const msg = (0, axios_1.isAxiosError)(e)
            ? `Network error calling Kommo OAuth: ${e.message}`
            : String(e);
        console.error("Kommo OAuth exchange network error:", msg);
        throw new Error(msg);
    }
    console.log("Kommo OAuth response status:", res.status);
    if (res.status < 200 || res.status >= 300) {
        const detail = JSON.stringify(res.data);
        console.error("Kommo OAuth exchange failed:", detail);
        throw new Error(`Kommo OAuth token exchange failed HTTP ${res.status}: ${detail}`);
    }
    const data = res.data;
    const tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + ((_a = data.expires_in) !== null && _a !== void 0 ? _a : 86400) * 1000,
    };
    await saveTokens(tokens);
    console.log("OAuth code exchange successful");
    return tokens;
}
async function refreshAccessToken(clientId, clientSecret) {
    var _a;
    const current = await getStoredTokens();
    if (!current) {
        throw new Error("No Kommo tokens in RTDB. Complete OAuth flow first.");
    }
    console.log("Refreshing Kommo access token...");
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: current.refresh_token,
    });
    let res;
    try {
        res = await axios_1.default.post(tokenEndpoint(), body.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            validateStatus: () => true,
        });
    }
    catch (e) {
        const msg = (0, axios_1.isAxiosError)(e)
            ? `Network error refreshing Kommo token: ${e.message}`
            : String(e);
        console.error("Kommo token refresh network error:", msg);
        throw new Error(msg);
    }
    console.log("Kommo refresh response status:", res.status);
    if (res.status < 200 || res.status >= 300) {
        const detail = JSON.stringify(res.data);
        console.error("Kommo token refresh failed:", detail);
        throw new Error(`Kommo token refresh failed HTTP ${res.status}: ${detail}`);
    }
    const data = res.data;
    const tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + ((_a = data.expires_in) !== null && _a !== void 0 ? _a : 86400) * 1000,
    };
    await saveTokens(tokens);
    console.log("Token refresh successful");
    return tokens;
}
/**
 * Returns a valid access token, refreshing automatically if expired or near-expiry.
 */
async function getValidAccessToken(clientId, clientSecret) {
    const tokens = await getStoredTokens();
    if (!tokens) {
        throw new Error("No Kommo tokens in RTDB. Complete OAuth flow first.");
    }
    if (Date.now() >= tokens.expires_at - REFRESH_BUFFER_MS) {
        console.log("Token expired or near expiry, refreshing...");
        const refreshed = await refreshAccessToken(clientId, clientSecret);
        return refreshed.access_token;
    }
    return tokens.access_token;
}
//# sourceMappingURL=tokenManager.js.map