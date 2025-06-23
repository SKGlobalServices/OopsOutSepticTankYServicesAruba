import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import { ref, get, child, update, onValue } from "firebase/database";
import { database, auth, provider } from "./Database/firebaseConfig";
import { signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import logo from "./assets/img/logo.png";
import iconEyeOpen from "./assets/img/iconeye.jpg";
import iconEyeClosed from "./assets/img/iconeyeclosed.jpg";
import ReCAPTCHA from "react-google-recaptcha";

const App = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(null);
  const navigate = useNavigate();
  const recaptchaRef = useRef(null);

  // -- Función para escuchar invalidación de sesión --
  const listenForSessionInvalidation = (userKey, sessionId) => {
    const sessionRef = ref(database, `users/${userKey}/activeSession`);
    onValue(sessionRef, (snap) => {
      if (snap.exists() && snap.val() !== sessionId) {
        // Se inició sesión en otro dispositivo: cerramos esta sesión
        auth.signOut();
        localStorage.clear();
        alert(
          "Su sesión ha sido cerrada porque se inició sesión en otro dispositivo."
        );
        navigate("https://skglobalservices.github.io/OopsOutSepticTankYServicesAruba/");
      }
    });
  };

  // -- Función para sesión única en Firebase y en localStorage (solo para conductor) --
  const startSessionForUser = (userKey) => {
    const sessionId = `${userKey}_${Date.now()}`;
    const userRef = ref(database, `users/${userKey}`);
    update(userRef, { activeSession: sessionId });
    localStorage.setItem("sessionId", sessionId);
    listenForSessionInvalidation(userKey, sessionId);
  };

  // -- Bloqueo por intentar demasiadas veces --
  useEffect(() => {
    const storedBlockedUntil = localStorage.getItem("blockedUntil");
    if (storedBlockedUntil) {
      const blockTime = new Date(parseInt(storedBlockedUntil, 10));
      if (new Date() < blockTime) {
        setBlockedUntil(blockTime);
      } else {
        localStorage.removeItem("blockedUntil");
      }
    }
  }, []);

  useEffect(() => {
    let interval;
    if (blockedUntil && new Date() < blockedUntil) {
      interval = setInterval(() => {
        const secondsRemaining = Math.ceil(
          (blockedUntil - new Date()) / 1000
        );
        if (secondsRemaining > 0) {
          setMessage(
            `Dispositivo bloqueado. Intente nuevamente en ${secondsRemaining} segundos.`
          );
        } else {
          setBlockedUntil(null);
          localStorage.removeItem("blockedUntil");
          setMessage("");
          clearInterval(interval);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [blockedUntil]);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  // -- Login con Google --
  const handleGoogleLogin = async () => {
    if (blockedUntil && new Date() < blockedUntil) {
      const sec = Math.ceil((blockedUntil - new Date()) / 1000);
      setMessage(
        `Dispositivo bloqueado. Intente nuevamente en ${sec} segundos.`
      );
      return;
    }

    try {
      const result = await signInWithPopup(auth, provider);
      const { email: emailFromGoogle } = result.user;

      const dbRef = ref(database);
      const snapshot = await get(child(dbRef, "users"));
      if (!snapshot.exists()) {
        setMessage("No se encontraron usuarios en la base de datos.");
        return;
      }

      const users = snapshot.val();
      const entry = Object.entries(users).find(
        ([, u]) => u.email === emailFromGoogle
      );
      if (!entry) {
        setMessage("El usuario no está registrado en el sistema.");
        return;
      }

      const [userKey, userFound] = entry;
      localStorage.setItem(
        "user",
        JSON.stringify({ ...userFound, id: userKey })
      );
      localStorage.setItem(
        "isAdmin",
        userFound.role.toLowerCase() === "admin" ? "true" : "false"
      );

      // Si es conductor, iniciamos sesión única
      if (userFound.role.toLowerCase() === "user") {
        startSessionForUser(userKey);
      }

      // Navegación según rol
      switch (userFound.role.toLowerCase()) {
        case "admin":
          navigate("/agendaexpress");
          break;
        case "user":
          navigate("/agendadeldiausuario");
          break;
        case "contador":
          navigate("/agendadinamicacontador");
          break;
        default:
          setMessage("Rol no identificado");
      }
    } catch (error) {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      if (attempts >= 5) {
        const blockTime = new Date(Date.now() + 5 * 60 * 1000);
        setBlockedUntil(blockTime);
        localStorage.setItem("blockedUntil", blockTime.getTime().toString());
        setMessage("Dispositivo bloqueado. Intente nuevamente en 300 segundos.");
      } else {
        setMessage("Ocurrió un error durante el login con Google.");
      }
      console.error("Error en login con Google:", error);
    }
  };

  // -- Login con email y contraseña --
  const handleLogin = async (token) => {
    try {
      const dbRef = ref(database);
      const snapshot = await get(child(dbRef, "users"));
      if (!snapshot.exists()) {
        setMessage("No se encontraron usuarios en la base de datos.");
        return;
      }

      const users = snapshot.val();
      const entry = Object.entries(users).find(
        ([, u]) => u.email === email && u.password === password
      );
      if (!entry) {
        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        if (attempts >= 5) {
          const blockTime = new Date(Date.now() + 5 * 60 * 1000);
          setBlockedUntil(blockTime);
          localStorage.setItem("blockedUntil", blockTime.getTime().toString());
          setMessage("Dispositivo bloqueado. Intente nuevamente en 300 segundos.");
        } else {
          setMessage("Correo o contraseña inválidos.");
        }
        return;
      }

      const [userKey, userFound] = entry;
      localStorage.setItem(
        "user",
        JSON.stringify({ ...userFound, id: userKey })
      );
      localStorage.setItem(
        "isAdmin",
        userFound.role.toLowerCase() === "admin" ? "true" : "false"
      );

      // Si es conductor, iniciamos sesión única
      if (userFound.role.toLowerCase() === "user") {
        startSessionForUser(userKey);
      }

      switch (userFound.role.toLowerCase()) {
        case "admin":
          navigate("/agendaexpress");
          break;
        case "user":
          navigate("/agendadeldiausuario");
          break;
        case "contador":
          navigate("/agendadinamicacontador");
          break;
        default:
          setMessage("Rol no identificado");
      }
    } catch (error) {
      console.error("Error en login:", error);
      setMessage("Ocurrió un error durante el login.");
    }
  };

  // -- Submit del formulario --
  const onSubmit = async (e) => {
    e.preventDefault();
    if (blockedUntil && new Date() < blockedUntil) {
      const sec = Math.ceil((blockedUntil - new Date()) / 1000);
      setMessage(
        `Dispositivo bloqueado. Intente nuevamente en ${sec} segundos.`
      );
      return;
    }
    setMessage("");
    if (!recaptchaRef.current) {
      setMessage("No se pudo validar el captcha.");
      return;
    }
    try {
      const token = await recaptchaRef.current.executeAsync();
      recaptchaRef.current.reset();
      await handleLogin(token);
    } catch (error) {
      console.error("Error al ejecutar reCAPTCHA:", error);
      setMessage("La verificación del captcha falló.");
    }
  };

  return (
    <div className="App">
      <div className="form-container text-center">
        <h1>
          <img src={logo} alt="Logo" id="logologin" />
        </h1>
        <form onSubmit={onSubmit} className="form-login" id="demo-form">
          <div className="input-group">
            <label
              style={{ fontWeight: "bold", fontSize: "20px" }}
              htmlFor="email"
            >
              Inicio De Sesión
            </label>
          </div>
          <div className="input-group">
            <input
              type="email"
              id="email"
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={blockedUntil && new Date() < blockedUntil}
            />
          </div>
          <div className="input-group">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={blockedUntil && new Date() < blockedUntil}
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              id="toggle-password"
              disabled={blockedUntil && new Date() < blockedUntil}
            >
              <img
                src={showPassword ? iconEyeClosed : iconEyeOpen}
                alt={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                id="iconeye"
              />
            </button>
          </div>
          <button
            id="passwordbutton"
            type="submit"
            disabled={blockedUntil && new Date() < blockedUntil}
          >
            Iniciar Sesión
          </button>
        </form>
        <button id="google-login-button" onClick={handleGoogleLogin}>
          <img
            id="logo-google-icon"
            src={require("./assets/img/google.png")}
            alt="Google Icon"
          />
          Ingresar Con Google
        </button>
        {message && <p className="danger">{message}</p>}
      </div>
      <ReCAPTCHA
        sitekey="6LdtjvEqAAAAAIYf7TbTFeLMjE3mCbgbt95hs3sE"
        size="invisible"
        ref={recaptchaRef}
      />
    </div>
  );
};

export default App;
