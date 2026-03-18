/**
 * Axios client for Kommo CRM API v4.
 * baseURL: https://{domain}.kommo.com/api/v4
 * Authorization: Bearer access_token
 */

import axios, { AxiosInstance, AxiosError } from "axios";

const DEFAULT_BASE_URL = "https://example.kommo.com/api/v4";

export function createKommoClient(
  accessToken: string,
  domain?: string
): AxiosInstance {
  const baseURL =
    domain != null && domain !== ""
      ? `https://${domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}.kommo.com/api/v4`
      : DEFAULT_BASE_URL;

  const client = axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  client.interceptors.response.use(
    (res) => res,
    async (err: AxiosError) => {
      if (err.response?.status === 401) {
        // Token expired – caller should refresh and retry
        err.message = "Kommo access token expired or invalid";
      }
      return Promise.reject(err);
    }
  );

  return client;
}

export type KommoClient = ReturnType<typeof createKommoClient>;
