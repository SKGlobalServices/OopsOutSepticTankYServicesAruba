"use strict";
/**
 * Firestore helpers for Kommo integration (messages and tokens only).
 * Clientes are stored in Realtime DB; use rtdbHelpers for client lookup/update.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveMessage = saveMessage;
const firestore_1 = require("firebase-admin/firestore");
const KOMMO_MESSAGES_COLLECTION = "kommo_messages";
const MESSAGES_SUBCOLLECTION = "messages";
/**
 * Save an inbound or outbound message to Firestore.
 * clienteId is the Realtime DB client key when known.
 */
async function saveMessage(db, options) {
    var _a;
    const docId = options.clienteId != null
        ? options.clienteId
        : `phone_${(_a = options.phoneNormalized) !== null && _a !== void 0 ? _a : "unknown"}`;
    const ref = db.collection(KOMMO_MESSAGES_COLLECTION).doc(docId);
    const data = {
        clienteId: options.clienteId,
        phoneNormalized: options.phoneNormalized,
        text: options.text,
        direction: options.direction,
        kommo_message_id: options.kommo_message_id,
        lead_id: options.lead_id,
        createdAt: firestore_1.Timestamp.now(),
    };
    const newDoc = await ref.collection(MESSAGES_SUBCOLLECTION).add(data);
    return newDoc.id;
}
//# sourceMappingURL=firestoreHelpers.js.map