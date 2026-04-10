import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchChats,
  groupByConversation,
  formatTimestamp,
} from "../services/kommoChatService";
import Slidebar from "../components/Slidebar";
import "../components/Dashboard/Dashboard.css";
import "./KommoInboxPage.css";

function originLabel(origin) {
  if (!origin) return "";
  if (origin.includes("amocrmwa")) return "WhatsApp";
  if (origin.includes("telegram")) return "Telegram";
  if (origin.includes("instagram")) return "Instagram";
  if (origin.includes("facebook")) return "Facebook";
  return origin.replace("com.amocrm.", "");
}

const KommoInboxPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedConvo, setSelectedConvo] = useState(null);

  const loadChats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChats();
      setEvents(data);
    } catch (err) {
      console.error("[KommoInboxPage] Error loading chat events:", err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const conversations = useMemo(() => groupByConversation(events), [events]);

  const totalIncoming = conversations.reduce((s, c) => s + c.incomingCount, 0);
  const totalOutgoing = conversations.reduce((s, c) => s + c.outgoingCount, 0);

  return (
    <div className="homepage-container">
      <Slidebar />

      <div className="dashboard-container">
        <div className="kommo-inbox-page">
          <div className="kommo-inbox-header">
            <div>
              <h1 className="kommo-inbox-title">Kommo Inbox</h1>
              {!loading && conversations.length > 0 && (
                <div className="kommo-inbox-stats">
                  {conversations.length} conversations &middot;{" "}
                  {totalIncoming} incoming &middot; {totalOutgoing} outgoing
                </div>
              )}
            </div>
            <button
              className="kommo-inbox-refresh"
              onClick={loadChats}
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {error && <div className="kommo-inbox-error">{error}</div>}

          {loading && (
            <div className="kommo-inbox-loading">Loading conversations...</div>
          )}

          {!loading && (
            <div className="kommo-inbox-container">
              {/* Left panel — conversation list */}
              <div className="kommo-inbox-list">
                {conversations.length === 0 && !error && (
                  <div className="kommo-inbox-list-empty">
                    No conversations found.
                  </div>
                )}
                {conversations.map((convo) => (
                  <div
                    key={convo.talkId ?? `e-${convo.entityId}`}
                    className={`kommo-inbox-item${
                      selectedConvo?.talkId === convo.talkId &&
                      selectedConvo?.entityId === convo.entityId
                        ? " selected"
                        : ""
                    }`}
                    onClick={() => setSelectedConvo(convo)}
                  >
                    <div className="kommo-inbox-item-name">
                      {convo.leadName || `Lead #${convo.entityId}`}
                    </div>
                    <div className="kommo-inbox-item-sub">
                      {convo.talkId ? `Talk #${convo.talkId}` : ""}
                      {convo.talkId && convo.origin ? " · " : ""}
                      {originLabel(convo.origin)}
                    </div>
                    <div className="kommo-inbox-item-meta">
                      <span className="kommo-inbox-item-badge">
                        {convo.eventCount} msg
                      </span>
                      <span className="kommo-inbox-item-date">
                        {formatTimestamp(convo.latestEvent.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right panel — conversation detail */}
              {selectedConvo ? (
                <div className="kommo-inbox-detail-selected">
                  <h2>
                    {selectedConvo.leadName ||
                      `Lead #${selectedConvo.entityId}`}
                  </h2>

                  <div className="kommo-inbox-detail-cards">
                    <div className="kommo-inbox-detail-card">
                      <span className="kommo-inbox-detail-label">Talk ID</span>
                      <span className="kommo-inbox-detail-value">
                        {selectedConvo.talkId ?? "—"}
                      </span>
                    </div>
                    <div className="kommo-inbox-detail-card">
                      <span className="kommo-inbox-detail-label">Origin</span>
                      <span className="kommo-inbox-detail-value">
                        {originLabel(selectedConvo.origin) || "—"}
                      </span>
                    </div>
                    <div className="kommo-inbox-detail-card">
                      <span className="kommo-inbox-detail-label">Lead</span>
                      <span className="kommo-inbox-detail-value">
                        #{selectedConvo.entityId}
                      </span>
                    </div>
                    <div className="kommo-inbox-detail-card">
                      <span className="kommo-inbox-detail-label">Contact</span>
                      <span className="kommo-inbox-detail-value">
                        {selectedConvo.contactId
                          ? `#${selectedConvo.contactId}`
                          : "—"}
                      </span>
                    </div>
                    <div className="kommo-inbox-detail-card">
                      <span className="kommo-inbox-detail-label">Messages</span>
                      <span className="kommo-inbox-detail-value">
                        {selectedConvo.eventCount} ({selectedConvo.incomingCount}{" "}
                        in / {selectedConvo.outgoingCount} out)
                      </span>
                    </div>
                    <div className="kommo-inbox-detail-card">
                      <span className="kommo-inbox-detail-label">
                        Last activity
                      </span>
                      <span className="kommo-inbox-detail-value">
                        {formatTimestamp(selectedConvo.latestEvent.createdAt)}
                      </span>
                    </div>
                  </div>

                  {selectedConvo.entityLink && (
                    <a
                      className="kommo-inbox-detail-link"
                      href={selectedConvo.entityLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open in Kommo
                    </a>
                  )}

                  <div className="kommo-inbox-detail-placeholder">
                    Full messages view — coming soon
                  </div>
                </div>
              ) : (
                <div className="kommo-inbox-detail">
                  Select a conversation to view details
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KommoInboxPage;
