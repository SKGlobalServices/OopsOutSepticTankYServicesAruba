/**
 * Kommo business logic: send message to lead (CRM API), process webhook payload.
 */

import { getFirestore } from "firebase-admin/firestore";
import { createKommoClient } from "./kommoClient";
import { getValidAccessToken } from "./kommoOAuth";
import { saveMessage } from "./firestoreHelpers";
import {
  resolveClienteIdRTDB,
  updateClienteKommoIdsRTDB,
} from "./rtdbHelpers";
import { normalizePhone } from "./phoneUtils";

const KOMMO_DOMAIN = process.env.KOMMO_DOMAIN ?? "";

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
      fieldCode.includes("tel") ||
      fieldCode.includes("phone");

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

/**
 * Extract all phone candidates from Kommo webhook payload (leads or contacts).
 */
export function extractPhoneCandidatesFromPayload(
  payload: Record<string, unknown>
): string[] {
  const candidates = new Set<string>();
  const sections = ["leads", "contacts"] as const;

  for (const sectionName of sections) {
    const section = payload[sectionName];
    if (!isRecord(section)) continue;

    const entries = [
      ...(Array.isArray(section.add) ? section.add : []),
      ...(Array.isArray(section.update) ? section.update : []),
    ];

    for (const entry of entries) {
      if (!isRecord(entry)) continue;
      const customFields =
        entry.custom_fields_values ?? entry.custom_fields ?? entry.custom_fields_values;
      for (const phone of collectPhoneValuesFromFields(customFields)) {
        candidates.add(phone);
      }
    }
  }

  const notes = payload.notes;
  if (isRecord(notes) && Array.isArray(notes.add)) {
    for (const entry of notes.add) {
      if (!isRecord(entry)) continue;
      const params = isRecord(entry.params) ? entry.params : undefined;
      const phone = extractStringValue(params?.phone);
      if (phone) candidates.add(phone);
    }
  }

  return Array.from(candidates);
}

/**
 * Send a text message to a lead via Kommo CRM API (add note to lead).
 * Uses POST /api/v4/leads/notes with note_type that creates a message on the lead.
 */
export async function sendMessageToLead(
  leadId: number,
  message: string,
  clientId: string,
  clientSecret: string
): Promise<{ success: boolean; noteId?: number; error?: string }> {
  const accessToken = await getValidAccessToken(clientId, clientSecret);
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
    const firestore = getFirestore();
    const clienteId = await resolveClienteIdRTDB({ kommo_lead_id: leadId });
    await saveMessage(firestore, {
      clienteId,
      text: message,
      direction: "outbound",
      lead_id: leadId,
    });

    return { success: true, noteId };
  } catch (err: unknown) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Extract phone from Kommo webhook payload (leads or contacts).
 */
export function extractPhoneFromPayload(payload: Record<string, unknown>): string | undefined {
  return extractPhoneCandidatesFromPayload(payload)[0];
}

/**
 * Extract lead_id and contact id from webhook payload.
 */
export function extractIdsFromPayload(payload: Record<string, unknown>): {
  lead_id?: number;
  contact_id?: string;
} {
  const out: { lead_id?: number; contact_id?: string } = {};
  const leads = payload.leads as Record<string, unknown> | undefined;
  if (leads) {
    const add = (leads.add as unknown[])?.[0] as Record<string, unknown> | undefined;
    const upd = (leads.update as unknown[])?.[0] as Record<string, unknown> | undefined;
    const item = add ?? upd;
    if (item?.id) out.lead_id = Number(item.id);
  }
  const contacts = payload.contacts as Record<string, unknown> | undefined;
  if (contacts) {
    const add = (contacts.add as unknown[])?.[0] as Record<string, unknown> | undefined;
    const upd = (contacts.update as unknown[])?.[0] as Record<string, unknown> | undefined;
    const item = add ?? upd;
    if (item?.id) out.contact_id = String(item.id);
  }
  const notes = payload.notes as Record<string, unknown> | undefined;
  if (notes?.add) {
    const add = (notes.add as unknown[])?.[0] as Record<string, unknown> | undefined;
    if (add?.entity_id) out.lead_id = Number(add.entity_id);
  }
  return out;
}

/**
 * Extract message text from webhook (e.g. from notes.add).
 */
export function extractMessageTextFromPayload(
  payload: Record<string, unknown>
): string | undefined {
  const notes = payload.notes as Record<string, unknown> | undefined;
  if (notes?.add) {
    const add = (notes.add as unknown[])?.[0] as Record<string, unknown> | undefined;
    const params = add?.params as Record<string, unknown> | undefined;
    if (params?.text) return params.text as string;
  }
  return undefined;
}

/**
 * Process webhook payload asynchronously: normalize phone, find client, save message, optionally link Kommo IDs.
 */
export async function processWebhookAsync(
  payload: Record<string, unknown>
): Promise<void> {
  const firestore = getFirestore();
  const phoneCandidates = extractPhoneCandidatesFromPayload(payload);
  const phoneNormalizedCandidates = phoneCandidates
    .map((phone) => normalizePhone(phone))
    .filter((phone) => Boolean(phone));
  const { lead_id, contact_id } = extractIdsFromPayload(payload);

  let clienteId = await resolveClienteIdRTDB({
    kommo_contact_id: contact_id,
    kommo_lead_id: lead_id,
  });

  if (!clienteId) {
    for (const phone of phoneNormalizedCandidates) {
      const resolved = await resolveClienteIdRTDB({ phone });
      if (resolved) {
        clienteId = resolved;
        break;
      }
    }
  }

  const text = extractMessageTextFromPayload(payload);
  if (text) {
    await saveMessage(firestore, {
      clienteId,
      phoneNormalized: phoneNormalizedCandidates[0],
      text,
      direction: "inbound",
      kommo_message_id: undefined,
      lead_id,
    });
  }

  if (clienteId && (contact_id || lead_id != null)) {
    await updateClienteKommoIdsRTDB(clienteId, {
      ...(contact_id && { kommo_contact_id: contact_id }),
      ...(lead_id != null && { kommo_lead_id: lead_id }),
    });
  }
}
