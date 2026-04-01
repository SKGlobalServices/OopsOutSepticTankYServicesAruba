/**
 * Resolve Kommo talk / conversation for CRM entities (leads) via API v4.
 */

import { AxiosInstance } from "axios";

export type KommoTalkEmbedded = {
  id?: number;
  chat_id?: string;
  contact_id?: number;
  entity_id?: number;
  entity_type?: string;
  is_in_work?: boolean;
  [key: string]: unknown;
};

export type KommoTalksListResponse = {
  _embedded?: {
    talks?: KommoTalkEmbedded[];
  };
};

/**
 * List talks linked to a lead (entity_type is typically "leads" in amo/Kommo).
 */
export async function findTalksForLead(
  api: AxiosInstance,
  leadId: number
): Promise<KommoTalkEmbedded[]> {
  const res = await api.get<KommoTalksListResponse>("/talks", {
    params: {
      "filter[entity_id]": leadId,
      "filter[entity_type]": "leads",
      limit: 10,
    },
    validateStatus: () => true,
  });
  if (res.status >= 400) {
    const alt = await api.get<KommoTalksListResponse>("/talks", {
      params: {
        "filter[entity_id]": leadId,
        "filter[entity_type]": "lead",
        limit: 10,
      },
      validateStatus: () => true,
    });
    if (alt.status < 400 && alt.data._embedded?.talks?.length) {
      return alt.data._embedded.talks;
    }
    return [];
  }
  return res.data._embedded?.talks ?? [];
}

export async function getTalkById(
  api: AxiosInstance,
  talkId: number
): Promise<KommoTalkEmbedded | null> {
  const res = await api.get<KommoTalkEmbedded>(`/talks/${talkId}`, {
    validateStatus: () => true,
  });
  if (res.status >= 400) return null;
  return res.data;
}

/**
 * Pick conversation_id for Amojo: prefer explicit chat_id on talk, else string talk id.
 */
export function conversationIdFromTalk(talk: KommoTalkEmbedded): string | undefined {
  if (talk.chat_id && String(talk.chat_id).trim() !== "") {
    return String(talk.chat_id);
  }
  if (talk.id != null) {
    return String(talk.id);
  }
  return undefined;
}
