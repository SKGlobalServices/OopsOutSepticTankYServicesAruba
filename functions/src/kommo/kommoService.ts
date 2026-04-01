/**
 * Kommo business logic: send real WhatsApp/channel messages (Amojo), optional CRM note fallback, webhook processing.
 */

import * as crypto from "crypto";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { createKommoClient } from "./kommoClient";
import { getValidAccessToken } from "./kommoOAuth";
import {
  isWebhookDuplicate,
  recordWebhookProcessed,
  saveMessage,
} from "./firestoreHelpers";
import {
  resolveClienteIdRTDB,
  updateClienteKommoIdsRTDB,
} from "./rtdbHelpers";
import { normalizePhone, phoneMatchCandidates } from "./phoneUtils";
import { postAmojoNewMessage } from "./amojoClient";
import {
  conversationIdFromTalk,
  findTalksForLead,
  getTalkById,
} from "./kommoTalks";

const KOMMO_DOMAIN = process.env.KOMMO_DOMAIN ?? "";

export type SendKommoOutboundInput = {
  message: string;
  leadId?: number;
  talkId?: number;
  conversationId?: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractStringValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

function collectPhoneValuesFromFields(fields: unknown): string[] {
  if (!Array.isArray(fields)) return [];

  const phones: string[] = [];
  for (const field of fields) {
    if (!isRecord(field)) continue;

    const fieldName = extractStringValue(field.name)?.toLowerCase() ?? "";
    const fieldLabel = extractStringValue(field.field_name)?.toLowerCase() ?? "";
    const fieldCode = extractStringValue(field.field_code)?.toLowerCase() ?? "";
    const isPhoneField =
      fieldName.includes("phone") ||
      fieldName.includes("tel") ||
      fieldName.includes("telefono") ||
      fieldLabel.includes("phone") ||
      fieldLabel.includes("tel") ||
      fieldLabel.includes("telefono") ||
      fieldCode.includes("phone") ||
      fieldCode.includes("tel");

    if (!isPhoneField) continue;

    const values = Array.isArray(field.values) ? field.values : [];
    for (const valueEntry of values) {
      if (!isRecord(valueEntry)) continue;
      const value = extractStringValue(valueEntry.value);
      if (value) phones.push(value);
    }
  }

  return phones;
}

/** Flatten Chats-style sections: messages.add / update */
function chatSectionEntries(payload: Record<string, unknown>, key: string): unknown[] {
  const section = payload[key];
  if (!isRecord(section)) return [];
  return [
    ...(Array.isArray(section.add) ? section.add : []),
    ...(Array.isArray(section.update) ? section.update : []),
  ];
}

function unwrapNestedPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const inner = payload.payload ?? payload.content ?? payload.data;
  if (isRecord(inner) && (inner.leads ?? inner.contacts ?? inner.notes ?? inner.messages)) {
    return inner;
  }
  return payload;
}

/**
 * Extract all phone candidates from Kommo webhook (CRM + Chats shapes).
 */
export function extractPhoneCandidatesFromPayload(
  payload: Record<string, unknown>
): string[] {
  const root = unwrapNestedPayload(payload);
  const candidates = new Set<string>();
  const sections = ["leads", "contacts"] as const;

  for (const sectionName of sections) {
    const section = root[sectionName];
    if (!isRecord(section)) continue;

    const entries = [
      ...(Array.isArray(section.add) ? section.add : []),
      ...(Array.isArray(section.update) ? section.update : []),
    ];

    for (const entry of entries) {
      if (!isRecord(entry)) continue;
      const customFields =
        entry.custom_fields_values ?? entry.custom_fields;
      for (const phone of collectPhoneValuesFromFields(customFields)) {
        candidates.add(phone);
      }
      const direct =
        extractStringValue(entry.phone) ??
        extractStringValue(entry.client_phone) ??
        extractStringValue(entry.sender_phone);
      if (direct) candidates.add(direct);
    }
  }

  const notes = root.notes;
  if (isRecord(notes) && Array.isArray(notes.add)) {
    for (const entry of notes.add) {
      if (!isRecord(entry)) continue;
      const params = isRecord(entry.params) ? entry.params : undefined;
      const phone = extractStringValue(params?.phone);
      if (phone) candidates.add(phone);
    }
  }

  for (const entry of chatSectionEntries(root, "messages")) {
    if (!isRecord(entry)) continue;
    const phone =
      extractStringValue(entry.phone) ??
      extractStringValue(entry.client_phone) ??
      extractStringValue(entry.sender_phone);
    if (phone) candidates.add(phone);
    const sender = entry.sender;
    if (isRecord(sender)) {
      const sp = extractStringValue(sender.phone);
      if (sp) candidates.add(sp);
    }
  }

  return Array.from(candidates);
}

function textFromChatEntry(entry: Record<string, unknown>): string | undefined {
  if (typeof entry.text === "string" && entry.text.trim() !== "") return entry.text;
  const message = entry.message;
  if (isRecord(message)) {
    if (typeof message.text === "string") return message.text;
    const content = message.content;
    if (typeof content === "string") return content;
  }
  return undefined;
}

function messageIdFromChatEntry(entry: Record<string, unknown>): string | undefined {
  return (
    extractStringValue(entry.msgid) ??
    extractStringValue(entry.message_id) ??
    extractStringValue(entry.id) ??
    extractStringValue(entry.uuid)
  );
}

/**
 * Dedup key for inbound messages (prefer stable Kommo / Amojo ids).
 */
export function extractWebhookDedupKey(payload: Record<string, unknown>): string {
  const root = unwrapNestedPayload(payload);
  for (const entry of chatSectionEntries(root, "messages")) {
    if (!isRecord(entry)) continue;
    const mid = messageIdFromChatEntry(entry);
    if (mid) return `msg:${mid}`;
  }
  const notes = root.notes;
  if (isRecord(notes) && Array.isArray(notes.add)) {
    const first = notes.add[0];
    if (isRecord(first) && first.id != null) {
      return `note:${first.id}`;
    }
  }
  return `hash:${crypto.createHash("sha256").update(JSON.stringify(root)).digest("hex")}`;
}

async function resolveConversationId(
  accessToken: string,
  input: SendKommoOutboundInput
): Promise<{ conversationId: string; talkId?: number } | { error: string }> {
  if (input.conversationId && input.conversationId.trim() !== "") {
    return { conversationId: input.conversationId.trim(), talkId: input.talkId };
  }

  const api = createKommoClient(accessToken, KOMMO_DOMAIN);

  if (input.talkId != null) {
    const talk = await getTalkById(api, input.talkId);
    if (!talk) {
      return { error: `Talk ${input.talkId} not found in Kommo` };
    }
    const cid = conversationIdFromTalk(talk);
    if (!cid) {
      return { error: "Could not derive conversation_id from talk" };
    }
    return { conversationId: cid, talkId: input.talkId };
  }

  if (input.leadId != null) {
    const talks = await findTalksForLead(api, input.leadId);
    for (const t of talks) {
      const cid = conversationIdFromTalk(t);
      if (cid) {
        return { conversationId: cid, talkId: typeof t.id === "number" ? t.id : undefined };
      }
    }
    return {
      error:
        "No open talk/conversation for this lead. Open a WhatsApp chat in Kommo for the lead first, or pass talkId / conversationId.",
    };
  }

  return { error: "Provide leadId, talkId, or conversationId" };
}

/**
 * Send outbound: Amojo Chats API (real WhatsApp/channel) when configured; optional CRM note fallback.
 */
export async function sendKommoOutboundMessage(
  input: SendKommoOutboundInput,
  clientId: string,
  clientSecret: string
): Promise<{
  success: boolean;
  delivery?: "amojo" | "crm_note";
  noteId?: number;
  amojoStatus?: number;
  error?: string;
}> {
  const channelSecret = process.env.KOMMO_CHANNEL_SECRET ?? "";
  const scopeId = process.env.KOMMO_SCOPE_ID ?? "";
  const accountId = process.env.KOMMO_AMOJO_ACCOUNT_ID ?? "";
  const senderId = process.env.KOMMO_AMOJO_SENDER_ID ?? "integration";
  const senderName = process.env.KOMMO_AMOJO_SENDER_NAME ?? "Oops";
  const fallbackNotes = process.env.KOMMO_SEND_FALLBACK_NOTES === "true";

  const accessToken = await getValidAccessToken(clientId, clientSecret);
  const firestore = getFirestore();
  const clienteId =
    input.leadId != null
      ? await resolveClienteIdRTDB({ kommo_lead_id: input.leadId })
      : null;

  const amojoReady =
    channelSecret !== "" && scopeId !== "" && accountId !== "";

  if (amojoReady) {
    const resolved = await resolveConversationId(accessToken, input);
    if ("error" in resolved) {
      if (fallbackNotes && input.leadId != null) {
        return sendCrmNoteFallback(input.leadId, input.message, accessToken, firestore, clienteId);
      }
      return { success: false, error: resolved.error };
    }

    const msgid = crypto.randomUUID();
    const now = Date.now();
    const body = {
      event_type: "new_message" as const,
      payload: {
        timestamp: Math.floor(now / 1000),
        msec_timestamp: now,
        msgid,
        conversation_id: resolved.conversationId,
        silent: false,
        sender: {
          id: senderId,
          name: senderName,
        },
        message: {
          type: "text" as const,
          text: input.message,
        },
      },
      account_id: accountId,
    };

    const { status, data } = await postAmojoNewMessage({
      scopeId,
      channelSecret,
      accountId,
      body,
    });

    if (status >= 200 && status < 300) {
      await saveMessage(firestore, {
        clienteId,
        text: input.message,
        direction: "outbound",
        lead_id: input.leadId,
        talk_id: resolved.talkId,
        conversation_id: resolved.conversationId,
        channel: "whatsapp",
        delivery: "amojo",
        kommo_message_id: msgid,
        meta: { amojoResponse: data },
      });
      return { success: true, delivery: "amojo", amojoStatus: status };
    }

    const errDetail =
      typeof data === "object" && data !== null && "detail" in data
        ? JSON.stringify(data)
        : String(data);
    if (fallbackNotes && input.leadId != null) {
      const fb = await sendCrmNoteFallback(
        input.leadId,
        `[Amojo ${status}] ${input.message}`,
        accessToken,
        firestore,
        clienteId
      );
      if (fb.success) {
        return {
          success: true,
          delivery: "crm_note",
          noteId: fb.noteId,
          error: `Amojo failed (${status}): ${errDetail}. Logged as CRM note.`,
        };
      }
    }
    return {
      success: false,
      error: `Amojo send failed HTTP ${status}: ${errDetail}`,
      amojoStatus: status,
    };
  }

  if (fallbackNotes && input.leadId != null) {
    return sendCrmNoteFallback(input.leadId, input.message, accessToken, firestore, clienteId);
  }

  return {
    success: false,
    error:
      "Chats API not configured. Set KOMMO_CHANNEL_SECRET, KOMMO_SCOPE_ID, KOMMO_AMOJO_ACCOUNT_ID (from Kommo channel connection), or set KOMMO_SEND_FALLBACK_NOTES=true for CRM notes only.",
  };
}

async function sendCrmNoteFallback(
  leadId: number,
  message: string,
  accessToken: string,
  firestore: Firestore,
  clienteId: string | null
): Promise<{ success: boolean; noteId?: number; error?: string }> {
  const client = createKommoClient(accessToken, KOMMO_DOMAIN);
  try {
    const res = await client.post("/leads/notes", [
      {
        entity_id: leadId,
        note_type: "common",
        params: {
          text: message,
        },
      },
    ]);
    const noteId = res.data?._embedded?.notes?.[0]?.id;
    await saveMessage(firestore, {
      clienteId,
      text: message,
      direction: "outbound",
      lead_id: leadId,
      delivery: "crm_note",
    });
    return { success: true, noteId };
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Unknown error";
    return { success: false, error: msg };
  }
}

/** @deprecated Use sendKommoOutboundMessage — kept for tests */
export async function sendMessageToLead(
  leadId: number,
  message: string,
  clientId: string,
  clientSecret: string
): Promise<{ success: boolean; noteId?: number; error?: string }> {
  const r = await sendKommoOutboundMessage(
    { leadId, message },
    clientId,
    clientSecret
  );
  return {
    success: r.success,
    noteId: r.noteId,
    error: r.error,
  };
}

export function extractPhoneFromPayload(payload: Record<string, unknown>): string | undefined {
  return extractPhoneCandidatesFromPayload(payload)[0];
}

export function extractIdsFromPayload(payload: Record<string, unknown>): {
  lead_id?: number;
  contact_id?: string;
  talk_id?: number;
  conversation_id?: string;
} {
  const root = unwrapNestedPayload(payload);
  const out: {
    lead_id?: number;
    contact_id?: string;
    talk_id?: number;
    conversation_id?: string;
  } = {};

  const leads = root.leads as Record<string, unknown> | undefined;
  if (leads) {
    const add = (leads.add as unknown[])?.[0] as Record<string, unknown> | undefined;
    const upd = (leads.update as unknown[])?.[0] as Record<string, unknown> | undefined;
    const item = add ?? upd;
    if (item?.id) out.lead_id = Number(item.id);
  }
  const contacts = root.contacts as Record<string, unknown> | undefined;
  if (contacts) {
    const add = (contacts.add as unknown[])?.[0] as Record<string, unknown> | undefined;
    const upd = (contacts.update as unknown[])?.[0] as Record<string, unknown> | undefined;
    const item = add ?? upd;
    if (item?.id) out.contact_id = String(item.id);
  }
  const notes = root.notes as Record<string, unknown> | undefined;
  if (notes?.add) {
    const add = (notes.add as unknown[])?.[0] as Record<string, unknown> | undefined;
    if (add?.entity_id) out.lead_id = Number(add.entity_id);
  }

  for (const entry of chatSectionEntries(root, "messages")) {
    if (!isRecord(entry)) continue;
    const lid =
      extractStringValue(entry.lead_id) ??
      extractStringValue(entry.entity_id) ??
      extractStringValue(entry.entityId);
    if (lid && !Number.isNaN(Number(lid))) out.lead_id = Number(lid);
    const cid =
      extractStringValue(entry.contact_id) ??
      extractStringValue(entry.contactId);
    if (cid) out.contact_id = cid;
    const conv =
      extractStringValue(entry.conversation_id) ??
      extractStringValue(entry.conversationId) ??
      extractStringValue(entry.chat_id);
    if (conv) out.conversation_id = conv;
    const tid = entry.talk_id ?? entry.talkId;
    if (typeof tid === "number") out.talk_id = tid;
    else if (typeof tid === "string" && !Number.isNaN(Number(tid))) {
      out.talk_id = Number(tid);
    }
  }

  return out;
}

export function extractMessageTextFromPayload(
  payload: Record<string, unknown>
): string | undefined {
  const root = unwrapNestedPayload(payload);
  const notes = root.notes as Record<string, unknown> | undefined;
  if (notes?.add) {
    const add = (notes.add as unknown[])?.[0] as Record<string, unknown> | undefined;
    const params = add?.params as Record<string, unknown> | undefined;
    if (params?.text) return params.text as string;
  }

  for (const entry of chatSectionEntries(root, "messages")) {
    if (!isRecord(entry)) continue;
    const t = textFromChatEntry(entry);
    if (t) return t;
  }
  return undefined;
}

export function extractInboundMeta(payload: Record<string, unknown>): {
  kommo_message_id?: string;
  channel?: string;
} {
  const root = unwrapNestedPayload(payload);
  for (const entry of chatSectionEntries(root, "messages")) {
    if (!isRecord(entry)) continue;
    const mid = messageIdFromChatEntry(entry);
    const src = entry.source;
    const channel =
      extractStringValue(entry.messenger_type) ??
      extractStringValue(entry.channel) ??
      (isRecord(src) ? extractStringValue(src.type) : undefined);
    if (mid || channel) {
      return { kommo_message_id: mid, channel: channel ?? undefined };
    }
  }
  return {};
}

const DEFAULT_CC = process.env.KOMMO_DEFAULT_COUNTRY_CODE ?? "297";

export async function processWebhookAsync(
  payload: Record<string, unknown>
): Promise<void> {
  const firestore = getFirestore();
  const phoneCandidates = extractPhoneCandidatesFromPayload(payload);
  const phoneNormalizedCandidates = phoneCandidates.flatMap((p) =>
    phoneMatchCandidates(p, DEFAULT_CC)
  );
  const uniquePhones = Array.from(new Set(phoneNormalizedCandidates.filter(Boolean)));
  const primaryPhone = uniquePhones[0] ?? normalizePhone(phoneCandidates[0] ?? "");

  const { lead_id, contact_id, talk_id, conversation_id } = extractIdsFromPayload(payload);
  const { kommo_message_id, channel } = extractInboundMeta(payload);

  let clienteId = await resolveClienteIdRTDB({
    kommo_contact_id: contact_id,
    kommo_lead_id: lead_id,
  });

  if (!clienteId) {
    for (const phone of uniquePhones) {
      const resolved = await resolveClienteIdRTDB({ phone });
      if (resolved) {
        clienteId = resolved;
        break;
      }
    }
  }

  if (clienteId && (contact_id || lead_id != null)) {
    await updateClienteKommoIdsRTDB(clienteId, {
      ...(contact_id && { kommo_contact_id: contact_id }),
      ...(lead_id != null && { kommo_lead_id: lead_id }),
    });
  }

  const text = extractMessageTextFromPayload(payload);
  if (text) {
    const dedupKey = extractWebhookDedupKey(payload);
    if (await isWebhookDuplicate(firestore, dedupKey)) {
      return;
    }
    await saveMessage(firestore, {
      clienteId,
      phoneNormalized: primaryPhone || undefined,
      text,
      direction: "inbound",
      kommo_message_id,
      lead_id,
      talk_id,
      conversation_id,
      channel,
      delivery: "unknown",
      meta: { dedupKeyPreview: dedupKey.slice(0, 120) },
    });
    await recordWebhookProcessed(firestore, dedupKey, {
      lead_id,
      contact_id,
      inbound: true,
    });
  }
}
