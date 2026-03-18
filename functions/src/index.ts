/**
 * Firebase Cloud Functions for Kommo CRM integration.
 * - kommoWebhook: POST HTTP endpoint for Kommo CRM webhooks
 * - kommoSendMessage: Callable to send message to a lead
 * - kommoOAuth: Callable to exchange code for tokens (admin only)
 */

import { initializeApp } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { createKommoWebhookHandler } from "./kommo/kommoWebhook";
import { sendMessageToLead } from "./kommo/kommoService";
import { exchangeCodeForTokens } from "./kommo/kommoOAuth";

initializeApp();

function getKommoClientId(): string {
  return process.env.KOMMO_CLIENT_ID ?? "";
}
function getKommoClientSecret(): string {
  return process.env.KOMMO_CLIENT_SECRET ?? "";
}

const webhookHandler = createKommoWebhookHandler();

/**
 * Single webhook endpoint for Kommo CRM.
 * Configure in Kommo: Ajustes → Integración → Webhooks → URL = this function's URL.
 * Events: leads.add, leads.update, contacts.add, contacts.update, notes.add
 */
export const kommoWebhook = onRequest(
  {
    region: "us-central1",
    invoker: "public",
  },
  webhookHandler
);

/**
 * Callable: send a message to a Kommo lead (adds note to lead and saves to Firestore).
 * Input: { leadId: number, message: string }
 */
export const kommoSendMessage = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    const auth = request.auth;
    if (!auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const data = request.data as { leadId?: number; message?: string } | null;
    if (!data || typeof data.leadId !== "number" || typeof data.message !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Input must be { leadId: number, message: string }"
      );
    }

    const clientId = getKommoClientId();
    const clientSecret = getKommoClientSecret();
    if (!clientId || !clientSecret) {
      throw new HttpsError(
        "failed-precondition",
        "Kommo OAuth not configured (KOMMO_CLIENT_ID, KOMMO_CLIENT_SECRET)"
      );
    }

    const result = await sendMessageToLead(
      data.leadId,
      data.message,
      clientId,
      clientSecret
    );

    if (!result.success) {
      throw new HttpsError("internal", result.error ?? "Failed to send message");
    }

    return { success: true, noteId: result.noteId };
  }
);

/**
 * Callable: exchange OAuth authorization code for tokens and store in Firestore.
 * Only call from a trusted admin context (e.g. after redirect from Kommo).
 * Input: { code: string, redirectUri: string }
 */
export const kommoOAuth = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    const data = request.data as { code?: string; redirectUri?: string } | null;
    if (!data?.code || !data?.redirectUri) {
      throw new HttpsError(
        "invalid-argument",
        "Input must be { code: string, redirectUri: string }"
      );
    }

    const clientId = getKommoClientId();
    const clientSecret = getKommoClientSecret();
    if (!clientId || !clientSecret) {
      throw new HttpsError(
        "failed-precondition",
        "Kommo OAuth not configured"
      );
    }

    await exchangeCodeForTokens(
      data.code,
      clientId,
      clientSecret,
      data.redirectUri
    );

    return { success: true };
  }
);
