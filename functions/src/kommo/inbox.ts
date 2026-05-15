/**
 * Inbox endpoint for Kommo - fetches chat conversations from Events API.
 * Groups events by talk_id or entity_id to create conversation threads.
 * Enriches contacts/leads with names via batch API calls.
 */

import { createKommoClient } from "./client";
import { getValidAccessToken } from "./tokenManager";
import { KommoClient } from "./client";

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

const CHAT_EVENT_TYPES = [
  "incoming_chat_message",
  "outgoing_chat_message",
  "talk_created",
].join(",");

const BATCH_SIZE = 50;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface EventResponse {
  _page?: number;
  _total?: number;
  _links?: { self?: { href?: string }; next?: { href?: string } };
  _embedded?: {
    events?: RawEvent[];
  };
}

interface RawEvent {
  id: string;
  type: string;
  entity_id?: number;
  entity_type?: string;
  created_by?: number;
  created_at?: number;
  contact_name?: string;
  lead_name?: string;
  value_after?: Array<{
    message?: {
      id?: string;
      talk_id?: number;
      origin?: string;
    };
  }>;
  _embedded?: {
    entity?: {
      id?: number;
      name?: string;
      linked_talk_contact_id?: number;
      _links?: { self?: { href?: string } };
    };
  };
  [key: string]: unknown;
}

interface InboxConversation {
  id: string;
  talkId: number | null;
  entityId: number | null;
  entityType: string;
  contactId: number | null;
  contactName: string;
  leadId: number | null;
  leadName: string;
  lastMessage: {
    id: string;
    type: "incoming" | "outgoing";
    timestamp: number;
  } | null;
  totalMessages: number;
  origin: string;
  createdAt: number;
  updatedAt: number;
}

interface ConversationInput {
  talkId: number | null;
  entityId: number | null;
  entityType: string;
  contactId: number | null;
  leadId: number | null;
  isDirectTalk: boolean;
}

interface ConversationData {
  events: RawEvent[];
  talkId: number | null;
  entityId: number | null;
  entityType: string;
  contactId: number | null;
  contactName: string;
  leadId: number | null;
  leadName: string;
  origin: string;
  createdAt: number;
  lastMessage: {
    id: string;
    type: "incoming" | "outgoing";
    timestamp: number;
  } | null;
}

const contactCache = new Map<number, string>();
const leadCache = new Map<number, string>();
const talkCache = new Map<number, string>();

async function fetchContactsBatch(
  client: KommoClient,
  contactIds: number[]
): Promise<Map<number, string>> {
  const contactMap = new Map<number, string>();
  const idsToFetch: number[] = [];

  for (const id of contactIds) {
    if (contactCache.has(id)) {
      contactMap.set(id, contactCache.get(id)!);
    } else {
      idsToFetch.push(id);
    }
  }

  if (idsToFetch.length === 0) {
    console.log(`[Contacts] All ${contactMap.size} from cache`);
    return contactMap;
  }

  console.log(`[Contacts] Fetching ${idsToFetch.length} new, ${contactMap.size} from cache`);

  for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
    const batch = idsToFetch.slice(i, i + BATCH_SIZE);

    try {
      const res = await client.get("/contacts", {
        params: { "filter[id]": batch },
        validateStatus: () => true,
      });

      if (res.status >= 200 && res.status < 300) {
        const data = res.data as { _embedded?: { contacts?: Array<{ id: number; name: string }> } };
        const contacts = data._embedded?.contacts ?? [];
        console.log(`[Contacts] Batch ${Math.floor(i / BATCH_SIZE) + 1}: got ${contacts.length} contacts`);
        
        for (const contact of contacts) {
          if (contact.id && contact.name) {
            contactMap.set(contact.id, contact.name);
            contactCache.set(contact.id, contact.name);
          }
        }
      } else {
        console.error(`[Contacts] Batch failed HTTP ${res.status}:`, JSON.stringify(res.data).slice(0, 200));
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Contacts] Batch error: ${msg}`);
    }
  }

  return contactMap;
}

async function fetchLeadsBatch(
  client: KommoClient,
  leadIds: number[]
): Promise<Map<number, string>> {
  const leadMap = new Map<number, string>();
  const idsToFetch: number[] = [];

  for (const id of leadIds) {
    if (leadCache.has(id)) {
      leadMap.set(id, leadCache.get(id)!);
    } else {
      idsToFetch.push(id);
    }
  }

  if (idsToFetch.length === 0) {
    console.log(`[Leads] All ${leadMap.size} from cache`);
    return leadMap;
  }

  console.log(`[Leads] Fetching ${idsToFetch.length} new, ${leadMap.size} from cache`);

  for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
    const batch = idsToFetch.slice(i, i + BATCH_SIZE);

    try {
      const res = await client.get("/leads", {
        params: { "filter[id]": batch },
        validateStatus: () => true,
      });

      if (res.status >= 200 && res.status < 300) {
        const data = res.data as { _embedded?: { leads?: Array<{ id: number; name: string }> } };
        const leads = data._embedded?.leads ?? [];
        console.log(`[Leads] Batch ${Math.floor(i / BATCH_SIZE) + 1}: got ${leads.length} leads`);

        for (const lead of leads) {
          if (lead.id && lead.name) {
            leadMap.set(lead.id, lead.name);
            leadCache.set(lead.id, lead.name);
          }
        }
      } else {
        console.error(`[Leads] Batch failed HTTP ${res.status}:`, JSON.stringify(res.data).slice(0, 200));
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Leads] Batch error: ${msg}`);
    }
  }

  return leadMap;
}

async function fetchTalksBatch(
  client: KommoClient,
  talkIds: number[]
): Promise<Map<number, string>> {
  const talkMap = new Map<number, string>();
  const idsToFetch: number[] = [];

  for (const id of talkIds) {
    if (talkCache.has(id)) {
      talkMap.set(id, talkCache.get(id)!);
    } else {
      idsToFetch.push(id);
    }
  }

  if (idsToFetch.length === 0) {
    console.log(`[Talks] All ${talkMap.size} from cache`);
    return talkMap;
  }

  console.log(`[Talks] Fetching ${idsToFetch.length} new, ${talkMap.size} from cache`);

  for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
    const batch = idsToFetch.slice(i, i + BATCH_SIZE);

    try {
      const res = await client.get("/talks", {
        params: { "filter[id]": batch },
        validateStatus: () => true,
      });

      if (res.status >= 200 && res.status < 300) {
        const data = res.data as { _embedded?: { talks?: Array<{ id: number; name: string }> } };
        const talks = data._embedded?.talks ?? [];
        console.log(`[Talks] Batch ${Math.floor(i / BATCH_SIZE) + 1}: got ${talks.length} talks`);

        for (const talk of talks) {
          if (talk.id && talk.name) {
            talkMap.set(talk.id, talk.name);
            talkCache.set(talk.id, talk.name);
          }
        }
      } else {
        console.error(`[Talks] Batch failed HTTP ${res.status}:`, JSON.stringify(res.data).slice(0, 200));
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Talks] Batch error: ${msg}`);
    }
  }

  return talkMap;
}

async function fetchChatEventsForInbox(
  client: KommoClient,
  page = 1
): Promise<EventResponse> {
  console.log(`Fetching chat events for inbox, page: ${page}`);
  try {
    const res = await client.get("/events", {
      params: {
        "filter[type]": CHAT_EVENT_TYPES,
        with: "contact_name,lead_name",
        limit: 250,
        page,
      },
      validateStatus: () => true,
    });
    console.log("Kommo /events (inbox) response status:", res.status);
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Kommo /events failed HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    }
    return res.data as EventResponse;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Kommo fetchChatEventsForInbox error:", msg);
    throw error;
  }
}

function extractMessageInfo(event: RawEvent): {
  id: string;
  type: "incoming" | "outgoing";
  timestamp: number;
} | null {
  const messageData = event.value_after?.[0]?.message;
  if (!messageData?.id) return null;

  const isIncoming = event.type === "incoming_chat_message";
  const isOutgoing = event.type === "outgoing_chat_message";

  if (!isIncoming && !isOutgoing) return null;

  return {
    id: messageData.id,
    type: isIncoming ? "incoming" : "outgoing",
    timestamp: event.created_at ?? 0,
  };
}

function groupEventsByConversation(events: RawEvent[]): Map<string, ConversationData> {
  const conversationMap = new Map<string, ConversationData>();

  for (const event of events) {
    const talkId = event.value_after?.[0]?.message?.talk_id ?? null;
    const entityId = event.entity_id ?? null;
    const entityType = event.entity_type ?? "lead";

    const key = talkId !== null
      ? `talk_${talkId}`
      : `entity_${entityType}_${entityId}`;

    if (!conversationMap.has(key)) {
      const entity = event._embedded?.entity;
      const contactId = entity?.linked_talk_contact_id ?? null;

      let contactName = "";
      let leadId: number | null = null;
      let leadName = "";

      if (event.type === "incoming_chat_message" || event.type === "outgoing_chat_message") {
        contactName = event.contact_name ?? "";
        leadName = event.lead_name ?? "";

        if (!contactName && !leadName) {
          const entityLink = entity?._links?.self?.href ?? "";
          if (entityLink.includes("/contacts/")) {
            contactName = entity?.name ?? "";
          } else if (entityLink.includes("/leads/")) {
            leadId = entityId;
            leadName = entity?.name ?? "";
          }
        }
      }

      conversationMap.set(key, {
        events: [],
        talkId,
        entityId,
        entityType,
        contactId,
        contactName,
        leadId,
        leadName,
        origin: event.value_after?.[0]?.message?.origin ?? "",
        createdAt: event.created_at ?? 0,
        lastMessage: null,
      });
    }

    const conv = conversationMap.get(key)!;
    conv.events.push(event);

    if (event.created_at && event.created_at > conv.createdAt) {
      conv.createdAt = event.created_at;
    }

    const msgInfo = extractMessageInfo(event);
    if (msgInfo) {
      if (!conv.lastMessage || msgInfo.timestamp > conv.lastMessage.timestamp) {
        conv.lastMessage = msgInfo;
      }
    }
  }

  return conversationMap;
}

export async function resolveNames(
  conversations: ConversationInput[],
  client: KommoClient
): Promise<{
  contactMap: Map<number, string>;
  leadMap: Map<number, string>;
  talkMap: Map<number, string>;
}> {
  const uniqueContactIds = new Set<number>();
  const uniqueLeadIds = new Set<number>();
  const uniqueTalkIds = new Set<number>();

  for (const conv of conversations) {
    if (conv.contactId !== null) {
      uniqueContactIds.add(conv.contactId);
    }
    if (conv.leadId !== null) {
      uniqueLeadIds.add(conv.leadId);
    }
    if (conv.isDirectTalk && conv.entityId !== null) {
      uniqueTalkIds.add(conv.entityId);
    }
  }

  const contactIds = Array.from(uniqueContactIds);
  const leadIds = Array.from(uniqueLeadIds);
  const talkIds = Array.from(uniqueTalkIds);

  console.log(`[resolveNames] ${contactIds.length} contacts, ${leadIds.length} leads, ${talkIds.length} direct talks to resolve`);

  const [contactMap, leadMap, talkMap] = await Promise.all([
    contactIds.length > 0 ? fetchContactsBatch(client, contactIds) : Promise.resolve(new Map<number, string>()),
    leadIds.length > 0 ? fetchLeadsBatch(client, leadIds) : Promise.resolve(new Map<number, string>()),
    talkIds.length > 0 ? fetchTalksBatch(client, talkIds) : Promise.resolve(new Map<number, string>()),
  ]);

  console.log(`[resolveNames] Resolved: ${contactMap.size} contacts, ${leadMap.size} leads, ${talkMap.size} talks`);

  return { contactMap, leadMap, talkMap };
}

function applyNames(
  conversations: InboxConversation[],
  contactMap: Map<number, string>,
  leadMap: Map<number, string>,
  talkMap: Map<number, string>
): InboxConversation[] {
  let contactResolved = 0;
  let leadResolved = 0;
  let talkResolved = 0;
  let unknown = 0;

  for (const conv of conversations) {
    if (conv.contactName && conv.contactName.trim() !== "") {
      continue;
    }

    if (conv.contactId && contactMap.has(conv.contactId)) {
      conv.contactName = contactMap.get(conv.contactId)!;
      contactResolved++;
    } else if (conv.leadId && leadMap.has(conv.leadId)) {
      conv.contactName = leadMap.get(conv.leadId)!;
      leadResolved++;
    } else if (conv.entityId && talkMap.has(conv.entityId)) {
      conv.contactName = talkMap.get(conv.entityId)!;
      talkResolved++;
    } else {
      conv.contactName = "Unknown";
      unknown++;
    }
  }

  console.log(`[applyNames] Applied: ${contactResolved} contacts, ${leadResolved} leads, ${talkResolved} talks, ${unknown} unknown`);
  return conversations;
}

export async function getInbox(page = 1): Promise<{
  success: boolean;
  conversations?: InboxConversation[];
  total?: number;
  hasMore?: boolean;
  error?: string;
}> {
  const configErr = validateConfig();
  if (configErr) return { success: false, error: configErr };

  let client: KommoClient | null = null;

  try {
    const accessToken = await getValidAccessToken(getClientId(), getClientSecret());
    client = createKommoClient(accessToken, getDomain());

    console.log(`Fetching inbox page ${page}...`);
    const eventsData = await fetchChatEventsForInbox(client, page);
    const events = eventsData._embedded?.events ?? [];

    if (events.length === 0) {
      return { success: true, conversations: [], total: 0, hasMore: false };
    }

    const hasMore = !!eventsData._links?.next;
    console.log(`Found ${events.length} events on page ${page}, hasMore: ${hasMore}`);

    const conversationMap = groupEventsByConversation(events);

    const conversations: InboxConversation[] = [];
    const conversationsInput: ConversationInput[] = [];

    for (const [, conv] of Array.from(conversationMap.entries())) {
      const conversation: InboxConversation = {
        id: conv.talkId !== null
          ? `talk_${conv.talkId}`
          : `entity_${conv.entityType}_${conv.entityId}`,
        talkId: conv.talkId,
        entityId: conv.entityId,
        entityType: conv.entityType,
        contactId: conv.contactId,
        contactName: conv.contactName || "",
        leadId: conv.leadId,
        leadName: conv.leadName,
        lastMessage: conv.lastMessage,
        totalMessages: conv.events.length,
        origin: conv.origin,
        createdAt: conv.createdAt,
        updatedAt: conv.lastMessage?.timestamp ?? conv.createdAt,
      };
      conversations.push(conversation);
      const isDirectTalk = conv.entityType === "talk" && conv.talkId === null;
      conversationsInput.push({
        talkId: conv.talkId,
        entityId: conv.entityId,
        entityType: conv.entityType,
        contactId: conv.contactId,
        leadId: conv.leadId,
        isDirectTalk,
      });
    }

    const { contactMap, leadMap, talkMap } = await resolveNames(conversationsInput, client);
    applyNames(conversations, contactMap, leadMap, talkMap);

    conversations.sort((a, b) => {
      if (a.talkId !== null && b.talkId === null) return -1;
      if (a.talkId === null && b.talkId !== null) return 1;
      return b.updatedAt - a.updatedAt;
    });

    console.log(`Returning ${conversations.length} conversations`);
    return {
      success: true,
      conversations,
      total: events.length,
      hasMore,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Get inbox error:", msg);
    return { success: false, error: msg };
  }
}
