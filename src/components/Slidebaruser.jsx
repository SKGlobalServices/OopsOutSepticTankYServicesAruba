import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { database } from "../Database/firebaseConfig";
import { ref, update } from "firebase/database";
import { decryptData } from "../utils/security";
import Swal from "sweetalert2";
import agendarIcon2 from "../assets/img/agendarIcon2.png";
import servicioHoyIcon2 from "../assets/img/servicioHoyIcon2.png";
import servicioMananaIcon2 from "../assets/img/servicioMananaIcon2.png";
import informeEfectivoIcon2 from "../assets/img/informeEfectivoIcon2.png";
import logoutIcon2 from "../assets/img/logoutIcon2.png";
import barraIcon from "../assets/img/barra_icon.jpg";
import logo from "../assets/img/logosolo.png";

const Slidebaruser = () => {
  const navigate = useNavigate();
  const [showSlidebar, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const user = useMemo(
      () => decryptData(localStorage.getItem("user")) || {},
      []
    );

  useEffect(() => {
    if (!user || !user.role) {
      navigate("/");
      return;
    }
    if (user.role === "admin") {
      navigate("/agendaexpress");
    } else if (user.role === "contador") {
      navigate("/agendadinamicacontador");
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    const userData = decryptData(localStorage.getItem("user"));
    if (userData && userData.id && userData.role?.toLowerCase() === "user") {
      try {
        const userRef = ref(database, `users/${userData.id}`);
        await update(userRef, { activeSession: null });
      } catch (error) {
        console.error("Error al limpiar sesión:", error);
      }
    }
    localStorage.clear();
    sessionStorage.removeItem("navigated");
    navigate("/");
  };

  // Función para verificar si la plataforma está cerrada
  const isPlatformClosed = () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // De 23:30 a 23:59 o de 00:00 a 01:59
    return (hour === 23 && minute >= 30) || hour === 0 || hour === 1;
  };

  // Función para cerrar sesión automáticamente
  const handleAutomaticLogout = async () => {
    let countdown = 30;

    const result = await Swal.fire({
      icon: "warning",
      title: "Plataforma Cerrada",
      html: `La plataforma está cerrada en este horario 11:30pm a 2:00am, serás redireccionado al login.<br><br>Cerrando sesión en <b>${countdown}</b> segundos`,
      confirmButtonText: "Aceptar",
      allowOutsideClick: false,
      allowEscapeKey: false,
      timer: 30000,
      timerProgressBar: true,
      didOpen: () => {
        const timer = setInterval(() => {
          countdown--;
          Swal.getHtmlContainer().innerHTML = `La plataforma está cerrada en este horario 11:30pm a 2:00am, serás redireccionado al login.<br><br>Cerrando sesión en <b>${countdown}</b> segundos`;
          if (countdown <= 0) {
            clearInterval(timer);
          }
        }, 1000);
      },
    });

    handleLogout();
  };

  // Verificar horario cada minuto
  useEffect(() => {
    const checkPlatformStatus = () => {
      const currentUser = decryptData(localStorage.getItem("user"));
      if (isPlatformClosed() && currentUser) {
        handleAutomaticLogout();
      }
    };

    const interval = setInterval(checkPlatformStatus, 60000); // Cada minuto

    // Verificar inmediatamente al cargar
    checkPlatformStatus();

    return () => clearInterval(interval);
  }, []);

  const toggleSlidebar = () => setShowSlidebar(!showSlidebar);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        slidebarRef.current &&
        !slidebarRef.current.contains(e.target) &&
        !e.target.closest(".show-slidebar-button")
      ) {
        setShowSlidebar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="homepage-container">
      {/* botón hamburguesa móvil */}
      <button className="show-slidebar-button" onClick={toggleSlidebar}>
        <img src={barraIcon} alt="Menú" className="barra-icon-img" />
      </button>

      <div
        ref={slidebarRef}
        className={`slidebar ${showSlidebar ? "show" : ""}`}
      >
        {/* ===== HEADER USUARIO ===== */}
        <div className="sidebar-user">
          <a href="https://skglobalservices.github.io/OopsOutSepticTankYServicesAruba/#/agendadeldiausuario">
            <img
              className="user-photo"
              src={logo}
              alt={user.name || "Invitado"}
            />
          </a>
          <div className="user-greeting">
            Bienvenido, {user.name || "Invitado"}
          </div>
        </div>

        {/* ===== MENÚ PRINCIPAL ===== */}
        <button
          className="btn-servHoy2"
          onClick={() => navigate("/agendadeldiausuario")}
        >
          <img
            className="icon-servHoy2"
            src={servicioHoyIcon2}
            alt="Servicios de Hoy"
          />
          <span>Servicios de Hoy</span>
        </button>

        <button
          className="btn-servMan2"
          onClick={() => navigate("/agendamañanausuario")}
        >
          <img
            className="icon-servMan2"
            src={servicioMananaIcon2}
            alt="Servicios de Mañana"
          />
          <span>Servicios de Mañana</span>
        </button>
        <button
          className="btn-infEfec2"
          onClick={() => navigate("/informedeefectivousuario")}
        >
          <img
            className="icon-infEfec2"
            src={informeEfectivoIcon2}
            alt="Informe de Efectivo"
          />
          <span>Informe De Efectivo</span>
        </button>
        <button
              className="btn-agendar2"
              onClick={() => navigate("/calendariouser")}
            >
              <img
                className="icon-agendar2"
                src={agendarIcon2}
              />
              <span>ㅤﾠCalendario</span>
            </button>
        <button className="btn-logout2" onClick={handleLogout}>
          <img className="icon-logout2" src={logoutIcon2} alt="Logout" />
          <span>Cerrar Sesión</span>
        </button>

        {/* ===== FOOTER ===== */}
        <div className="sidebar-footer">
          © {new Date().getFullYear()} SK GLOBAL SERVICES
        </div>
      </div>
    </div>
  );
};

export default React.memo(Slidebaruser);
