"use strict";
/**
 * Firestore helpers for Kommo integration (messages and tokens only).
 * Clientes are stored in Realtime DB; use rtdbHelpers for client lookup/update.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWebhookDuplicate = isWebhookDuplicate;
exports.recordWebhookProcessed = recordWebhookProcessed;
exports.saveMessage = saveMessage;
const firestore_1 = require("firebase-admin/firestore");
const crypto = __importStar(require("crypto"));
const KOMMO_MESSAGES_COLLECTION = "kommo_messages";
const MESSAGES_SUBCOLLECTION = "messages";
const KOMMO_WEBHOOK_DEDUP_COLLECTION = "kommo_webhook_dedup";
function sha256DocId(key) {
    return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}
async function isWebhookDuplicate(db, dedupKey) {
    const id = sha256DocId(dedupKey);
    const snap = await db.collection(KOMMO_WEBHOOK_DEDUP_COLLECTION).doc(id).get();
    return snap.exists;
}
async function recordWebhookProcessed(db, dedupKey, meta) {
    const id = sha256DocId(dedupKey);
    await db
        .collection(KOMMO_WEBHOOK_DEDUP_COLLECTION)
        .doc(id)
        .set(Object.assign(Object.assign({}, meta), { dedupKeyPreview: dedupKey.slice(0, 200), processedAt: firestore_1.Timestamp.now() }), { merge: true });
}
/**
 * Save an inbound or outbound message to Firestore.
 * clienteId is the Realtime DB client key when known.
 */
async function saveMessage(db, options) {
    var _a, _b;
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
        talk_id: options.talk_id,
        conversation_id: options.conversation_id,
        channel: options.channel,
        delivery: (_b = options.delivery) !== null && _b !== void 0 ? _b : "unknown",
        meta: options.meta,
        createdAt: firestore_1.Timestamp.now(),
    };
    const newDoc = await ref.collection(MESSAGES_SUBCOLLECTION).add(data);
    return newDoc.id;
}
//# sourceMappingURL=firestoreHelpers.js.map