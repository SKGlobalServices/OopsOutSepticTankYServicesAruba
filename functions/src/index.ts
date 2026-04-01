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
import { sendKommoOutboundMessage } from "./kommo/kommoService";
import { exchangeCodeForTokens } from "./kommo/kommoOAuth";

initializeApp();

function getKommoClientId(): string {
  return process.env.KOMMO_CLIENT_ID ?? "";
}
function getKommoClientSecret(): string {
  return process.env.KOMMO_CLIENT_SECRET ?? "";
}
function getKommoDomain(): string {
  return process.env.KOMMO_DOMAIN ?? "";
}

const webhookHandler = createKommoWebhookHandler();

/**
 * Single webhook endpoint for Kommo CRM.
 * Configure in Kommo: Ajustes → Integración → Webhooks → URL = this function's URL.
 * Events: leads.*, contacts.*, notes.*, and Chats API message events (configure in Kommo).
 */
export const kommoWebhook = onRequest(
  {
    region: "us-central1",
    invoker: "public",
  },
  webhookHandler
);

/**
 * Callable: send WhatsApp/channel message via Kommo Chats API (Amojo) when configured;
 * optional CRM note fallback if KOMMO_SEND_FALLBACK_NOTES=true.
 * Input: { message: string, leadId?: number, talkId?: number, conversationId?: string }
 * — at least one of leadId / talkId / conversationId is required.
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

    const data = request.data as {
      leadId?: number;
      talkId?: number;
      conversationId?: string;
      message?: string;
    } | null;

    if (!data || typeof data.message !== "string" || !data.message.trim()) {
      throw new HttpsError(
        "invalid-argument",
        "message (non-empty string) is required"
      );
    }

    const hasLead = typeof data.leadId === "number";
    const hasTalk = typeof data.talkId === "number";
    const hasConv =
      typeof data.conversationId === "string" &&
      data.conversationId.trim() !== "";

    if (!hasLead && !hasTalk && !hasConv) {
      throw new HttpsError(
        "invalid-argument",
        "Provide at least one of: leadId, talkId, or conversationId"
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

    if (!getKommoDomain().trim()) {
      throw new HttpsError(
        "failed-precondition",
        "KOMMO_DOMAIN is not set (subdomain only, e.g. youraccount for youraccount.kommo.com)"
      );
    }

    const result = await sendKommoOutboundMessage(
      {
        message: data.message.trim(),
        leadId: hasLead ? data.leadId : undefined,
        talkId: hasTalk ? data.talkId : undefined,
        conversationId: hasConv ? data.conversationId!.trim() : undefined,
      },
      clientId,
      clientSecret
    );

    if (!result.success) {
      throw new HttpsError("internal", result.error ?? "Failed to send message");
    }

    return {
      success: true,
      delivery: result.delivery,
      noteId: result.noteId,
      amojoStatus: result.amojoStatus,
    };
  }
);

/**
 * Callable: exchange OAuth authorization code for tokens and store in Firestore.
 * Requires Firebase Auth (e.g. user signed in with Google before opening Kommo OAuth).
 * Input: { code: string, redirectUri: string }
 */
export const kommoOAuth = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be logged in with Firebase Auth to complete Kommo OAuth"
      );
    }

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

    try {
      await exchangeCodeForTokens(
        data.code,
        clientId,
        clientSecret,
        data.redirectUri
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpsError(
        "failed-precondition",
        `Kommo OAuth: ${msg}`
      );
    }

    return { success: true };
  }
);
