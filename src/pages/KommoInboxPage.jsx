import React, { useState, useEffect, useCallback } from "react";
import { fetchInbox, formatTimestamp } from "../services/kommoChatService";
import Slidebar from "../components/Slidebar";
import "../components/Dashboard/Dashboard.css";
import "./KommoInboxPage.css";

function originLabel(origin) {
  if (!origin) return "Chat";
  if (origin.includes("amocrmwa")) return "WhatsApp";
  if (origin.includes("telegram")) return "Telegram";
  if (origin.includes("instagram")) return "Instagram";
  if (origin.includes("facebook")) return "Facebook";
  return origin.replace("com.amocrm.", "");
}

function messageDirectionIcon(type) {
  if (type === "incoming") return "↓";
  if (type === "outgoing") return "↑";
  return "•";
}

const KommoInboxPage = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadInbox = useCallback(async (pageNum, append = false) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const data = await fetchInbox(pageNum);

      if (append) {
        setConversations((prev) => [...prev, ...data.conversations]);
      } else {
        setConversations(data.conversations);
      }

      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error("[KommoInboxPage] Error loading inbox:", err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadInbox(1);
  }, [loadInbox]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadInbox(page + 1, true);
    }
  };

  return (
    <div className="kommo-inbox-page">
      <Slidebar />

      <div className="kommo-inbox-wrapper">
        <div className="kommo-inbox-header">
          <div>
            <h1 className="kommo-inbox-title">Kommo Inbox</h1>
            {!loading && conversations.length > 0 && (
              <div className="kommo-inbox-stats">
                {conversations.length} conversaciones
              </div>
            )}
          </div>
          <button
            className="kommo-inbox-refresh"
            onClick={() => loadInbox(1)}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        {error && <div className="kommo-inbox-error">{error}</div>}

        {loading && (
          <div className="kommo-inbox-loading">Cargando conversaciones...</div>
        )}

        {!loading && (
          <div className={`kommo-inbox-container${selectedConvo ? " has-selection" : ""}`}>
            <div className="kommo-inbox-list">
              {conversations.length === 0 && !error && (
                <div className="kommo-inbox-list-empty">
                  No hay conversaciones recientes.
                </div>
              )}

              {conversations.map((convo) => {
                const isSelected = selectedConvo?.id === convo.id;
                return (
                  <div
                    key={convo.id}
                    className={`kommo-inbox-item${isSelected ? " selected" : ""}`}
                    onClick={() => setSelectedConvo(convo)}
                  >
                    <div className="kommo-inbox-item-name">
                      {convo.contactName || convo.leadName || "Conversación"}
                    </div>
                    <div className="kommo-inbox-item-sub">
                      {convo.leadName && convo.contactName
                        ? `${convo.contactName} · ${convo.leadName}`
                        : convo.leadName || convo.contactName || ""}
                      {convo.origin ? ` · ${originLabel(convo.origin)}` : ""}
                    </div>
                    <div className="kommo-inbox-item-preview">
                      {convo.lastMessage && (
                        <>
                          <span className={`kommo-inbox-direction ${convo.lastMessage.type}`}>
                            {messageDirectionIcon(convo.lastMessage.type)}
                          </span>
                          <span className="kommo-inbox-msg-id">
                            ID: {convo.lastMessage.id?.slice(0, 8)}...
                          </span>
                        </>
                      )}
                      <span className="kommo-inbox-total">
                        {convo.totalMessages} msg
                      </span>
                    </div>
                    <div className="kommo-inbox-item-meta">
                      <span className="kommo-inbox-item-badge">
                        {convo.talkId ? "Chat" : "CRM"}
                      </span>
                      <span className="kommo-inbox-item-date">
                        {formatTimestamp(convo.updatedAt)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <div className="kommo-inbox-load-more-container">
                  <button
                    className="kommo-inbox-load-more"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Cargando..." : "Cargar más"}
                  </button>
                </div>
              )}
            </div>

            <div className="kommo-inbox-detail">
              {!selectedConvo ? (
                <div className="kommo-inbox-empty-state">
                  <div className="kommo-inbox-empty-icon">💬</div>
                  <p>Selecciona una conversación para ver mensajes</p>
                </div>
              ) : (
                <div className="kommo-inbox-detail-selected">
                  <h2>{selectedConvo.contactName || selectedConvo.leadName || "Conversación"}</h2>
                  <div className="kommo-inbox-detail-cards">
                    <div className="kommo-inbox-detail-card">
                      <span className="kommo-inbox-detail-label">Lead</span>
                      <span className="kommo-inbox-detail-value">
                        {selectedConvo.leadName || "Sin lead"}
                      </span>
                    </div>
                    <div className="kommo-inbox-detail-card">
                      <span className="kommo-inbox-detail-label">Contacto</span>
                      <span className="kommo-inbox-detail-value">
                        {selectedConvo.contactName || "Sin contacto"}
                      </span>
                    </div>
                    <div className="kommo-inbox-detail-card">
                      <span className="kommo-inbox-detail-label">Origen</span>
                      <span className="kommo-inbox-detail-value">
                        {originLabel(selectedConvo.origin)}
                      </span>
                    </div>
                    <div className="kommo-inbox-detail-card">
                      <span className="kommo-inbox-detail-label">Tipo</span>
                      <span className="kommo-inbox-detail-value">
                        {selectedConvo.talkId ? "Chat" : "CRM"}
                      </span>
                    </div>
                    <div className="kommo-inbox-detail-card">
                      <span className="kommo-inbox-detail-label">Mensajes</span>
                      <span className="kommo-inbox-detail-value">
                        {selectedConvo.totalMessages}
                      </span>
                    </div>
                    <div className="kommo-inbox-detail-card">
                      <span className="kommo-inbox-detail-label">Último mensaje</span>
                      <span className="kommo-inbox-detail-value">
                        {formatTimestamp(selectedConvo.updatedAt)}
                      </span>
                    </div>
                  </div>
                  {selectedConvo.lastMessage && (
                    <div className="kommo-inbox-last-message">
                      <span className={`kommo-inbox-direction ${selectedConvo.lastMessage.type}`}>
                        {selectedConvo.lastMessage.type === "incoming" ? "Recibido" : "Enviado"}
                      </span>
                      <span className="kommo-inbox-msg-id">
                        ID: {selectedConvo.lastMessage.id}
                      </span>
                    </div>
                  )}
                  <div className="kommo-inbox-detail-placeholder">
                    <p>Vista de mensajes próximamente...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KommoInboxPage;
