import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import "./App.css";
import {
  ref,
  get,
  child,
  update,
  onValue,
  query,
  orderByChild,
  equalTo,
} from "firebase/database";
import { database, auth, provider } from "./Database/firebaseConfig";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import logo from "./assets/img/logo.png";
import iconEyeOpen from "./assets/img/iconeye.jpg";
import iconEyeClosed from "./assets/img/iconeyeclosed.jpg";
import ReCAPTCHA from "react-google-recaptcha";
import Swal from "sweetalert2";
import { userCache } from "./utils/userCache";
import { debounce } from "./utils/debounce";
import LoadingScreen from "./components/LoadingScreen";
import { useGlobalLoading, setGlobalLoading } from "./utils/useGlobalLoading";
import {
  sanitizeForLog,
  validateEmail,
  validatePassword,
  encryptData,
  decryptData,
  checkRateLimit,
} from "./utils/security";
import {
  initInactivityDetection,
  clearInactivityTimer,
} from "./utils/sessionTimeout";

const App = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(null);
  const [showRecaptcha, setShowRecaptcha] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const recaptchaRef = useRef(null);
  const emailRef = useRef(null);
  const globalLoading = useGlobalLoading();

  // === Helper centralizado para el Swal de plataforma cerrada
  const showClosedSwal = useCallback(() => {
    Swal.fire({
      icon: "warning",
      title: "Plataforma Cerrada",
      text: "La plataforma está cerrada de 11:30 PM a 1:00 AM. Vuelve después de la 1:00 AM.",
      confirmButtonText: "Entendido",
    });
  }, []);

  // Logout por inactividad
  const handleInactivityLogout = useCallback(async () => {
    const userData = decryptData(localStorage.getItem("user"));
    if (userData && userData.id && userData.role?.toLowerCase() === "user") {
      try {
        const userRef = ref(database, `users/${userData.id}`);
        await update(userRef, { activeSession: null });
      } catch (error) {
        console.error(
          "Error al limpiar sesión por inactividad:",
          sanitizeForLog(error.message)
        );
      }
    }
    localStorage.clear();
    clearInactivityTimer();
    alert("Sesión cerrada por inactividad (1 hora)");
    navigate("/");
  }, [navigate]);

  // Procesar usuario de Google autenticado
  const processGoogleUser = useCallback(
    async (user) => {
      const { email: emailFromGoogle } = user;

      if (!emailFromGoogle) {
        setMessage("No se pudo obtener el email de Google.");
        return;
      }

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
      const userData = { ...userFound, id: userKey };
      localStorage.setItem("user", encryptData(userData));
      localStorage.setItem(
        "isAdmin",
        userFound.role.toLowerCase() === "admin" ? "true" : "false"
      );

      if (userFound.role.toLowerCase() === "user") {
        startSessionForUser(userKey);
        initInactivityDetection(handleInactivityLogout);
      }

      setGlobalLoading(true);
      setTimeout(() => {
        sessionStorage.setItem("navigated", "true");
        switch (userFound.role.toLowerCase()) {
          case "admin":
            navigate("/dashboard");
            break;
          case "user":
            navigate("/agendadeldiausuario");
            break;
          case "contador":
            navigate("/agendadinamicacontador");
            break;
          default:
            setMessage("Rol no identificado");
            setGlobalLoading(false);
        }
      }, 500);
    },
    [navigate, handleInactivityLogout]
  );

  // Verificar resultado de redirect de Google solo si hay navegación pendiente
  useEffect(() => {
    const checkRedirectResult = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hasAuthParams =
        urlParams.has("code") ||
        urlParams.has("state") ||
        window.location.hash.includes("access_token");
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone;

      // En apps instaladas, reducir verificaciones
      if (isStandalone && !hasAuthParams) return;
      if (!isStandalone && !hasAuthParams) return;

      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          await processGoogleUser(result.user);
        }
      } catch (error) {
        console.error("Error procesando redirect de Google:", error);
        setMessage("Error al procesar login de Google.");
      }
    };

    // Retrasar en apps instaladas para evitar congelamiento
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone;
    if (isStandalone) {
      setTimeout(checkRedirectResult, 500);
    } else {
      checkRedirectResult();
    }
  }, [processGoogleUser]);

  // Mostrar pantalla de carga inicial
  useEffect(() => {
    const hasNavigated = sessionStorage.getItem("navigated");
    const isLoginPage =
      window.location.pathname === "/" || window.location.hash === "#/";
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone;

    if (!hasNavigated && (isLoginPage || isStandalone)) {
      setGlobalLoading(true);

      const minLoadTime = isStandalone ? 2000 : 3000;
      const startTime = Date.now();

      const hideLoading = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minLoadTime - elapsed);

        setTimeout(() => {
          setGlobalLoading(false);
        }, remaining);
      };

      // En apps instaladas, forzar carga inmediata
      if (isStandalone || document.readyState === "complete") {
        setTimeout(hideLoading, 100);
      } else {
        window.addEventListener("load", hideLoading);
      }

      return () => window.removeEventListener("load", hideLoading);
    }
  }, []);

  // Debounced validation
  const debouncedEmailValidation = useMemo(
    () =>
      debounce((email) => {
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setMessage("Formato de email inválido");
        } else {
          setMessage("");
        }
      }, 500),
    []
  );

  // Cerrar plataforma exactamente de 23:30 a 01:00
  // Cerrada de 23:30 a 01:00 (excluyendo 01:00)
  const isPlatformClosed = () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    if (h === 23 && m >= 30) return true; // 23:30–23:59
    if (h === 0) return true; // 00:00–00:59
    return false; // 01:00 ya abre
  };

  // Función para escuchar invalidación de sesión
  const listenForSessionInvalidation = (userKey, sessionId) => {
    const sessionRef = ref(database, `users/${userKey}/activeSession`);
    onValue(sessionRef, (snap) => {
      if (snap.exists() && snap.val() !== sessionId) {
        setTimeout(() => {
          const currentSessionId = localStorage.getItem("sessionId");
          if (snap.val() !== currentSessionId) {
            auth.signOut();
            localStorage.clear();
            alert(
              "Su sesión ha sido cerrada porque se inició sesión en otro dispositivo."
            );
            navigate(
              "https://skglobalservices.github.io/OopsOutSepticTankYServicesAruba/"
            );
          }
        }, 2000);
      }
    });
  };

  // Limpiar sesión al cerrar pestaña/navegador
  const cleanupSession = useCallback(async () => {
    const userData = decryptData(localStorage.getItem("user"));
    if (userData && userData.id && userData.role?.toLowerCase() === "user") {
      try {
        const userRef = ref(database, `users/${userData.id}`);
        await update(userRef, { activeSession: null });
      } catch (error) {
        console.error(
          "Error al limpiar sesión:",
          sanitizeForLog(error.message)
        );
      }
    }
  }, []);

  // Inicio de sesión único
  const startSessionForUser = async (userKey) => {
    const sessionId = `${userKey}_${Date.now()}`;
    const userRef = ref(database, `users/${userKey}`);
    try {
      localStorage.setItem("sessionId", sessionId);
      await update(userRef, { activeSession: sessionId });

      window.addEventListener("beforeunload", cleanupSession);
      window.addEventListener("unload", cleanupSession);

      setTimeout(() => {
        listenForSessionInvalidation(userKey, sessionId);
      }, 1000);
    } catch (updErr) {
      console.error("No se pudo actualizar la sesión:", updErr);
      setMessage("Error de servidor al iniciar sesión.");
    }
  };

  // Bloqueo por intentar demasiadas veces
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
        const secondsRemaining = Math.ceil((blockedUntil - new Date()) / 1000);
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

  // Auto-focus en campo email
  useEffect(() => {
    if (emailRef.current && !blockedUntil && !isPlatformClosed()) {
      emailRef.current.focus();
    }
  }, [blockedUntil]);

  // Mostrar alerta si la plataforma está cerrada al hacer click en inputs o botones
  const handleInputClick = () => {
    if (isPlatformClosed()) {
      showClosedSwal();
    }
  };

  // Mostrar alerta si la plataforma está cerrada al hacer click en botones
  const handleButtonClick = (e) => {
    if (isPlatformClosed()) {
      e.preventDefault();
      showClosedSwal();
    }
  };

  // Limpiar listeners al desmontar
  useEffect(() => {
    return () => {
      window.removeEventListener("beforeunload", cleanupSession);
      window.removeEventListener("unload", cleanupSession);
    };
  }, [cleanupSession]);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  // Login con Google
  const handleGoogleLogin = async () => {
    if (isPlatformClosed()) {
      showClosedSwal();
      setMessage("La plataforma está cerrada. Vuelve después de la 1:00 AM.");
      return;
    }
    if (blockedUntil && new Date() < blockedUntil) {
      const sec = Math.ceil((blockedUntil - new Date()) / 1000);
      setMessage(
        `Dispositivo bloqueado. Intente nuevamente en ${sec} segundos.`
      );
      return;
    }

    setMessage("");

    try {
      const result = await signInWithPopup(auth, provider);

      if (!result || !result.user) {
        setMessage("No se pudo obtener información del usuario de Google.");
        return;
      }

      await processGoogleUser(result.user);
    } catch (error) {
      console.error("Error en login con Google:", error);

      if (error.code === "auth/popup-closed-by-user") {
        setMessage("Login cancelado. Intentando método alternativo...");
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectError) {
          console.error("Error con redirect:", redirectError);
          setMessage("Error al iniciar sesión con Google. Intente nuevamente.");
        }
      } else if (error.code === "auth/popup-blocked") {
        setMessage("Popup bloqueado. Usando método alternativo...");
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectError) {
          console.error("Error con redirect:", redirectError);
          setMessage("Permita popups para este sitio o intente nuevamente.");
        }
      } else if (error.code === "auth/cancelled-popup-request") {
        setMessage("Solicitud cancelada. Intente nuevamente.");
      } else {
        setMessage(`Error al iniciar sesión con Google: ${error.message}`);
      }
    }
  };

  // Login con email y contraseña
  const handleLogin = async (token) => {
    if (!validateEmail(email)) {
      setMessage("Email inválido");
      return;
    }

    if (!checkRateLimit(email)) {
      setMessage("Demasiados intentos. Espere 15 minutos.");
      return;
    }

    setIsLoading(true);

    Swal.fire({
      title: "Verificando...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const dbRef = ref(database);
      const snapshot = await get(child(dbRef, "users"));

      if (!snapshot.exists()) {
        setIsLoading(false);
        Swal.close();
        setMessage("No se encontraron usuarios en la base de datos.");
        return;
      }

      const users = snapshot.val();
      const entry = Object.entries(users).find(
        ([, u]) => u.email === email && u.password === password
      );

      if (!entry) {
        setIsLoading(false);
        Swal.close();

        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        if (attempts >= 5) {
          const blockTime = new Date(Date.now() + 5 * 60 * 1000);
          setBlockedUntil(blockTime);
          localStorage.setItem("blockedUntil", blockTime.getTime().toString());
          setMessage(
            "Dispositivo bloqueado. Intente nuevamente en 300 segundos."
          );
        } else {
          setMessage("Correo o contraseña inválidos.");
        }
        return;
      }

      const [userKey, userFound] = entry;
      const userData = { ...userFound, id: userKey };

      userCache.set(email, userData);

      localStorage.setItem("user", encryptData(userData));
      localStorage.setItem(
        "isAdmin",
        userFound.role.toLowerCase() === "admin" ? "true" : "false"
      );

      if (userFound.role.toLowerCase() === "user") {
        startSessionForUser(userKey);
        initInactivityDetection(handleInactivityLogout);
      }

      setIsLoading(false);

      Swal.fire({
        icon: "success",
        title: "Login exitoso",
        timer: 500,
        showConfirmButton: false,
      }).then(() => {
        setGlobalLoading(true);
        sessionStorage.setItem("navigated", "true");
        switch (userFound.role.toLowerCase()) {
          case "admin":
            navigate("/dashboard");
            break;
          case "user":
            navigate("/agendadeldiausuario");
            break;
          case "contador":
            navigate("/agendadinamicacontador");
            break;
          default:
            setMessage("Rol no identificado");
            setGlobalLoading(false);
        }
      });
    } catch (error) {
      setIsLoading(false);
      Swal.close();
      console.error("Error en login:", error);
      setMessage("Ocurrió un error durante el login.");
    }
  };

  // Submit del formulario
  const onSubmit = async (e) => {
    e.preventDefault();
    if (isPlatformClosed()) {
      showClosedSwal();
      setMessage("La plataforma está cerrada. Vuelve después de la 1:00 AM.");
      return;
    }
    if (blockedUntil && new Date() < blockedUntil) {
      const sec = Math.ceil((blockedUntil - new Date()) / 1000);
      setMessage(
        `Dispositivo bloqueado. Intente nuevamente en ${sec} segundos.`
      );
      return;
    }
    setMessage("");

    if (!showRecaptcha) {
      setShowRecaptcha(true);
      setTimeout(async () => {
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
      }, 100);
      return;
    }

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
      {globalLoading && <LoadingScreen />}
      <div className="form-container text-center">
        <h1>
          <img src={logo} alt="Logo" id="logologin" />
        </h1>
        <form onSubmit={onSubmit} className="form-login" id="demo-form">
          <div className="input-group">
            <input
              style={{
                cursor:
                  isLoading ||
                  (blockedUntil && new Date() < blockedUntil) ||
                  isPlatformClosed()
                    ? "default" // cursor normal cuando está bloqueado/cerrado
                    : "text", // cursor normal de input cuando está activo
              }}
              ref={emailRef}
              type="email"
              id="email"
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onClick={handleInputClick}
              required
              // No deshabilitar por cierre; usar readOnly
              disabled={
                isLoading || (blockedUntil && new Date() < blockedUntil)
              }
              readOnly={isPlatformClosed()}
            />
          </div>
          <div className="input-group">
            <input
              style={{
                cursor:
                  (blockedUntil && new Date() < blockedUntil) ||
                  isPlatformClosed()
                    ? "default"
                    : "text",
              }}
              type={showPassword ? "text" : "password"}
              id="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onClick={handleInputClick}
              required
              // No deshabilitar por cierre; usar readOnly
              disabled={blockedUntil && new Date() < blockedUntil}
              readOnly={isPlatformClosed()}
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              id="toggle-password"
              // No bloquear por cierre; solo por loading/bloqueo
              disabled={
                isLoading || (blockedUntil && new Date() < blockedUntil)
              }
            >
              <img
                src={showPassword ? iconEyeClosed : iconEyeOpen}
                alt={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                id="iconeye"
              />
            </button>
          </div>
          <button
            id="passwordbutton"
            type="submit"
            onClick={handleButtonClick}
            // No deshabilitar por cierre; el handler muestra el Swal
            disabled={isLoading || (blockedUntil && new Date() < blockedUntil)}
          >
            {isLoading ? "Verificando..." : "Iniciar Sesión"}
          </button>
        </form>
        <button
          id="google-login-button"
          onClick={(e) => {
            handleButtonClick(e);
            if (!isPlatformClosed()) {
              handleGoogleLogin();
            } else {
              showClosedSwal();
            }
          }}
          // No deshabilitar por cierre; el handler lo controla
          disabled={blockedUntil && new Date() < blockedUntil}
        >
          <img
            id="logo-google-icon"
            src={require("./assets/img/google.png")}
            alt="Google Icon"
          />
          Ingresar Con Google
        </button>
        {message && <p className="danger">{message}</p>}
      </div>
      {showRecaptcha && (
        <ReCAPTCHA
          sitekey="6LdtjvEqAAAAAIYf7TbTFeLMjE3mCbgbt95hs3sE"
          size="invisible"
          ref={recaptchaRef}
          onErrored={() => {
            console.error("🔴 reCAPTCHA error al cargar");
            setMessage("Error cargando reCAPTCHA. Revisa tu conexión.");
          }}
          onExpired={() => {
            console.warn("⚠️ reCAPTCHA expirado");
            if (recaptchaRef.current) recaptchaRef.current.reset();
            setMessage("El captcha expiró. Intenta de nuevo.");
          }}
        />
      )}
    </div>
  );
};

export default App;
