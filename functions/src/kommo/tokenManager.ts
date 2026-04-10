/**
 * Kommo OAuth 2.0 token management via Realtime Database.
 * Handles: exchange code → tokens, refresh, read with auto-refresh.
 * Tokens stored at kommo_tokens/default in RTDB.
 */

import { getDatabase } from "firebase-admin/database";
import axios, { isAxiosError } from "axios";

const KOMMO_TOKEN_PATH = "kommo_tokens/default";
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface KommoTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function getSubdomain(): string {
  const sub = process.env.KOMMO_DOMAIN ?? "";
  if (!sub) throw new Error("KOMMO_DOMAIN env var is not set");
  return sub;
}

function tokenEndpoint(): string {
  return `https://${getSubdomain()}.kommo.com/oauth2/access_token`;
}

export async function getStoredTokens(): Promise<KommoTokens | null> {
  const db = getDatabase();
  const snap = await db.ref(KOMMO_TOKEN_PATH).once("value");
  const val = snap.val();
  if (!val || !val.access_token) return null;
  return val as KommoTokens;
}

export async function saveTokens(tokens: KommoTokens): Promise<void> {
  const db = getDatabase();
  await db.ref(KOMMO_TOKEN_PATH).set(tokens);
  console.log("Kommo tokens saved to RTDB, expires_at:", new Date(tokens.expires_at).toISOString());
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<KommoTokens> {
  console.log("Exchanging OAuth code for tokens...");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  let res;
  try {
    res = await axios.post<{
      token_type: string;
      expires_in: number;
      access_token: string;
      refresh_token: string;
    }>(tokenEndpoint(), body.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      validateStatus: () => true,
    });
  } catch (e: unknown) {
    const msg = isAxiosError(e)
      ? `Network error calling Kommo OAuth: ${e.message}`
      : String(e);
    console.error("Kommo OAuth exchange network error:", msg);
    throw new Error(msg);
  }

  console.log("Kommo OAuth response status:", res.status);

  if (res.status < 200 || res.status >= 300) {
    const detail = JSON.stringify(res.data);
    console.error("Kommo OAuth exchange failed:", detail);
    throw new Error(`Kommo OAuth token exchange failed HTTP ${res.status}: ${detail}`);
  }

  const data = res.data;
  const tokens: KommoTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 86400) * 1000,
  };

  await saveTokens(tokens);
  console.log("OAuth code exchange successful");
  return tokens;
}

export async function refreshAccessToken(
  clientId: string,
  clientSecret: string
): Promise<KommoTokens> {
  const current = await getStoredTokens();
  if (!current) {
    throw new Error("No Kommo tokens in RTDB. Complete OAuth flow first.");
  }

  console.log("Refreshing Kommo access token...");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: current.refresh_token,
  });

  let res;
  try {
    res = await axios.post<{
      token_type: string;
      expires_in: number;
      access_token: string;
      refresh_token: string;
    }>(tokenEndpoint(), body.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      validateStatus: () => true,
    });
  } catch (e: unknown) {
    const msg = isAxiosError(e)
      ? `Network error refreshing Kommo token: ${e.message}`
      : String(e);
    console.error("Kommo token refresh network error:", msg);
    throw new Error(msg);
  }

  console.log("Kommo refresh response status:", res.status);

  if (res.status < 200 || res.status >= 300) {
    const detail = JSON.stringify(res.data);
    console.error("Kommo token refresh failed:", detail);
    throw new Error(`Kommo token refresh failed HTTP ${res.status}: ${detail}`);
  }

  const data = res.data;
  const tokens: KommoTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 86400) * 1000,
  };

  await saveTokens(tokens);
  console.log("Token refresh successful");
  return tokens;
}

/**
 * Returns a valid access token, refreshing automatically if expired or near-expiry.
 */
export async function getValidAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const tokens = await getStoredTokens();
  if (!tokens) {
    throw new Error("No Kommo tokens in RTDB. Complete OAuth flow first.");
  }

  if (Date.now() >= tokens.expires_at - REFRESH_BUFFER_MS) {
    console.log("Token expired or near expiry, refreshing...");
    const refreshed = await refreshAccessToken(clientId, clientSecret);
    return refreshed.access_token;
  }

  return tokens.access_token;
}
