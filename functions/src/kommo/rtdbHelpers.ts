/**
 * Realtime Database helpers for clientes (Kommo integration).
 * App stores clientes in RTDB; these helpers find and update them by telefono / kommo IDs.
 */

import { getDatabase } from "firebase-admin/database";
import { phoneMatchCandidates } from "./phoneUtils";

const DEFAULT_CC = process.env.KOMMO_DEFAULT_COUNTRY_CODE ?? "297";

const CLIENTES_PATH = "clientes";

const PHONE_FIELDS = ["telefono1", "telefono2", "telefono3"] as const;

export interface ClienteRecordRTDB {
  id: string;
  telefono1?: string;
  telefono2?: string;
  telefono3?: string;
  direccion?: string;
  anombrede?: string;
  kommo_contact_id?: string;
  kommo_lead_id?: number;
  [key: string]: unknown;
}

/**
 * Find a client in Realtime DB by normalized phone number.
 * Matches against telefono1, telefono2, or telefono3 (and legacy telefono if present).
 */
export async function findClienteByPhoneRTDB(
  phone: string
): Promise<ClienteRecordRTDB | null> {
  const searchVariants = phoneMatchCandidates(phone, DEFAULT_CC);
  if (!searchVariants.length) return null;

  const db = getDatabase();
  const snapshot = await db.ref(CLIENTES_PATH).once("value");
  const val = snapshot.val();
  if (!val || typeof val !== "object") return null;

  const searchSet = new Set(searchVariants);

  for (const [id, c] of Object.entries(val as Record<string, Record<string, unknown>>)) {
    const fieldsToCheck = [...PHONE_FIELDS, "telefono"];
    for (const key of fieldsToCheck) {
      const stored = c?.[key];
      if (stored == null || stored === "") continue;
      const storedVariants = phoneMatchCandidates(String(stored), DEFAULT_CC);
      if (storedVariants.some((v) => searchSet.has(v))) {
        return { id, ...c } as ClienteRecordRTDB;
      }
    }
  }
  return null;
}

/**
 * Find a client by Kommo contact ID.
 */
export async function findClienteByKommoContactIdRTDB(
  kommoContactId: string
): Promise<ClienteRecordRTDB | null> {
  const db = getDatabase();
  const snapshot = await db.ref(CLIENTES_PATH).once("value");
  const val = snapshot.val();
  if (!val || typeof val !== "object") return null;

  for (const [id, c] of Object.entries(val as Record<string, Record<string, unknown>>)) {
    if ((c?.kommo_contact_id ?? "") === kommoContactId) {
      return { id, ...c } as ClienteRecordRTDB;
    }
  }
  return null;
}

/**
 * Find a client by Kommo lead ID.
 */
export async function findClienteByKommoLeadIdRTDB(
  kommoLeadId: number
): Promise<ClienteRecordRTDB | null> {
  const db = getDatabase();
  const snapshot = await db.ref(CLIENTES_PATH).once("value");
  const val = snapshot.val();
  if (!val || typeof val !== "object") return null;

  for (const [id, c] of Object.entries(val as Record<string, Record<string, unknown>>)) {
    const leadId = c?.kommo_lead_id;
    if (leadId !== undefined && leadId !== null && Number(leadId) === kommoLeadId) {
      return { id, ...c } as ClienteRecordRTDB;
    }
  }
  return null;
}

/**
 * Resolve RTDB cliente id from phone or Kommo IDs.
 */
export async function resolveClienteIdRTDB(payload: {
  phone?: string;
  kommo_contact_id?: string;
  kommo_lead_id?: number;
}): Promise<string | null> {
  if (payload.phone) {
    const byPhone = await findClienteByPhoneRTDB(payload.phone);
    if (byPhone) return byPhone.id;
  }
  if (payload.kommo_contact_id) {
    const byContact = await findClienteByKommoContactIdRTDB(payload.kommo_contact_id);
    if (byContact) return byContact.id;
  }
  if (payload.kommo_lead_id != null) {
    const byLead = await findClienteByKommoLeadIdRTDB(payload.kommo_lead_id);
    if (byLead) return byLead.id;
  }
  return null;
}

/**
 * Update a cliente in RTDB with Kommo IDs (merge).
 */
export async function updateClienteKommoIdsRTDB(
  clienteId: string,
  updates: { kommo_contact_id?: string; kommo_lead_id?: number }
): Promise<void> {
  const db = getDatabase();
  await db.ref(`${CLIENTES_PATH}/${clienteId}`).update(updates);
}
