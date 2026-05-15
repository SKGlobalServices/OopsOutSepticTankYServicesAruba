/**
 * Firebase Cloud Functions — Kommo CRM Integration V1.
 *
 * Endpoints:
 * - kommoAuthRedirect:  GET  → redirects to Kommo OAuth
 * - kommoAuthCallback:  GET  → handles OAuth callback, stores tokens in RTDB
 * - kommoSync:          POST → fetches leads/contacts and saves raw to RTDB
 * - kommoGetChats:      GET  → returns chats/conversations from Kommo (contacts-based)
 * - kommoGetInbox:      GET  → returns inbox from Events API (chat messages)
 * - kommoGetMessages:   GET  → returns notes/messages for a specific lead (?entityId=)
 */

import cors from "cors";
import { initializeApp } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";
import { handleAuthRedirect, handleAuthCallback } from "./kommo/auth";
import { getChats } from "./kommo/chats";
import { getMessages } from "./kommo/messages";
import { syncData } from "./kommo/sync";
import { getInbox } from "./kommo/inbox";

initializeApp();

/** Allows browser requests from any origin (Kommo + SPA). Handles OPTIONS preflight. */
const corsHandler = cors({ origin: true });

export const kommoAuthRedirect = onRequest(
  { region: "us-central1", invoker: "public" },
  (req, res) => {
    corsHandler(req, res, () => {
      handleAuthRedirect(req, res);
    });
  }
);

export const kommoAuthCallback = onRequest(
  { region: "us-central1", invoker: "public" },
  (req, res) => {
    corsHandler(req, res, async () => {
      await handleAuthCallback(req, res);
    });
  }
);

export const kommoSync = onRequest(
  { region: "us-central1", invoker: "public" },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const result = await syncData();
      res.status(result.success ? 200 : 500).json(result);
    });
  }
);

export const kommoGetChats = onRequest(
  { region: "us-central1", invoker: "public" },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
      const result = await getChats(page);
      res.status(result.success ? 200 : 500).json(result);
    });
  }
);

export const kommoGetMessages = onRequest(
  { region: "us-central1", invoker: "public" },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const entityId = parseInt(String(req.query.entityId), 10);
      if (!entityId || isNaN(entityId)) {
        res.status(400).json({ error: "entityId query param is required" });
        return;
      }
      const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
      const result = await getMessages(entityId, page);
      res.status(result.success ? 200 : 500).json(result);
    });
  }
);

export const kommoGetInbox = onRequest(
  { region: "us-central1", invoker: "public" },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
      console.log(`[kommoGetInbox] Request for page ${page}`);
      const result = await getInbox(page);
      res.status(result.success ? 200 : 500).json(result);
    });
  }
);
