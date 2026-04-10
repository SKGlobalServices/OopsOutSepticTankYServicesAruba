const KOMMO_GET_CHATS_URL =
  process.env.REACT_APP_KOMMO_GET_CHATS_URL ||
  `https://us-central1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/kommoGetChats`;

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
