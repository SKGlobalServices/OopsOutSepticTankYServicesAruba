import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import "./App.css";
import { ref, get, child, update, onValue, query, orderByChild, equalTo } from "firebase/database";
import { database, auth, provider } from "./Database/firebaseConfig";
import { signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import logo from "./assets/img/logo.png";
import iconEyeOpen from "./assets/img/iconeye.jpg";
import iconEyeClosed from "./assets/img/iconeyeclosed.jpg";
import ReCAPTCHA from "react-google-recaptcha";
import Swal from "sweetalert2";
import { userCache } from './utils/userCache';
import { debounce } from './utils/debounce';
import LoadingScreen from './components/LoadingScreen';
import { useGlobalLoading, setGlobalLoading } from './utils/useGlobalLoading';
import { sanitizeForLog, validateEmail, validatePassword, encryptData, decryptData, checkRateLimit } from './utils/security';
import { initInactivityDetection, clearInactivityTimer } from './utils/sessionTimeout';

const App = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(null);
  const [showRecaptcha, setShowRecaptcha] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const recaptchaRef = useRef(null);
  const emailRef = useRef(null);
  const globalLoading = useGlobalLoading();
  
  // Mostrar pantalla de carga inicial solo si no se ha navegado antes
  useEffect(() => {
    const hasNavigated = sessionStorage.getItem('navigated');
    if (!hasNavigated) {
      setGlobalLoading(true);
      
      const minLoadTime = 4000;
      const startTime = Date.now();
      
      const hideLoading = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minLoadTime - elapsed);
        
        setTimeout(() => {
          setGlobalLoading(false);
        }, remaining);
      };
      
      if (document.readyState === 'complete') {
        hideLoading();
      } else {
        window.addEventListener('load', hideLoading);
      }
      
      return () => window.removeEventListener('load', hideLoading);
    }
  }, []);
  
  // Debounced validation
  const debouncedEmailValidation = useMemo(
    () => debounce((email) => {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setMessage('Formato de email inválido');
      } else {
        setMessage('');
      }
    }, 500),
    []
  );

  // // Cerrar plataforma de 11pm a 12am
  const isPlatformClosed = () => {
    const now = new Date();
    return now.getHours() === 23; // true si son entre 23:00 y 00:00
  };

  // -- Función para escuchar invalidación de sesión --
  const listenForSessionInvalidation = (userKey, sessionId) => {
    const sessionRef = ref(database, `users/${userKey}/activeSession`);
    onValue(sessionRef, (snap) => {
      if (snap.exists() && snap.val() !== sessionId) {
        // Esperar y verificar de nuevo para evitar falsos positivos
        setTimeout(() => {
          const currentSessionId = localStorage.getItem("sessionId");
          if (snap.val() !== currentSessionId) {
            // Se inició sesión en otro dispositivo: cerramos esta sesión
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

  // Logout por inactividad
  const handleInactivityLogout = useCallback(async () => {
    const userData = decryptData(localStorage.getItem("user"));
    if (userData && userData.id && userData.role?.toLowerCase() === "user") {
      try {
        const userRef = ref(database, `users/${userData.id}`);
        await update(userRef, { activeSession: null });
      } catch (error) {
        console.error("Error al limpiar sesión por inactividad:", sanitizeForLog(error.message));
      }
    }
    localStorage.clear();
    clearInactivityTimer();
    alert("Sesión cerrada por inactividad (1 hora)");
    navigate("/");
  }, [navigate]);

  // Limpiar sesión al cerrar pestaña/navegador
  const cleanupSession = useCallback(async () => {
    const userData = decryptData(localStorage.getItem("user"));
    if (userData && userData.id && userData.role?.toLowerCase() === "user") {
      try {
        const userRef = ref(database, `users/${userData.id}`);
        await update(userRef, { activeSession: null });
      } catch (error) {
        console.error("Error al limpiar sesión:", sanitizeForLog(error.message));
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
      
      // Limpiar sesión al cerrar pestaña
      window.addEventListener('beforeunload', cleanupSession);
      window.addEventListener('unload', cleanupSession);
      
      // Delay para evitar race condition
      setTimeout(() => {
        listenForSessionInvalidation(userKey, sessionId);
      }, 1000);
    } catch (updErr) {
      console.error("No se pudo actualizar la sesión:", updErr);
      setMessage("Error de servidor al iniciar sesión.");
    }
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
  
  // Registrar Service Worker
  useEffect(() => {
    // Desactivado temporalmente para evitar errores MIME
    // if ('serviceWorker' in navigator) {
    //   navigator.serviceWorker.register('/sw.js')
    //     .then(() => console.log('SW registrado'))
    //     .catch(() => {});
    // }
  }, []);

  // Limpiar listeners al desmontar
  useEffect(() => {
    return () => {
      window.removeEventListener('beforeunload', cleanupSession);
      window.removeEventListener('unload', cleanupSession);
    };
  }, [cleanupSession]);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  // -- Login con Google --
  const handleGoogleLogin = async () => {
    if (isPlatformClosed()) {
      setMessage("La plataforma está cerrada. Vuelva después de las 12:00 AM.");
      return;
    }
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
      const userData = { ...userFound, id: userKey };
      localStorage.setItem("user", encryptData(userData));
      localStorage.setItem(
        "isAdmin",
        userFound.role.toLowerCase() === "admin" ? "true" : "false"
      );

      // Si es conductor, iniciamos sesión única e inactividad
      if (userFound.role.toLowerCase() === "user") {
        startSessionForUser(userKey);
        initInactivityDetection(handleInactivityLogout);
      }

      // Navegación según rol con pantalla de carga
      setGlobalLoading(true);
      setTimeout(() => {
        sessionStorage.setItem('navigated', 'true');
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
            setGlobalLoading(false);
        }
      }, 500);
    } catch (error) {
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
        setMessage("Ocurrió un error durante el login con Google.");
      }
      console.error("Error en login con Google:", error);
    }
  };

  // -- Login con email y contraseña --
  const handleLogin = async (token) => {
    // Validaciones de seguridad
    if (!validateEmail(email)) {
      setMessage("Email inválido");
      return;
    }

    if (!checkRateLimit(email)) {
      setMessage("Demasiados intentos. Espere 15 minutos.");
      return;
    }
    
    // Verificar cache primero
    const cachedUser = userCache.get(email);
    if (cachedUser && cachedUser.password === password) {
      localStorage.setItem("user", encryptData(cachedUser));
      localStorage.setItem("isAdmin", cachedUser.role.toLowerCase() === "admin" ? "true" : "false");
      
      if (cachedUser.role.toLowerCase() === "user") {
        startSessionForUser(cachedUser.id);
        initInactivityDetection(handleInactivityLogout);
      }
      
      setGlobalLoading(true);
      setTimeout(() => {
        sessionStorage.setItem('navigated', 'true');
        switch (cachedUser.role.toLowerCase()) {
          case "admin": navigate("/agendaexpress"); break;
          case "user": navigate("/agendadeldiausuario"); break;
          case "contador": navigate("/agendadinamicacontador"); break;
          default: 
            setMessage("Rol no identificado");
            setGlobalLoading(false);
        }
      }, 500);
      return;
    }
    
    setIsLoading(true);
    
    // SweetAlert simple y confiable
    Swal.fire({
      title: 'Verificando...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      // Revertir a consulta original temporalmente
      const dbRef = ref(database);
      const snapshot = await get(child(dbRef, "users"));
      
      if (!snapshot.exists()) {
        setIsLoading(false);
        Swal.close();
        setMessage("No se encontraron usuarios en la base de datos.");
        return;
      }

      const users = snapshot.val();
      console.log('Login attempt initiated');
      
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
      
      // Guardar en cache
      userCache.set(email, userData);
      
      localStorage.setItem("user", encryptData(userData));
      localStorage.setItem("isAdmin", userFound.role.toLowerCase() === "admin" ? "true" : "false");

      // Si es conductor, iniciamos sesión única e inactividad
      if (userFound.role.toLowerCase() === "user") {
        startSessionForUser(userKey);
        initInactivityDetection(handleInactivityLogout);
      }

      setIsLoading(false);
      
      // Forzar cierre del SweetAlert
      Swal.fire({
        icon: 'success',
        title: 'Login exitoso',
        timer: 500,
        showConfirmButton: false
      }).then(() => {
        setGlobalLoading(true);
        sessionStorage.setItem('navigated', 'true');
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

  // -- Submit del formulario --
  const onSubmit = async (e) => {
    e.preventDefault();
    if (isPlatformClosed()) {
      setMessage("La plataforma está cerrada. Vuelva después de las 12:00 AM.");
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
    
    // Lazy load reCAPTCHA
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

  //  variable disabledAll
  const disabledAll =
    (blockedUntil && new Date() < blockedUntil) || isPlatformClosed();

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
              ref={emailRef}
              type="email"
              id="email"
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={
                isLoading ||
                (blockedUntil && new Date() < blockedUntil) ||
                isPlatformClosed()
              }
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
              disabled={
                (blockedUntil && new Date() < blockedUntil) 
                ||
                isPlatformClosed()
              }
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              id="toggle-password"
              disabled={
                isLoading ||
                (blockedUntil && new Date() < blockedUntil) ||
                isPlatformClosed()
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
            disabled={
              isLoading ||
              (blockedUntil && new Date() < blockedUntil) ||
              isPlatformClosed()
            }
          >
            {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>
        <button
          id="google-login-button"
          onClick={handleGoogleLogin}
          disabled={
            (blockedUntil && new Date() < blockedUntil) 
            || isPlatformClosed()
          }
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
          asyncScriptOnLoad={() => console.log("reCAPTCHA listo")}
          onErrored={() => {
            console.error("🔴 reCAPTCHA error al cargar");
            setMessage("Error cargando reCAPTCHA. Revisa tu conexión.");
          }}
          onExpired={() => {
            console.warn("⚠️ reCAPTCHA expirado");
            recaptchaRef.current.reset();
            setMessage("El captcha expiró. Intenta de nuevo.");
          }}

        />
      )}
    </div>
  );
};

export default App;
