/**
 * Message thread retrieval for a specific Kommo lead.
 * Uses the Notes API (v4) which stores chat messages created by integrations
 * as service_message / extended_service_message notes.
 */

import { createKommoClient } from "./client";
import { getValidAccessToken } from "./tokenManager";
import { fetchLeadNotes } from "./services";

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

interface RawNote {
  id: number;
  entity_id: number;
  created_by: number;
  created_at: number;
  updated_at: number;
  note_type: string;
  params?: {
    text?: string;
    service?: string;
    phone?: string;
    duration?: number;
    link?: string;
    uniq?: string;
    [key: string]: unknown;
  };
  account_id: number;
}

interface NotesResponse {
  _embedded?: { notes?: RawNote[] };
  _links?: { next?: { href?: string } };
}

export async function getMessages(
  entityId: number,
  page = 1
): Promise<{ success: boolean; notes?: unknown; error?: string }> {
  const configErr = validateConfig();
  if (configErr) return { success: false, error: configErr };

  if (!entityId || isNaN(entityId)) {
    return { success: false, error: "Invalid entityId" };
  }

  try {
    const accessToken = await getValidAccessToken(getClientId(), getClientSecret());
    const client = createKommoClient(accessToken, getDomain());

    const raw = (await fetchLeadNotes(client, entityId, page)) as NotesResponse;
    const noteList = raw?._embedded?.notes ?? [];

    const normalized = noteList.map((n) => ({
      id: n.id,
      entityId: n.entity_id,
      createdBy: n.created_by,
      createdAt: n.created_at,
      noteType: n.note_type,
      text: n.params?.text ?? null,
      service: n.params?.service ?? null,
      phone: n.params?.phone ?? null,
      params: n.params ?? {},
    }));

    console.log(`getMessages: ${normalized.length} notes for lead ${entityId}`);
    return {
      success: true,
      notes: {
        entityId,
        page,
        hasMore: !!raw?._links?.next,
        items: normalized,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("getMessages error:", msg);
    return { success: false, error: msg };
  }
}
