/**
 * Kommo Chats API (Amojo) — signed requests to send real channel messages.
 * POST https://amojo.kommo.com/v2/origin/custom/{scope_id}
 *
 * Docs: https://developers.kommo.com/reference/send-import-messages
 * Requires: channel secret + scope_id + account_id from channel connection.
 */

import axios from "axios";
import * as crypto from "crypto";

const AMOJO_BASE = "https://amojo.kommo.com";

export type AmojoNewMessagePayload = {
  timestamp: number;
  msec_timestamp: number;
  msgid: string;
  conversation_id: string;
  silent?: boolean;
  /** Outgoing from your integration / manager side */
  sender: {
    id: string;
    name?: string;
    profile?: Record<string, unknown>;
    profile_link?: string;
  };
  message: {
    type: "text";
    text: string;
  };
};

export type AmojoRequestBody = {
  event_type: "new_message";
  payload: AmojoNewMessagePayload;
  account_id: string;
};

/**
 * Content-MD5: Kommo examples use lowercase hex of UTF-8 body.
 * If requests fail with 401/403, try KOMMO_AMOJO_MD5_MODE=base64 (binary MD5, base64).
 */
function contentMd5Header(body: string, mode: string): string {
  const hash = crypto.createHash("md5").update(body, "utf8");
  if (mode === "base64") {
    return hash.digest("base64");
  }
  return hash.digest("hex");
}

/**
 * X-Signature: HMAC-SHA1 of canonical string, base64-encoded.
 * Canonical line order matches Kommo / amoCRM chat integrations:
 * METHOD, Content-MD5, Content-Type (lower), Date (HTTP), path (incl. leading slash).
 */
export function buildAmojoSignature(params: {
  method: string;
  contentMd5: string;
  contentType: string;
  dateHeader: string;
  path: string;
  channelSecret: string;
}): string {
  const ct = params.contentType.toLowerCase();
  const stringToSign = [
    params.method.toUpperCase(),
    params.contentMd5,
    ct,
    params.dateHeader,
    params.path,
  ].join("\n");
  return crypto
    .createHmac("sha1", params.channelSecret)
    .update(stringToSign, "utf8")
    .digest("base64");
}

export async function postAmojoNewMessage(options: {
  scopeId: string;
  channelSecret: string;
  accountId: string;
  body: AmojoRequestBody;
  md5Mode?: string;
}): Promise<{ status: number; data: unknown }> {
  const md5Mode = options.md5Mode ?? process.env.KOMMO_AMOJO_MD5_MODE ?? "hex";
  const jsonBody = JSON.stringify(options.body);
  const path = `/v2/origin/custom/${options.scopeId}`;
  const url = `${AMOJO_BASE}${path}`;
  const dateHeader = new Date().toUTCString();
  const contentType = "application/json";
  const contentMd5 = contentMd5Header(jsonBody, md5Mode);
  const xSignature = buildAmojoSignature({
    method: "POST",
    contentMd5,
    contentType,
    dateHeader,
    path,
    channelSecret: options.channelSecret,
  });

  const res = await axios.post(url, jsonBody, {
    headers: {
      "Content-Type": contentType,
      Date: dateHeader,
      "Content-MD5": contentMd5,
      "X-Signature": xSignature,
    },
    validateStatus: () => true,
  });

  return { status: res.status, data: res.data };
}
