"use strict";
/**
 * Kommo OAuth 2.0: exchange code for tokens, refresh token, read tokens from Firestore.
 * Tokens stored in collection kommo_tokens, document "default". Frontend must NEVER access them.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeCodeForTokens = exchangeCodeForTokens;
exports.refreshAccessToken = refreshAccessToken;
exports.getValidAccessToken = getValidAccessToken;
const firestore_1 = require("firebase-admin/firestore");
const axios_1 = __importDefault(require("axios"));
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
    const res = await axios_1.default.post(KOMMO_OAUTH_URL, body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
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
    const res = await axios_1.default.post(KOMMO_OAUTH_URL, body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
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