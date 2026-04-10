/**
 * Chat inbox endpoint for Kommo V1.
 * Fetches chat-related events from the Events API, then enriches each
 * event with the lead name via a batched /leads lookup.
 */

import { createKommoClient } from "./client";
import { getValidAccessToken } from "./tokenManager";
import { fetchChatEvents, fetchLeadsByIds } from "./services";

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

interface RawEvent {
  id: string;
  type: string;
  entity_id: number;
  entity_type: string;
  created_by: number;
  created_at: number;
  value_after?: Array<{ message?: { talk_id?: number; id?: string; origin?: string } }>;
  _embedded?: { entity?: { id: number; linked_talk_contact_id?: number; _links?: unknown } };
  [key: string]: unknown;
}

interface EventsResponse {
  _page?: number;
  _links?: unknown;
  _embedded?: { events?: RawEvent[] };
}

interface LeadsResponse {
  _embedded?: { leads?: Array<{ id: number; name?: string }> };
}

export async function getChats(page = 1): Promise<{
  success: boolean;
  events?: unknown;
  error?: string;
}> {
  const configErr = validateConfig();
  if (configErr) return { success: false, error: configErr };

  try {
    const accessToken = await getValidAccessToken(getClientId(), getClientSecret());
    const client = createKommoClient(accessToken, getDomain());

    const rawEvents = (await fetchChatEvents(client, page)) as EventsResponse;
    const eventList = rawEvents?._embedded?.events ?? [];

    const leadIds = [
      ...new Set(
        eventList
          .filter((e) => e.entity_type === "lead" && e.entity_id)
          .map((e) => e.entity_id)
      ),
    ];

    const leadNameMap = new Map<number, string>();
    if (leadIds.length > 0) {
      const leadsData = (await fetchLeadsByIds(client, leadIds)) as LeadsResponse;
      for (const lead of leadsData?._embedded?.leads ?? []) {
        leadNameMap.set(lead.id, lead.name ?? "");
      }
      console.log("Enriched with", leadNameMap.size, "lead names");
    }

    const enriched = eventList.map((ev) => ({
      ...ev,
      lead_name: leadNameMap.get(ev.entity_id) ?? "",
      talk_id: ev.value_after?.[0]?.message?.talk_id ?? null,
      message_id: ev.value_after?.[0]?.message?.id ?? null,
      origin: ev.value_after?.[0]?.message?.origin ?? "",
      contact_id: ev._embedded?.entity?.linked_talk_contact_id ?? null,
    }));

    const result = {
      _page: rawEvents._page,
      _links: rawEvents._links,
      _embedded: { events: enriched },
    };

    console.log("Get chat events completed:", enriched.length, "events enriched");
    return { success: true, events: result };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Get chat events error:", msg);
    return { success: false, error: msg };
  }
}
