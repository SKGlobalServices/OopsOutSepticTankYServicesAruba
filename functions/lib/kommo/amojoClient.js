"use strict";
/**
 * Kommo Chats API (Amojo) — signed requests to send real channel messages.
 * POST https://amojo.kommo.com/v2/origin/custom/{scope_id}
 *
 * Docs: https://developers.kommo.com/reference/send-import-messages
 * Requires: channel secret + scope_id + account_id from channel connection.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAmojoSignature = buildAmojoSignature;
exports.postAmojoNewMessage = postAmojoNewMessage;
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
const AMOJO_BASE = "https://amojo.kommo.com";
/**
 * Content-MD5: Kommo examples use lowercase hex of UTF-8 body.
 * If requests fail with 401/403, try KOMMO_AMOJO_MD5_MODE=base64 (binary MD5, base64).
 */
function contentMd5Header(body, mode) {
    const hash = crypto.createHash("md5").update(body, "utf8");
    if (mode === "base64") {
        return hash.digest("base64");
    }
    return hash.digest("hex");
}
/**
 * X-Signature: HMAC-SHA1 of canonical string, base64-encoded.
 * Canonical line order matches Kommo / amoCRM chat integrations:
 * METHOD, Content-MD5, Content-Type (lower), Date (HTTP), path (incl. leading slash).
 */
function buildAmojoSignature(params) {
    const ct = params.contentType.toLowerCase();
    const stringToSign = [
        params.method.toUpperCase(),
        params.contentMd5,
        ct,
        params.dateHeader,
        params.path,
    ].join("\n");
    return crypto
        .createHmac("sha1", params.channelSecret)
        .update(stringToSign, "utf8")
        .digest("base64");
}
async function postAmojoNewMessage(options) {
    var _a, _b;
    const md5Mode = (_b = (_a = options.md5Mode) !== null && _a !== void 0 ? _a : process.env.KOMMO_AMOJO_MD5_MODE) !== null && _b !== void 0 ? _b : "hex";
    const jsonBody = JSON.stringify(options.body);
    const path = `/v2/origin/custom/${options.scopeId}`;
    const url = `${AMOJO_BASE}${path}`;
    const dateHeader = new Date().toUTCString();
    const contentType = "application/json";
    const contentMd5 = contentMd5Header(jsonBody, md5Mode);
    const xSignature = buildAmojoSignature({
        method: "POST",
        contentMd5,
        contentType,
        dateHeader,
        path,
        channelSecret: options.channelSecret,
    });
    const res = await axios_1.default.post(url, jsonBody, {
        headers: {
            "Content-Type": contentType,
            Date: dateHeader,
            "Content-MD5": contentMd5,
            "X-Signature": xSignature,
        },
        validateStatus: () => true,
    });
    return { status: res.status, data: res.data };
}
//# sourceMappingURL=amojoClient.js.map