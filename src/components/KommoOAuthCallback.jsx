import React, { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { Link } from "react-router-dom";
import { auth, functions } from "../Database/firebaseConfig";

/**
 * Must match exactly what you register as Redirect URI in the Kommo integration
 * (same origin, pathname as deployed app, hash route).
 */
export function getKommoRedirectUri() {
  let path = window.location.pathname.replace(/\/$/, "") || "";
  path = path.replace(/\/index\.html$/i, "");
  return `${window.location.origin}${path}/#/kommo-oauth-callback`;
}

function parseOAuthParams() {
  const searchParams = new URLSearchParams(window.location.search);
  let code = searchParams.get("code");
  let error = searchParams.get("error");
  let errorDescription = searchParams.get("error_description");

  const hash = window.location.hash;
  if (hash.includes("?")) {
    const queryPart = hash.split("?").slice(1).join("?");
    const hp = new URLSearchParams(queryPart);
    if (!code) code = hp.get("code");
    if (!error) error = hp.get("error");
    if (!errorDescription) errorDescription = hp.get("error_description");
  }
  return { code, error, errorDescription };
}

const KommoOAuthCallback = () => {
  const [phase, setPhase] = useState("loading");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState("");
  const exchangedRef = useRef(false);

  useEffect(() => {
    const { code, error, errorDescription } = parseOAuthParams();

    if (error) {
      setPhase("oauth_error");
      setMessage("Kommo devolvió un error en la autorización.");
      setDetail(errorDescription || error);
      return;
    }

    if (!code) {
      setPhase("missing");
      setMessage("No se encontró el código de autorización (code) en la URL.");
      setDetail(
        "Comprueba que la Redirect URI en Kommo coincida exactamente con esta página, incluido el hash #/kommo-oauth-callback."
      );
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setPhase("need_auth");
        setMessage("Debes tener sesión en Firebase para completar la conexión con Kommo.");
        setDetail(
          "Inicia sesión con Google en la app (las funciones Kommo requieren Firebase Auth). Luego vuelve a autorizar la integración en Kommo."
        );
        return;
      }

      const usedKey = `kommo_oauth_code_used:${code}`;
      if (sessionStorage.getItem(usedKey)) {
        setPhase("success");
        setMessage(
          "Kommo ya estaba conectado en esta sesión (código ya procesado)."
        );
        return;
      }

      if (exchangedRef.current) return;
      exchangedRef.current = true;
      setPhase("exchanging");

      const redirectUri = getKommoRedirectUri();
      try {
        const kommoOAuth = httpsCallable(functions, "kommoOAuth");
        await kommoOAuth({ code, redirectUri });
        sessionStorage.setItem(usedKey, "1");
        setPhase("success");
        setMessage("Kommo conectado correctamente. Los tokens se guardaron en Firestore (kommo_tokens/default).");
        setDetail("");
      } catch (e) {
        setPhase("callable_error");
        const msg =
          e?.message ||
          e?.details ||
          (typeof e === "string" ? e : "Error desconocido");
        setMessage("No se pudieron guardar los tokens.");
        setDetail(String(msg));
        exchangedRef.current = false;
      }
    });

    return () => unsub();
  }, []);

  return (
    <div
      className="App"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
        Conexión Kommo
      </h1>
      {phase === "loading" || phase === "exchanging" ? (
        <p>Procesando…</p>
      ) : null}
      {phase === "success" ? (
        <p style={{ color: "#0a0", maxWidth: 480 }}>{message}</p>
      ) : null}
      {(phase === "oauth_error" ||
        phase === "missing" ||
        phase === "callable_error" ||
        phase === "need_auth") && (
        <>
          <p style={{ color: "#c00", maxWidth: 480 }}>{message}</p>
          {detail ? (
            <p style={{ fontSize: "0.9rem", opacity: 0.85, maxWidth: 520 }}>
              {detail}
            </p>
          ) : null}
        </>
      )}
      <div style={{ marginTop: "1.5rem" }}>
        <Link to="/dashboard">Volver al dashboard</Link>
        {" · "}
        <Link to="/">Ir al inicio de sesión</Link>
      </div>
    </div>
  );
};

export default KommoOAuthCallback;
