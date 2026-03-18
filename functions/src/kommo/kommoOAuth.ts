/**
 * Kommo OAuth 2.0: exchange code for tokens, refresh token, read tokens from Firestore.
 * Tokens stored in collection kommo_tokens, document "default". Frontend must NEVER access them.
 */

import { getFirestore } from "firebase-admin/firestore";
import axios from "axios";

const KOMMO_TOKEN_COLLECTION = "kommo_tokens";
const KOMMO_TOKEN_DOC_ID = "default";
const KOMMO_OAUTH_URL = "https://www.kommo.com/oauth2/access_token";

export interface KommoTokens {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

/**
 * Exchange authorization code for access_token and refresh_token.
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<KommoTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const res = await axios.post<{
    token_type: string;
    expires_in: number;
    access_token: string;
    refresh_token: string;
  }>(KOMMO_OAUTH_URL, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const data = res.data;
  const expires_at = Date.now() + (data.expires_in ?? 86400) * 1000;

  const tokens: KommoTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at,
  };

  const db = getFirestore();
  await db.collection(KOMMO_TOKEN_COLLECTION).doc(KOMMO_TOKEN_DOC_ID).set(tokens);

  return tokens;
}

/**
 * Refresh access_token using refresh_token. Updates Firestore.
 */
export async function refreshAccessToken(
  clientId: string,
  clientSecret: string
): Promise<KommoTokens> {
  const db = getFirestore();
  const snap = await db.collection(KOMMO_TOKEN_COLLECTION).doc(KOMMO_TOKEN_DOC_ID).get();
  if (!snap.exists) {
    throw new Error("Kommo tokens not found. Run OAuth flow first.");
  }
  const current = snap.data() as KommoTokens;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: current.refresh_token,
  });

  const res = await axios.post<{
    token_type: string;
    expires_in: number;
    access_token: string;
    refresh_token: string;
  }>(KOMMO_OAUTH_URL, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const data = res.data;
  const expires_at = Date.now() + (data.expires_in ?? 86400) * 1000;

  const tokens: KommoTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at,
  };

  await db.collection(KOMMO_TOKEN_COLLECTION).doc(KOMMO_TOKEN_DOC_ID).set(tokens);

  return tokens;
}

/**
 * Get valid access token; refresh if expired.
 */
export async function getValidAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const db = getFirestore();
  const snap = await db.collection(KOMMO_TOKEN_COLLECTION).doc(KOMMO_TOKEN_DOC_ID).get();
  if (!snap.exists) {
    throw new Error("Kommo tokens not found. Run OAuth flow first.");
  }
  const data = snap.data() as KommoTokens;
  const expiresAt = data.expires_at ?? 0;
  const bufferMs = 5 * 60 * 1000;
  if (Date.now() >= expiresAt - bufferMs) {
    const refreshed = await refreshAccessToken(clientId, clientSecret);
    return refreshed.access_token;
  }
  return data.access_token;
}
