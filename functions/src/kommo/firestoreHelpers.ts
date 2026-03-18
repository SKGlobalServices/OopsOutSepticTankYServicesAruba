/**
 * Firestore helpers for Kommo integration (messages and tokens only).
 * Clientes are stored in Realtime DB; use rtdbHelpers for client lookup/update.
 */

import { Firestore, Timestamp } from "firebase-admin/firestore";

const KOMMO_MESSAGES_COLLECTION = "kommo_messages";
const MESSAGES_SUBCOLLECTION = "messages";

export interface KommoMessageRecord {
  clienteId: string | null;
  phoneNormalized?: string;
  text: string;
  direction: "inbound" | "outbound";
  kommo_message_id?: string;
  lead_id?: number;
  createdAt: Timestamp;
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
    createdAt: Timestamp.now(),
  };
  const newDoc = await ref.collection(MESSAGES_SUBCOLLECTION).add(data);
  return newDoc.id;
}
