"use strict";
/**
 * Axios client for Kommo CRM API v4.
 * baseURL: https://{domain}.kommo.com/api/v4
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createKommoClient = createKommoClient;
const axios_1 = __importDefault(require("axios"));
function createKommoClient(accessToken, domain) {
    const baseURL = `https://${domain}.kommo.com/api/v4`;
    console.log("Creating Kommo API client for:", baseURL);
    return axios_1.default.create({
        baseURL,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    });
}
//# sourceMappingURL=client.js.map