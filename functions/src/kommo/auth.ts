/**
 * Kommo OAuth 2.0 HTTP handlers:
 * - handleAuthRedirect: redirects user to Kommo authorization page
 * - handleAuthCallback: receives code, exchanges for tokens, stores in RTDB
 */

import { Request } from "firebase-functions/v2/https";
import { Response } from "express";
import { exchangeCodeForTokens } from "./tokenManager";

function getClientId(): string {
  return process.env.KOMMO_CLIENT_ID ?? "";
}

function getClientSecret(): string {
  return process.env.KOMMO_CLIENT_SECRET ?? "";
}

function getRedirectUri(): string {
  return process.env.KOMMO_REDIRECT_URI ?? "";
}

/**
 * Where to send the user to approve the integration.
 * Official Kommo docs use https://www.kommo.com/oauth (not the account subdomain).
 * If you need the account host, set KOMMO_OAUTH_AUTHORIZE_URL=https://YOURSUBDOMAIN.kommo.com/oauth
 */
function getAuthorizeBaseUrl(): string {
  const custom = process.env.KOMMO_OAUTH_AUTHORIZE_URL?.trim();
  if (custom) return custom.replace(/\/$/, "");
  return "https://www.kommo.com/oauth";
}

export function handleAuthRedirect(req: Request, res: Response): void {
  const clientId = getClientId();
  const redirectUri = getRedirectUri();

  if (!clientId || !redirectUri) {
    console.error("OAuth redirect failed: missing KOMMO_CLIENT_ID or KOMMO_REDIRECT_URI");
    res.status(500).json({
      error:
        "KOMMO_CLIENT_ID or KOMMO_REDIRECT_URI not configured. " +
        "Set KOMMO_REDIRECT_URI to your kommoAuthCallback URL and register the same URL in Kommo → Integration → Redirect URI.",
    });
    return;
  }

  const base = getAuthorizeBaseUrl();
  console.log("[Kommo OAuth debug] Authorize page base URL:", base);
  console.log(
    "[Kommo OAuth debug] redirect_uri (callback URL sent to Kommo, must match integration Redirect URI):",
    redirectUri
  );
  console.log(
    "[Kommo OAuth debug] client_id (prefix):",
    clientId.length > 8 ? `${clientId.slice(0, 8)}…` : clientId
  );

  const authUrl = new URL(base.includes("://") ? base : `https://${base}`);

  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");

  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (state) {
    authUrl.searchParams.set("state", state);
    console.log("[Kommo OAuth debug] state (CSRF): present, length:", state.length);
  } else {
    console.log("[Kommo OAuth debug] state: (not provided on this request)");
  }

  const finalUrl = authUrl.toString();
  console.log("[Kommo OAuth debug] Full authorize URL (user will be sent here):", finalUrl);
  console.log(
    "[Kommo OAuth debug] redirect_uri as query param on that URL:",
    authUrl.searchParams.get("redirect_uri")
  );

  res.redirect(finalUrl);
}

export async function handleAuthCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined;

  if (!code) {
    console.error("OAuth callback: missing 'code' query parameter");
    res.status(400).json({ error: "Missing 'code' query parameter" });
    return;
  }

  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const redirectUri = getRedirectUri();

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("OAuth callback: missing env vars");
    res.status(500).json({
      error: "Kommo OAuth not configured (KOMMO_CLIENT_ID, KOMMO_CLIENT_SECRET, KOMMO_REDIRECT_URI)",
    });
    return;
  }

  console.log(
    "[Kommo OAuth debug] Callback: exchanging code using redirect_uri:",
    redirectUri
  );

  try {
    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);
    console.log("OAuth callback completed successfully");
    res.status(200).json({
      success: true,
      message: "Kommo OAuth completed. Tokens stored in RTDB.",
      expires_at: tokens.expires_at,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("OAuth callback error:", msg);
    res.status(500).json({ error: `OAuth failed: ${msg}` });
  }
}
