const KOMMO_TEST_FETCH_URL =
  process.env.REACT_APP_KOMMO_TEST_FETCH_URL ||
  `https://us-central1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/kommoTestFetch`;

const KOMMO_SYNC_URL =
  process.env.REACT_APP_KOMMO_SYNC_URL ||
  `https://us-central1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/kommoSync`;

export function formatLeadCreatedAt(createdAt) {
  if (typeof createdAt !== "number" || !isFinite(createdAt)) return "—";
  return new Date(createdAt * 1000).toLocaleString();
}

export function normalizeLeads(rawPayload) {
  const list = rawPayload?.leads?._embedded?.leads ?? [];
  return list.map((lead) => ({
    id: lead.id ?? null,
    name: lead.name ?? "",
    created_at: lead.created_at ?? null,
    status_id: lead.status_id ?? null,
  }));
}

export async function fetchKommoLeads() {
  console.log("[kommoService] Fetching leads from", KOMMO_TEST_FETCH_URL);

  const response = await fetch(KOMMO_TEST_FETCH_URL);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch leads`);
  }

  const data = await response.json();

  if (data.success === false) {
    throw new Error(data.error || "Kommo API returned an error");
  }

  const leads = normalizeLeads(data);
  console.log("[kommoService] Fetched", leads.length, "leads");
  return leads;
}

// Stub for Phase 3 — POST /kommoSync
export async function syncKommoData() {
  console.log("[kommoService] Syncing data via", KOMMO_SYNC_URL);

  const response = await fetch(KOMMO_SYNC_URL, { method: "POST" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Sync request failed`);
  }

  const data = await response.json();

  if (data.success === false) {
    throw new Error(data.error || "Kommo sync returned an error");
  }

  console.log("[kommoService] Sync complete:", data);
  return data;
}
