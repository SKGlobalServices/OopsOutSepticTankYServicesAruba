/**
 * Firebase Cloud Functions — Kommo CRM Integration V1.
 *
 * Endpoints:
 * - kommoAuthRedirect:  GET  → redirects to Kommo OAuth
 * - kommoAuthCallback:  GET  → handles OAuth callback, stores tokens in RTDB
 * - kommoTestFetch:     GET  → validates connection, returns raw leads/contacts
 * - kommoSync:          POST → fetches leads/contacts and saves raw to RTDB
 * - kommoGetChats:      GET  → returns chats/conversations from Kommo
 */

import cors from "cors";
import { initializeApp } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";
import { handleAuthRedirect, handleAuthCallback } from "./kommo/auth";
import { getChats } from "./kommo/chats";
import { testFetch, syncData } from "./kommo/sync";

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

export const kommoTestFetch = onRequest(
  { region: "us-central1", invoker: "public" },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const result = await testFetch();
      res.status(result.success ? 200 : 500).json(result);
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
