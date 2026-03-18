"use strict";
/**
 * Axios client for Kommo CRM API v4.
 * baseURL: https://{domain}.kommo.com/api/v4
 * Authorization: Bearer access_token
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createKommoClient = createKommoClient;
const axios_1 = __importDefault(require("axios"));
const DEFAULT_BASE_URL = "https://example.kommo.com/api/v4";
function createKommoClient(accessToken, domain) {
    const baseURL = domain != null && domain !== ""
        ? `https://${domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}.kommo.com/api/v4`
        : DEFAULT_BASE_URL;
    const client = axios_1.default.create({
        baseURL,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    });
    client.interceptors.response.use((res) => res, async (err) => {
        var _a;
        if (((_a = err.response) === null || _a === void 0 ? void 0 : _a.status) === 401) {
            // Token expired – caller should refresh and retry
            err.message = "Kommo access token expired or invalid";
        }
        return Promise.reject(err);
    });
    return client;
}
//# sourceMappingURL=kommoClient.js.map