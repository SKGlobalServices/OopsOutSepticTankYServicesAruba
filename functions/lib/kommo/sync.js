"use strict";
/**
 * Manual sync and test endpoints for Kommo V1.
 * - testFetch: validates connectivity and returns raw API data
 * - syncData: fetches leads + contacts and saves raw to RTDB
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.testFetch = testFetch;
exports.syncData = syncData;
const database_1 = require("firebase-admin/database");
const client_1 = require("./client");
const tokenManager_1 = require("./tokenManager");
const services_1 = require("./services");
const KOMMO_RAW_PATH = "kommo_raw";
function getClientId() {
    var _a;
    return (_a = process.env.KOMMO_CLIENT_ID) !== null && _a !== void 0 ? _a : "";
}
function getClientSecret() {
    var _a;
    return (_a = process.env.KOMMO_CLIENT_SECRET) !== null && _a !== void 0 ? _a : "";
}
function getDomain() {
    var _a;
    return (_a = process.env.KOMMO_DOMAIN) !== null && _a !== void 0 ? _a : "";
}
function validateConfig() {
    if (!getClientId())
        return "KOMMO_CLIENT_ID not set";
    if (!getClientSecret())
        return "KOMMO_CLIENT_SECRET not set";
    if (!getDomain())
        return "KOMMO_DOMAIN not set";
    return null;
}
async function testFetch() {
    const configErr = validateConfig();
    if (configErr)
        return { success: false, error: configErr };
    try {
        const accessToken = await (0, tokenManager_1.getValidAccessToken)(getClientId(), getClientSecret());
        const client = (0, client_1.createKommoClient)(accessToken, getDomain());
        const leads = await (0, services_1.fetchLeads)(client);
        const contacts = await (0, services_1.fetchContacts)(client);
        console.log("Test fetch completed successfully");
        return { success: true, leads, contacts };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Test fetch error:", msg);
        return { success: false, error: msg };
    }
}
async function syncData() {
    var _a, _b;
    const configErr = validateConfig();
    if (configErr)
        return { success: false, error: configErr };
    try {
        const accessToken = await (0, tokenManager_1.getValidAccessToken)(getClientId(), getClientSecret());
        const client = (0, client_1.createKommoClient)(accessToken, getDomain());
        console.log("Starting Kommo sync...");
        const leads = await (0, services_1.fetchLeads)(client);
        const contacts = await (0, services_1.fetchContacts)(client);
        const db = (0, database_1.getDatabase)();
        const now = Date.now();
        await db.ref(`${KOMMO_RAW_PATH}/leads`).set(leads);
        console.log("Leads saved to RTDB");
        await db.ref(`${KOMMO_RAW_PATH}/contacts`).set(contacts);
        console.log("Contacts saved to RTDB");
        await db.ref(`${KOMMO_RAW_PATH}/last_sync`).set(now);
        console.log("Sync completed at:", new Date(now).toISOString());
        const leadsData = leads;
        const contactsData = contacts;
        return {
            success: true,
            leadsCount: Array.isArray((_a = leadsData === null || leadsData === void 0 ? void 0 : leadsData._embedded) === null || _a === void 0 ? void 0 : _a.leads)
                ? leadsData._embedded.leads.length
                : 0,
            contactsCount: Array.isArray((_b = contactsData === null || contactsData === void 0 ? void 0 : contactsData._embedded) === null || _b === void 0 ? void 0 : _b.contacts)
                ? contactsData._embedded.contacts.length
                : 0,
        };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Kommo sync error:", msg);
        return { success: false, error: msg };
    }
}
//# sourceMappingURL=sync.js.map