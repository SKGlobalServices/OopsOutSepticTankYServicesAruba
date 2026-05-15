const BASE_URL = `https://us-central1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net`;

const KOMMO_GET_CHATS_URL =
  process.env.REACT_APP_KOMMO_GET_CHATS_URL || `${BASE_URL}/kommoGetChats`;

const KOMMO_GET_INBOX_URL =
  process.env.REACT_APP_KOMMO_GET_INBOX_URL || `${BASE_URL}/kommoGetInbox`;

const KOMMO_GET_MESSAGES_URL =
  process.env.REACT_APP_KOMMO_GET_MESSAGES_URL || `${BASE_URL}/kommoGetMessages`;

const EVENT_TYPE_LABELS = {
  incoming_chat_message: "Incoming message",
  outgoing_chat_message: "Outgoing message",
  talk_created: "Conversation started",
  talk_closed: "Conversation closed",
};

export function formatTimestamp(ts) {
  if (typeof ts !== "number" || !isFinite(ts)) return "—";
  return new Date(ts * 1000).toLocaleString();
}

export function normalizeEvents(rawPayload) {
  const list = rawPayload?.events?._embedded?.events ?? [];
  return list.map((ev) => ({
    id: ev.id ?? null,
    type: ev.type ?? "",
    typeLabel: EVENT_TYPE_LABELS[ev.type] || ev.type,
    entityId: ev.entity_id ?? null,
    entityType: ev.entity_type ?? "",
    createdAt: ev.created_at ?? null,
    leadName: ev.lead_name ?? "",
    talkId: ev.talk_id ?? null,
    messageId: ev.message_id ?? null,
    origin: ev.origin ?? "",
    contactId: ev.contact_id ?? null,
    entityLink: ev._embedded?.entity?._links?.self?.href ?? "",
  }));
}

export function groupByConversation(events) {
  const map = new Map();
  for (const ev of events) {
    const key = ev.talkId ?? `entity-${ev.entityId}`;
    const existing = map.get(key);
    if (!existing || ev.createdAt > existing.latestEvent.createdAt) {
      map.set(key, {
        talkId: ev.talkId,
        entityId: ev.entityId,
        entityType: ev.entityType,
        leadName: ev.leadName || existing?.leadName || "",
        origin: ev.origin || existing?.origin || "",
        contactId: ev.contactId || existing?.contactId || null,
        entityLink: ev.entityLink || existing?.entityLink || "",
        latestEvent: ev,
        eventCount: (existing?.eventCount ?? 0) + 1,
        incomingCount:
          (existing?.incomingCount ?? 0) +
          (ev.type === "incoming_chat_message" ? 1 : 0),
        outgoingCount:
          (existing?.outgoingCount ?? 0) +
          (ev.type === "outgoing_chat_message" ? 1 : 0),
      });
    } else {
      existing.eventCount += 1;
      if (ev.type === "incoming_chat_message") existing.incomingCount += 1;
      if (ev.type === "outgoing_chat_message") existing.outgoingCount += 1;
      if (!existing.leadName && ev.leadName) existing.leadName = ev.leadName;
      if (!existing.origin && ev.origin) existing.origin = ev.origin;
      if (!existing.entityLink && ev.entityLink) existing.entityLink = ev.entityLink;
    }
  }
  return [...map.values()].sort(
    (a, b) => (b.latestEvent.createdAt ?? 0) - (a.latestEvent.createdAt ?? 0)
  );
}

/** Note types that represent actual chat/message content */
const CHAT_NOTE_TYPES = new Set([
  "service_message",
  "extended_service_message",
  "common",
  "sms_in",
  "sms_out",
  "call_in",
  "call_out",
]);

/** Map a raw note from the backend into a normalized message object */
export function normalizeNote(note) {
  const isIncoming =
    note.noteType === "sms_in" ||
    note.noteType === "call_in" ||
    (note.createdBy === 0 &&
      (note.noteType === "service_message" ||
        note.noteType === "extended_service_message"));

  const isOutgoing =
    note.noteType === "sms_out" ||
    note.noteType === "call_out" ||
    (note.createdBy !== 0 &&
      (note.noteType === "service_message" ||
        note.noteType === "extended_service_message"));

  return {
    id: note.id,
    entityId: note.entityId,
    createdAt: note.createdAt,
    noteType: note.noteType,
    text: note.text ?? note.params?.text ?? null,
    service: note.service ?? note.params?.service ?? null,
    phone: note.phone ?? note.params?.phone ?? null,
    direction: isIncoming ? "in" : isOutgoing ? "out" : "note",
    isChatMessage:
      note.noteType === "service_message" ||
      note.noteType === "extended_service_message",
    isRelevant: CHAT_NOTE_TYPES.has(note.noteType),
  };
}

export async function fetchMessages(entityId, page = 1) {
  const url = `${KOMMO_GET_MESSAGES_URL}?entityId=${entityId}&page=${page}`;
  console.log("[kommoChatService] Fetching messages from", url);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch messages`);
  }

  const data = await response.json();
  if (data.success === false) {
    throw new Error(data.error || "Kommo API returned an error");
  }

  const items = (data.notes?.items ?? []).map(normalizeNote);
  console.log("[kommoChatService] Fetched", items.length, "notes for entity", entityId);
  return { items, hasMore: data.notes?.hasMore ?? false };
}

export async function fetchChats(page = 1) {
  const url = page > 1 ? `${KOMMO_GET_CHATS_URL}?page=${page}` : KOMMO_GET_CHATS_URL;
  console.log("[kommoChatService] Fetching chat events from", url);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch chat events`);
  }

  const data = await response.json();

  if (data.success === false) {
    throw new Error(data.error || "Kommo API returned an error");
  }

  const events = normalizeEvents(data);
  console.log("[kommoChatService] Fetched", events.length, "chat events");
  return events;
}

function normalizeConversation(raw) {
  return {
    id: raw.talkId ?? raw.contactId,
    talkId: raw.talkId ?? null,
    chatId: raw.chatId ?? null,
    contactId: raw.contactId,
    contactName: raw.contactName || "Unknown",
    leadId: raw.leadId ?? null,
    leadName: raw.leadName || "",
    origin: raw.origin || "",
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    isInWork: raw.isInWork ?? true,
    unreadCount: raw.unreadCount ?? 0,
    lastMessage: raw.lastMessage ?? null,
  };
}

export async function fetchConversations(page = 1) {
  const url = `${KOMMO_GET_CHATS_URL}?page=${page}`;
  console.log("[kommoChatService] Fetching conversations from", url);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch conversations`);
  }

  const data = await response.json();

  if (data.success === false) {
    throw new Error(data.error || "Kommo API returned an error");
  }

  const conversations = (data.conversations || []).map(normalizeConversation);
  console.log("[kommoChatService] Fetched", conversations.length, "conversations");

  return {
    conversations,
    total: data.total || 0,
    page: data.page || page,
    hasMore: data.hasMore || false,
  };
}

function normalizeInboxConversation(raw) {
  return {
    id: raw.id,
    talkId: raw.talkId,
    entityId: raw.entityId,
    entityType: raw.entityType || "lead",
    contactId: raw.contactId,
    contactName: raw.contactName || "Unknown",
    leadId: raw.leadId,
    leadName: raw.leadName || "",
    origin: raw.origin || "",
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    lastMessage: raw.lastMessage,
    totalMessages: raw.totalMessages || 0,
  };
}

export async function fetchInbox(page = 1) {
  const url = `${KOMMO_GET_INBOX_URL}?page=${page}`;
  console.log("[kommoChatService] Fetching inbox from", url);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch inbox`);
  }

  const data = await response.json();

  if (data.success === false) {
    throw new Error(data.error || "Kommo API returned an error");
  }

  const conversations = (data.conversations || []).map(normalizeInboxConversation);
  console.log("[kommoChatService] Fetched", conversations.length, "inbox conversations");

  return {
    conversations,
    total: data.total || 0,
    page: data.page || page,
    hasMore: data.hasMore || false,
  };
}
