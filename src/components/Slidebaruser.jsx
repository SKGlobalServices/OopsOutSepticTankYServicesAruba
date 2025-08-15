import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import servicioHoyIcon2 from "../assets/img/servicioHoyIcon2.png";
import servicioMananaIcon2 from "../assets/img/servicioMananaIcon2.png";
import informeEfectivoIcon2 from "../assets/img/informeEfectivoIcon2.png";
import logoutIcon2 from "../assets/img/logoutIcon2.png";
import servicioHoyIcon from "../assets/img/servicioHoyIcon.jpg";
import servicioMananaIcon from "../assets/img/servicioMananaIcon.jpg";
import informeEfectivoIcon from "../assets/img/informeEfectivoIcon.jpg";
import logoutIcon from "../assets/img/logoutIcon.jpg";
import barraIcon from "../assets/img/barra_icon.jpg";

const Slidebaruser = () => {
  const navigate = useNavigate();
  const [showSlidebar, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const user = JSON.parse(localStorage.getItem("user")) || {};

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

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  // Función para verificar si la plataforma está cerrada
  const isPlatformClosed = () => {
    const now = new Date();
    return now.getHours() === 23;
  };

  // Función para cerrar sesión automáticamente
  const handleAutomaticLogout = async () => {
    let countdown = 30;
    
    const result = await Swal.fire({
      icon: "warning",
      title: "Plataforma Cerrada",
      html: `La plataforma está cerrada en este horario 11:00pm a 12:00am, serás redireccionado al login.<br><br>Cerrando sesión en <b>${countdown}</b> segundos`,
      confirmButtonText: "Aceptar",
      allowOutsideClick: false,
      allowEscapeKey: false,
      timer: 30000,
      timerProgressBar: true,
      didOpen: () => {
        const timer = setInterval(() => {
          countdown--;
          Swal.getHtmlContainer().innerHTML = `La plataforma está cerrada en este horario 11:00pm a 12:00am, serás redireccionado al login.<br><br>Cerrando sesión en <b>${countdown}</b> segundos`;
          if (countdown <= 0) {
            clearInterval(timer);
          }
        }, 1000);
      }
    });
    
    handleLogout();
  };

  // Verificar horario cada minuto
  useEffect(() => {
    const checkPlatformStatus = () => {
      if (isPlatformClosed()) {
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

  // Genera URL de imagen al azar para cada usuario
  const seed = encodeURIComponent(
    user.username || user.email || user.id || Math.random()
  );
  const placeholderUrl = `https://loremflickr.com/80/80/portrait?lock=${seed}`;

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
          <p className="user-greeting">
            Bienvenid@, {user.name || "Invitado"}
          </p>
          <img
            className="user-photo"
            src={user.photoURL || placeholderUrl}
            alt={user.name || "Invitado"}
          />
        </div>

        {/* ===== BOTONES MÓVIL ===== */}
        <button
          className="btn-servHoy2"
          onClick={() => navigate("/agendadeldiausuario")}
          style={{ visibility: "hidden" }}
        >
          <img
            className="icon-servHoy2"
            src={servicioHoyIcon2}
            alt="Servicios de Hoy"
          />
          <span>Servicios de Hoy</span>
        </button>
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
        <button className="btn-logout2" onClick={handleLogout}>
          <img className="icon-logout2" src={logoutIcon2} alt="Logout" />
          <span>Cerrar Sesión</span>
        </button>

        {/* ===== FOOTER ===== */}
        <div className="sidebar-footer">
          © {new Date().getFullYear()} SK GLOBAL SERVICES
        </div>
      </div>

      {/* ===== BOTONES PC ===== */}
      <button
        className="icon-button-servicioHoy"
        onClick={() => navigate("/agendadeldiausuario")}
      >
        <img
          className="icon-image-servicioHoy"
          src={servicioHoyIcon}
          alt="Servicios De Hoy"
        />
      </button>
      <button
        className="icon-button-servicioManana"
        onClick={() => navigate("/agendamañanausuario")}
      >
        <img
          className="icon-image-servicioManana"
          src={servicioMananaIcon}
          alt="Servicios De Mañana"
        />
      </button>
      <button
        className="icon-button-informeEfectivo"
        onClick={() => navigate("/informedeefectivousuario")}
      >
        <img
          className="icon-image-informeEfectivo"
          src={informeEfectivoIcon}
          alt="informedeefectivo"
        />
      </button>
      <button className="icon-button-logout" onClick={handleLogout}>
        <img className="icon-image-logout" src={logoutIcon} alt="logout" />
      </button>
    </div>
  );
};

export default Slidebaruser;
