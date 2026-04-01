/**
 * Firestore helpers for Kommo integration (messages and tokens only).
 * Clientes are stored in Realtime DB; use rtdbHelpers for client lookup/update.
 */

import { Firestore, Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";

const KOMMO_MESSAGES_COLLECTION = "kommo_messages";
const MESSAGES_SUBCOLLECTION = "messages";
const KOMMO_WEBHOOK_DEDUP_COLLECTION = "kommo_webhook_dedup";

export interface KommoMessageRecord {
  clienteId: string | null;
  phoneNormalized?: string;
  text: string;
  direction: "inbound" | "outbound";
  kommo_message_id?: string;
  lead_id?: number;
  talk_id?: number;
  conversation_id?: string;
  channel?: string;
  delivery?: "amojo" | "crm_note" | "unknown";
  /** Small JSON-safe snapshot for debugging */
  meta?: Record<string, unknown>;
  createdAt: Timestamp;
}

function sha256DocId(key: string): string {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

export async function isWebhookDuplicate(db: Firestore, dedupKey: string): Promise<boolean> {
  const id = sha256DocId(dedupKey);
  const snap = await db.collection(KOMMO_WEBHOOK_DEDUP_COLLECTION).doc(id).get();
  return snap.exists;
}

export async function recordWebhookProcessed(
  db: Firestore,
  dedupKey: string,
  meta: Record<string, unknown>
): Promise<void> {
  const id = sha256DocId(dedupKey);
  await db
    .collection(KOMMO_WEBHOOK_DEDUP_COLLECTION)
    .doc(id)
    .set(
      {
        ...meta,
        dedupKeyPreview: dedupKey.slice(0, 200),
        processedAt: Timestamp.now(),
      },
      { merge: true }
    );
}

/**
 * Save an inbound or outbound message to Firestore.
 * clienteId is the Realtime DB client key when known.
 */
export async function saveMessage(
  db: Firestore,
  options: {
    clienteId: string | null;
    phoneNormalized?: string;
    text: string;
    direction: "inbound" | "outbound";
    kommo_message_id?: string;
    lead_id?: number;
    talk_id?: number;
    conversation_id?: string;
    channel?: string;
    delivery?: KommoMessageRecord["delivery"];
    meta?: Record<string, unknown>;
  }
): Promise<string> {
  const docId =
    options.clienteId != null
      ? options.clienteId
      : `phone_${options.phoneNormalized ?? "unknown"}`;
  const ref = db.collection(KOMMO_MESSAGES_COLLECTION).doc(docId);
  const data: KommoMessageRecord = {
    clienteId: options.clienteId,
    phoneNormalized: options.phoneNormalized,
    text: options.text,
    direction: options.direction,
    kommo_message_id: options.kommo_message_id,
    lead_id: options.lead_id,
    talk_id: options.talk_id,
    conversation_id: options.conversation_id,
    channel: options.channel,
    delivery: options.delivery ?? "unknown",
    meta: options.meta,
    createdAt: Timestamp.now(),
  };
  const newDoc = await ref.collection(MESSAGES_SUBCOLLECTION).add(data);
  return newDoc.id;
}
