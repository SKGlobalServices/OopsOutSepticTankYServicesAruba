/**
 * Chat inbox endpoint for Kommo V1.
 * Fetches conversations using the proper Kommo API:
 * - GET /api/v4/contacts - List contacts
 * - GET /api/v4/contacts/chats - Get chats per contact
 * - GET /api/v4/talks/{id} - Get talk details
 */

import { createKommoClient } from "./client";
import { getValidAccessToken } from "./tokenManager";
import { fetchContacts, fetchContactChats, fetchTalkDetails, delay } from "./services";

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

interface ContactResponse {
  _page?: number;
  _total?: number;
  _links?: { self?: { href?: string }; next?: { href?: string } };
  _embedded?: {
    contacts?: Contact[];
  };
}

interface Contact {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  _embedded?: {
    leads?: Array<{ id: number; name?: string }>;
  };
}

interface ChatsResponse {
  _total_items?: number;
  _embedded?: {
    chats?: Array<{
      id?: number;
      chat_id?: string;
      contact_id?: number;
    }>;
  };
}

interface TalkResponse {
  talk_id?: number;
  chat_id?: string;
  contact_id?: number;
  entity_id?: number | null;
  origin?: string;
  created_at?: number;
  updated_at?: number;
  is_in_work?: boolean;
  unread_count?: number;
  _embedded?: {
    contacts?: Array<{
      id?: number;
      name?: string;
    }>;
  };
}

interface Conversation {
  talkId: number | null;
  chatId: string | null;
  contactId: number;
  contactName: string;
  leadId: number | null;
  leadName: string;
  origin: string;
  createdAt: number | null;
  updatedAt: number | null;
  isInWork: boolean;
  unreadCount: number;
  lastMessage: {
    text: string | null;
    timestamp: number | null;
    direction: "in" | "out" | null;
  } | null;
}

const RATE_LIMIT_DELAY_MS = 50;
const BATCH_SIZE = 50;
const MAX_CONTACTS_PER_PAGE = 100;

export async function getChats(page = 1): Promise<{
  success: boolean;
  conversations?: Conversation[];
  total?: number;
  hasMore?: boolean;
  error?: string;
}> {
  const configErr = validateConfig();
  if (configErr) return { success: false, error: configErr };

  try {
    const accessToken = await getValidAccessToken(getClientId(), getClientSecret());
    const client = createKommoClient(accessToken, getDomain());

    console.log(`Fetching contacts page ${page}...`);
    const contactsData = (await fetchContacts(client, page, MAX_CONTACTS_PER_PAGE)) as ContactResponse;
    const contacts = contactsData._embedded?.contacts ?? [];

    if (contacts.length === 0) {
      return { success: true, conversations: [], total: 0, hasMore: false };
    }

    const totalContacts = contactsData._total ?? contacts.length;
    const hasMore = !!contactsData._links?.next;

    console.log(`Found ${contacts.length} contacts on page ${page}, total: ${totalContacts}`);

    const conversations: Conversation[] = [];
    const talkIdsToFetch: number[] = [];

    const contactsWithLeads = contacts.filter(c => c._embedded?.leads?.length);
    const contactsWithoutLeads = contacts.filter(c => !c._embedded?.leads?.length);

    console.log(`Contacts with leads: ${contactsWithLeads.length}, without: ${contactsWithoutLeads.length}`);

    for (const contact of contactsWithoutLeads) {
      const contactId = contact.id;
      const contactName = contact.name ?? (`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Unknown");

      conversations.push({
        talkId: null,
        chatId: null,
        contactId,
        contactName,
        leadId: null,
        leadName: "",
        origin: "",
        createdAt: null,
        updatedAt: null,
        isInWork: false,
        unreadCount: 0,
        lastMessage: null,
      });
    }

    const fetchChatsForContact = async (contact: Contact) => {
      const contactId = contact.id;
      const contactName = contact.name ?? (`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Unknown");
      const lead = contact._embedded?.leads?.[0];
      const leadId = lead?.id ?? null;
      const leadName = lead?.name ?? "";

      try {
        await delay(RATE_LIMIT_DELAY_MS);
        const chatsData = (await fetchContactChats(client, contactId)) as ChatsResponse;
        const chats = chatsData._embedded?.chats ?? [];

        if (chats.length === 0) {
          return [{
            talkId: null,
            chatId: null,
            contactId,
            contactName,
            leadId,
            leadName,
            origin: "",
            createdAt: null,
            updatedAt: null,
            isInWork: false,
            unreadCount: 0,
            lastMessage: null,
          }];
        }

        const result = chats.map(chat => {
          const talkId = chat.id ?? null;
          const chatId = chat.chat_id ?? null;

          if (talkId !== null && !talkIdsToFetch.includes(talkId)) {
            talkIdsToFetch.push(talkId);
          }

          return {
            talkId,
            chatId,
            contactId,
            contactName,
            leadId,
            leadName,
            origin: "",
            createdAt: null,
            updatedAt: null,
            isInWork: false,
            unreadCount: 0,
            lastMessage: null,
          };
        });

        return result;
      } catch (chatErr) {
        console.warn(`Failed to fetch chats for contact ${contactId}:`, chatErr);
        return [{
          talkId: null,
          chatId: null,
          contactId,
          contactName,
          leadId,
          leadName,
          origin: "",
          createdAt: null,
          updatedAt: null,
          isInWork: false,
          unreadCount: 0,
          lastMessage: null,
        }];
      }
    };

    const CONCURRENCY = 5;
    for (let i = 0; i < contactsWithLeads.length; i += CONCURRENCY) {
      const batch = contactsWithLeads.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(fetchChatsForContact));
      for (const result of results) {
        conversations.push(...result);
      }
      console.log(`Processed ${Math.min(i + CONCURRENCY, contactsWithLeads.length)}/${contactsWithLeads.length} contacts with leads`);
    }

    console.log(`Collected ${talkIdsToFetch.length} unique talk IDs to enrich`);

    const talkDetailsMap = new Map<number, TalkResponse>();

    for (let i = 0; i < talkIdsToFetch.length; i += BATCH_SIZE) {
      const batch = talkIdsToFetch.slice(i, i + BATCH_SIZE);
      console.log(`Fetching talk details batch ${Math.floor(i / BATCH_SIZE) + 1}, talk IDs: ${batch.length}`);

      const fetchTalk = async (talkId: number) => {
        await delay(RATE_LIMIT_DELAY_MS);
        try {
          const talkData = (await fetchTalkDetails(client, talkId)) as TalkResponse | null;
          if (talkData) {
            talkDetailsMap.set(talkId, talkData);
          }
        } catch (talkErr) {
          console.warn(`Failed to fetch talk ${talkId}:`, talkErr);
        }
      };

      const talkBatch = [];
      for (const talkId of batch) {
        talkBatch.push(fetchTalk(talkId));
      }
      await Promise.all(talkBatch);
    }

    for (const convo of conversations) {
      if (convo.talkId !== null) {
        const talkData = talkDetailsMap.get(convo.talkId);
        if (talkData) {
          convo.origin = talkData.origin ?? "";
          convo.createdAt = talkData.created_at ?? null;
          convo.updatedAt = talkData.updated_at ?? null;
          convo.isInWork = talkData.is_in_work ?? false;
          convo.unreadCount = talkData.unread_count ?? 0;
        }
      }
    }

    conversations.sort((a, b) => {
      const aTime = a.updatedAt ?? a.createdAt ?? 0;
      const bTime = b.updatedAt ?? b.createdAt ?? 0;
      const aActive = a.isInWork ? 1 : 0;
      const bActive = b.isInWork ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      if (aTime === 0 && bTime === 0) return 0;
      if (aTime === 0) return 1;
      if (bTime === 0) return -1;
      return bTime - aTime;
    });

    console.log(`Returning ${conversations.length} conversations, hasMore: ${hasMore}`);
    return {
      success: true,
      conversations,
      total: totalContacts,
      hasMore,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Get chats error:", msg);
    return { success: false, error: msg };
  }
}
