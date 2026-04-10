/**
 * Axios client for Kommo CRM API v4.
 * baseURL: https://{domain}.kommo.com/api/v4
 */

import axios, { AxiosInstance } from "axios";

export function createKommoClient(
  accessToken: string,
  domain: string
): AxiosInstance {
  const baseURL = `https://${domain}.kommo.com/api/v4`;

  console.log("Creating Kommo API client for:", baseURL);

  return axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

export type KommoClient = ReturnType<typeof createKommoClient>;
