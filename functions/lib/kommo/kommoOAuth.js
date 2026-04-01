"use strict";
/**
 * Kommo OAuth 2.0: exchange code for tokens, refresh token, read tokens from Firestore.
 * Tokens stored in collection kommo_tokens, document "default". Frontend must NEVER access them.
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
exports.exchangeCodeForTokens = exchangeCodeForTokens;
exports.refreshAccessToken = refreshAccessToken;
exports.getValidAccessToken = getValidAccessToken;
const firestore_1 = require("firebase-admin/firestore");
const axios_1 = __importStar(require("axios"));
const KOMMO_TOKEN_COLLECTION = "kommo_tokens";
const KOMMO_TOKEN_DOC_ID = "default";
const KOMMO_OAUTH_URL = "https://www.kommo.com/oauth2/access_token";
/**
 * Exchange authorization code for access_token and refresh_token.
 */
async function exchangeCodeForTokens(code, clientId, clientSecret, redirectUri) {
    var _a;
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
    });
    let res;
    try {
        res = await axios_1.default.post(KOMMO_OAUTH_URL, body.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            validateStatus: () => true,
        });
    }
    catch (e) {
        const msg = (0, axios_1.isAxiosError)(e)
            ? `Network error calling Kommo OAuth: ${e.message}`
            : String(e);
        throw new Error(msg);
    }
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`Kommo OAuth token exchange failed HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    }
    const data = res.data;
    const expires_at = Date.now() + ((_a = data.expires_in) !== null && _a !== void 0 ? _a : 86400) * 1000;
    const tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at,
    };
    const db = (0, firestore_1.getFirestore)();
    await db.collection(KOMMO_TOKEN_COLLECTION).doc(KOMMO_TOKEN_DOC_ID).set(tokens);
    return tokens;
}
/**
 * Refresh access_token using refresh_token. Updates Firestore.
 */
async function refreshAccessToken(clientId, clientSecret) {
    var _a;
    const db = (0, firestore_1.getFirestore)();
    const snap = await db.collection(KOMMO_TOKEN_COLLECTION).doc(KOMMO_TOKEN_DOC_ID).get();
    if (!snap.exists) {
        throw new Error("Kommo tokens not found. Run OAuth flow first.");
    }
    const current = snap.data();
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: current.refresh_token,
    });
    let res;
    try {
        res = await axios_1.default.post(KOMMO_OAUTH_URL, body.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            validateStatus: () => true,
        });
    }
    catch (e) {
        const msg = (0, axios_1.isAxiosError)(e)
            ? `Network error refreshing Kommo token: ${e.message}`
            : String(e);
        throw new Error(msg);
    }
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`Kommo token refresh failed HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    }
    const data = res.data;
    const expires_at = Date.now() + ((_a = data.expires_in) !== null && _a !== void 0 ? _a : 86400) * 1000;
    const tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at,
    };
    await db.collection(KOMMO_TOKEN_COLLECTION).doc(KOMMO_TOKEN_DOC_ID).set(tokens);
    return tokens;
}
/**
 * Get valid access token; refresh if expired.
 */
async function getValidAccessToken(clientId, clientSecret) {
    var _a;
    const db = (0, firestore_1.getFirestore)();
    const snap = await db.collection(KOMMO_TOKEN_COLLECTION).doc(KOMMO_TOKEN_DOC_ID).get();
    if (!snap.exists) {
        throw new Error("Kommo tokens not found. Run OAuth flow first.");
    }
    const data = snap.data();
    const expiresAt = (_a = data.expires_at) !== null && _a !== void 0 ? _a : 0;
    const bufferMs = 5 * 60 * 1000;
    if (Date.now() >= expiresAt - bufferMs) {
        const refreshed = await refreshAccessToken(clientId, clientSecret);
        return refreshed.access_token;
    }
    return data.access_token;
}
//# sourceMappingURL=kommoOAuth.js.map