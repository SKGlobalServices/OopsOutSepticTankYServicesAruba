/**
 * Manual sync endpoint for Kommo V1.
 * - syncData: fetches leads + contacts and saves raw to RTDB
 */

import { getDatabase } from "firebase-admin/database";
import { createKommoClient } from "./client";
import { getValidAccessToken } from "./tokenManager";
import { fetchLeads, fetchContacts } from "./services";

const KOMMO_RAW_PATH = "kommo_raw";

function getClientId(): string {
  return process.env.KOMMO_CLIENT_ID ?? "";
}

function getClientSecret(): string {
  return process.env.KOMMO_CLIENT_SECRET ?? "";
}

function getDomain(): string {
  return process.env.KOMMO_DOMAIN ?? "";
}

function validateConfig(): string | null {
  if (!getClientId()) return "KOMMO_CLIENT_ID not set";
  if (!getClientSecret()) return "KOMMO_CLIENT_SECRET not set";
  if (!getDomain()) return "KOMMO_DOMAIN not set";
  return null;
}

interface KommoEmbeddedResponse {
  _embedded?: {
    leads?: unknown[];
    contacts?: unknown[];
  };
}

export async function syncData(): Promise<{
  success: boolean;
  leadsCount?: number;
  contactsCount?: number;
  error?: string;
}> {
  const configErr = validateConfig();
  if (configErr) return { success: false, error: configErr };

  try {
    const accessToken = await getValidAccessToken(getClientId(), getClientSecret());
    const client = createKommoClient(accessToken, getDomain());

    console.log("Starting Kommo sync...");

    const leads = await fetchLeads(client);
    const contacts = await fetchContacts(client);

    const db = getDatabase();
    const now = Date.now();

    await db.ref(`${KOMMO_RAW_PATH}/leads`).set(leads);
    console.log("Leads saved to RTDB");

    await db.ref(`${KOMMO_RAW_PATH}/contacts`).set(contacts);
    console.log("Contacts saved to RTDB");

    await db.ref(`${KOMMO_RAW_PATH}/last_sync`).set(now);
    console.log("Sync completed at:", new Date(now).toISOString());

    const leadsData = leads as KommoEmbeddedResponse | null;
    const contactsData = contacts as KommoEmbeddedResponse | null;

    return {
      success: true,
      leadsCount: Array.isArray(leadsData?._embedded?.leads)
        ? leadsData._embedded.leads.length
        : 0,
      contactsCount: Array.isArray(contactsData?._embedded?.contacts)
        ? contactsData._embedded.contacts.length
        : 0,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Kommo sync error:", msg);
    return { success: false, error: msg };
  }
}
