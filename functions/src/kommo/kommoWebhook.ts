/**
 * Single HTTP endpoint for Kommo CRM webhooks: POST /kommo/webhook
 * Responds 200 immediately and processes payload asynchronously.
 */

import { Request } from "firebase-functions/v2/https";
import { Response } from "express";
import { processWebhookAsync } from "./kommoService";

/**
 * Kommo sends webhooks as x-www-form-urlencoded. Parse body accordingly.
 * Payload may be in a single field (e.g. payload or the entity object).
 */
function parseWebhookBody(req: Request): Record<string, unknown> {
  const body = req.body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const rec = body as Record<string, unknown>;
    if (rec.leads ?? rec.contacts ?? rec.notes ?? rec.messages) {
      return rec;
    }
    const payloadStr = rec.payload ?? rec.data ?? rec.body;
    if (typeof payloadStr === "string") {
      try {
        const parsed = JSON.parse(payloadStr) as Record<string, unknown>;
        return parsed;
      } catch {
        return rec;
      }
    }
    return rec;
  }
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return { raw: body.slice(0, 500) };
    }
  }
  return {};
}

/**
 * Handle POST /kommo/webhook: respond 200 immediately, then process async.
 * Processing only writes to Firestore (no Kommo API calls), so no OAuth needed here.
 */
export function createKommoWebhookHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const payload = parseWebhookBody(req);

    res.status(200).send("ok");

    processWebhookAsync(payload).catch((err: unknown) => {
      console.error("Kommo webhook processing error:", err);
    });
  };
}
