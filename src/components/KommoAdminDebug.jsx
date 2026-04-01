import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import Slidebar from "./Slidebar";
import { auth, functions } from "../Database/firebaseConfig";
import { decryptData } from "../utils/security";

const KommoAdminDebug = () => {
  const navigate = useNavigate();
  const user = useMemo(
    () => decryptData(localStorage.getItem("user")) || {},
    []
  );
  const isAdmin =
    localStorage.getItem("isAdmin") === "true" &&
    String(user.role || "").toLowerCase() === "admin";

  const [leadId, setLeadId] = useState("");
  const [talkId, setTalkId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [messageText, setMessageText] = useState("Prueba de conexión desde la app.");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user.role) {
      navigate("/");
    }
  }, [user.role, navigate]);

  const canTry =
    isAdmin &&
    (firebaseUser || process.env.NODE_ENV === "development");

  const handleTest = async () => {
    const nLead = leadId.trim() === "" ? NaN : Number(leadId);
    const nTalk = talkId.trim() === "" ? NaN : Number(talkId);
    const conv = conversationId.trim();
    const hasLead = Number.isFinite(nLead) && nLead > 0;
    const hasTalk = Number.isFinite(nTalk) && nTalk > 0;
    const hasConv = conv.length > 0;
    if (!hasLead && !hasTalk && !hasConv) {
      setStatus({
        ok: false,
        text: "Indica al menos uno: Lead ID, Talk ID o Conversation ID.",
      });
      return;
    }
    if (!firebaseUser && process.env.NODE_ENV !== "development") {
      setStatus({
        ok: false,
        text: "Inicia sesión con Google para que las funciones callable envíen tu identidad de Firebase.",
      });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const kommoSendMessage = httpsCallable(functions, "kommoSendMessage");
      const payload = {
        message: messageText || " ",
        ...(hasLead ? { leadId: nLead } : {}),
        ...(hasTalk ? { talkId: nTalk } : {}),
        ...(hasConv ? { conversationId: conv } : {}),
      };
      const res = await kommoSendMessage(payload);
      setStatus({
        ok: true,
        text: `Enviado. Respuesta: ${JSON.stringify(res.data)}`,
      });
    } catch (e) {
      setStatus({
        ok: false,
        text: e?.message || String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="homepage-container">
        <Slidebar />
        <p style={{ padding: "2rem" }}>No autorizado.</p>
      </div>
    );
  }

  return (
    <div className="homepage-container">
      <Slidebar />
      <div style={{ padding: "1.5rem", maxWidth: 560 }}>
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
          Kommo (admin / prueba)
        </h1>
        <p style={{ fontSize: "0.95rem", marginBottom: "1rem" }}>
          Verifica en Firebase: <code>kommo_tokens/default</code>, historial en{" "}
          <code>kommo_messages/…/messages</code>, deduplicación de webhooks en{" "}
          <code>kommo_webhook_dedup</code>. La respuesta de envío incluye{" "}
          <code>delivery</code> (<code>amojo</code> = WhatsApp/canal real,{" "}
          <code>crm_note</code> = nota en el lead). Los tokens no se muestran en el
          navegador.
        </p>
        {!firebaseUser && process.env.NODE_ENV !== "development" ? (
          <p style={{ color: "#a60", marginBottom: "1rem" }}>
            No hay sesión de Firebase Auth. Usa &quot;Ingresar con Google&quot; en
            el login para probar <code>kommoSendMessage</code>.
          </p>
        ) : null}
        <label style={{ display: "block", marginBottom: "0.35rem" }}>
          Lead ID (Kommo) — opcional si usas Talk o Conversation
        </label>
        <input
          type="number"
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
          style={{ width: "100%", marginBottom: "0.75rem", padding: "0.35rem" }}
          placeholder="ej. 12345"
        />
        <label style={{ display: "block", marginBottom: "0.35rem" }}>
          Talk ID (Kommo)
        </label>
        <input
          type="number"
          value={talkId}
          onChange={(e) => setTalkId(e.target.value)}
          style={{ width: "100%", marginBottom: "0.75rem", padding: "0.35rem" }}
          placeholder="opcional — de la conversación en Kommo"
        />
        <label style={{ display: "block", marginBottom: "0.35rem" }}>
          Conversation ID (Chats / Amojo)
        </label>
        <input
          type="text"
          value={conversationId}
          onChange={(e) => setConversationId(e.target.value)}
          style={{ width: "100%", marginBottom: "0.75rem", padding: "0.35rem" }}
          placeholder="opcional — si ya conoces el id de conversación"
        />
        <label style={{ display: "block", marginBottom: "0.35rem" }}>
          Mensaje
        </label>
        <textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          rows={3}
          style={{ width: "100%", marginBottom: "0.75rem", padding: "0.35rem" }}
        />
        <button
          type="button"
          className="btn-agendar2"
          onClick={handleTest}
          disabled={busy || !canTry}
          style={{ opacity: canTry ? 1 : 0.6 }}
        >
          {busy ? "Enviando…" : "Probar conexión Kommo"}
        </button>
        {status ? (
          <p
            style={{
              marginTop: "1rem",
              color: status.ok ? "#070" : "#a00",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {status.text}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default KommoAdminDebug;
