import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import agendarIcon2 from "../assets/img/agendarIcon2.png";
import servicioHoyIcon2 from "../assets/img/servicioHoyIcon2.png";
import servicioMananaIcon2 from "../assets/img/servicioMananaIcon2.png";
import servicioPasadoMananaIcon2 from "../assets/img/servicioPasadoMananaIcon2.png";
import agendaDinamicaIcon2 from "../assets/img/agendaDinamicaIcon2.png";
import facturaicon2 from "../assets/img/factura_icon2.png";
import clientesIcon2 from "../assets/img/clientesIcon2.png";
import reprogramacionIcon2 from "../assets/img/reprogramacionIcon2.png";
import informeEfectivoIcon2 from "../assets/img/informeEfectivoIcon2.png";
import configuracionUsuariosIcon2 from "../assets/img/configuracionUsuariosIcon2.png";
import logoutIcon2 from "../assets/img/logoutIcon2.png";
import barraIcon from "../assets/img/barra_icon.jpg";
import logo from "../assets/img/logosolo.png";

const Slidebar = () => {
  const navigate = useNavigate();
  const [showSlidebar, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const user = JSON.parse(localStorage.getItem("user")) || {};

  useEffect(() => {
    if (!user || !user.role) {
      navigate("/");
      return;
    }
    if (user.role === "user") {
      navigate("/agendadeldiausuario");
    } else if (user.role === "contador") {
      navigate("/agendadinamicacontador");
    }
    // admin se queda aquí
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
    await Swal.fire({
      icon: "warning",
      title: "Plataforma Cerrada",
      text: "La plataforma está cerrada en este horario 11:00pm a 12:00am, serás redireccionado al login.",
      confirmButtonText: "Aceptar",
      allowOutsideClick: false,
      allowEscapeKey: false
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

  // ——————————————
  // Cierra todos los <details> excepto el que acabas de abrir
  useEffect(() => {
    const details = slidebarRef.current.querySelectorAll("details");

    const onSummaryClick = (detail) => (e) => {
      e.preventDefault();
      // 1) cerrar todos
      details.forEach((d) => {
        if (d !== detail) d.open = false;
      });
      // 2) alternar el que tocó
      detail.open = !detail.open;
    };

    details.forEach((detail) => {
      const summary = detail.querySelector("summary");
      summary.addEventListener("click", onSummaryClick(detail));
    });

    return () => {
      details.forEach((detail) => {
        const summary = detail.querySelector("summary");
        summary.removeEventListener("click", onSummaryClick(detail));
      });
    };
  }, []);

  // Genera URL de imagen al azar para cada usuario
  const seed = encodeURIComponent(
    user.username || user.email || user.id || Math.random()
  );
  const placeholderUrl = `https://loremflickr.com/80/80/animal?lock=${seed}`;

  return (
    <div className="homepage-container">
      {/* SLIDEBAR */}
      <button className="show-slidebar-button" onClick={toggleSlidebar}>
        <img src={barraIcon} alt="Menú" className="barra-icon-img" />
      </button>

      <div
        ref={slidebarRef}
        className={`slidebar ${showSlidebar ? "show" : ""}`}
      >
        {/* ===== HEADER USUARIO ===== */}
        <div className="sidebar-user">
          <a href="https://skglobalservices.github.io/OopsOutSepticTankYServicesAruba/#/agendaexpress">
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
        {/* MÓDULO: AGENDA EXPRESS */}
          <button
            className="btn-agendar2"
            onClick={() => navigate("/agendaexpress")}
          >
            <img
              className="icon-agendar2"
              src={agendarIcon2}
              alt="Agenda Express"
            />
            <span>Agenda Express</span>
          </button>

        {/* MÓDULO: HOJAS DE SERVICIOS */}
        <details>
          <summary className="module-header">HOJAS DE SERVICIOS</summary>
          <div className="module-content">
            <button
              className="btn-servHoy2"
              onClick={() => navigate("/homepage")}
            >
              <img
                className="icon-servHoy2"
                src={servicioHoyIcon2}
                alt="Servicios de Hoy"
              />
              <span>Servicios De Hoy</span>
            </button>
            <button
              className="btn-servMan2"
              onClick={() => navigate("/hojamañana")}
            >
              <img
                className="icon-servMan2"
                src={servicioMananaIcon2}
                alt="Servicios de Mañana"
              />
              <span>Servicios De Mañana</span>
            </button>
            <button
              className="btn-servPas2"
              onClick={() => navigate("/hojapasadomañana")}
            >
              <img
                className="icon-servPas2"
                src={servicioPasadoMananaIcon2}
                alt="Servicios Pasado Mañana"
              />
              <span>Servicios Pasado Mañana</span>
            </button>
            <button
              className="btn-reprog2"
              onClick={() => navigate("/reprogramacionautomatica")}
            >
              <img
                className="icon-reprog2"
                src={reprogramacionIcon2}
                alt="Reprogramación Automática"
              />
              <span>Reprogramación Automática</span>
            </button>
          </div>
        </details>

        {/* MÓDULO: AGENDA Y FACTURACIÓN */}
        <details>
          <summary className="module-header">AGENDA Y FACTURACIÓN</summary>
          <div className="module-content">
            <button
              className="btn-agDin2"
              onClick={() => navigate("/hojadefechas")}
            >
              <img
                className="icon-agDin2"
                src={agendaDinamicaIcon2}
                alt="Agenda Dinámica"
              />
              <span>Agenda Dinámica</span>
            </button>
            <button
              className="btn-facturasEmitidas2"
              onClick={() => navigate("/facturasemitidas")}
            >
              <img
                className="icon-facturasEmitidas2"
                src={facturaicon2}
                alt="Facturas Emitidas"
              />
              <span>Facturas Emitidas</span>
            </button>
          </div>
        </details>

        {/* MÓDULO: GESTIÓN FINANCIERA */}
        <details>
          <summary className="module-header">GESTIÓN FINANCIERA</summary>
          <div className="module-content">
            <button className="btn-nomina2" onClick={() => navigate("/nomina")}>
              <img
                className="icon-infEfec2"
                src={informeEfectivoIcon2}
                alt="Nomina"
              />
              <span>ㅤㅤNómina</span>
            </button>
            <button className="btn-gastos2" onClick={() => navigate("/gastos")}>
              <img
                className="icon-infEfec2"
                src={informeEfectivoIcon2}
                alt="Gastos"
              />
              <span>ㅤㅤGastos</span>
            </button>
            <button
              className="btn-edoResul2"
              onClick={() => navigate("/ingresos")}
            >
              <img
                className="icon-infEfec2"
                src={informeEfectivoIcon2}
                alt="Ingresos"
              />
              <span>ㅤㅤIngresos</span>
            </button>
            <button
              className="btn-edoResul2"
              onClick={() => navigate("/estadoderesultado")}
            >
              <img
                className="icon-infEfec2"
                src={informeEfectivoIcon2}
                alt="Estado De Resultado"
              />
              <span>Estado De Resultado</span>
            </button>
          </div>
        </details>

        {/* MÓDULO: INFORMES */}
        <details>
          <summary className="module-header">INFORMES</summary>
          <div className="module-content">
            <button
              className="btn-infEfec2"
              onClick={() => navigate("/informedeefectivo")}
            >
              <img
                className="icon-infEfec2"
                src={informeEfectivoIcon2}
                alt="Informe de Efectivo"
              />
              <span>Informe De Efectivo</span>
            </button>
            <button
              className="btn-infEfec2"
              onClick={() => navigate("/informedetransferencias")}
            >
              <img
                className="icon-infEfec2"
                src={informeEfectivoIcon2}
                alt="Informe De Transferencias"
              />
              <span>Informe De Transferencias</span>
            </button>
            <button
              className="btn-infEfec2"
              onClick={() => navigate("/informedecobranza")}
            >
              <img
                className="icon-infEfec2"
                src={informeEfectivoIcon2}
                alt="Informe De Cobranza"
              />
              <span>Informe De Cobranza</span>
            </button>
          </div>
        </details>

        {/* MÓDULO: CONFIGURACIÓN */}
        <details>
          <summary className="module-header">CONFIGURACIÓN</summary>
          <div className="module-content">
            <button
              className="btn-configUsr2"
              onClick={() => navigate("/historialdecambios")}
            >
              <img
                className="icon-configUsr2"
                src={configuracionUsuariosIcon2}
                alt="Historial De Cambios"
              />
              <span>Historial De Cambios</span>
            </button>
            <button
              className="btn-configUsr2"
              onClick={() => navigate("/clientes")}
            >
              <img
                className="icon-configUsr2"
                src={clientesIcon2}
                alt="Clientes"
              />
              <span>ㅤㅤClientes</span>
            </button>
            <button
              className="btn-configUsr2"
              onClick={() => navigate("/usuarios")}
            >
              <img
                className="icon-configUsr2"
                src={configuracionUsuariosIcon2}
                alt="Configuración de Usuarios"
              />
              <span>Configuración De Usuarios</span>
            </button>
          </div>
        </details>

        {/* CERRAR SESIÓN */}
        <button className="btn-logout2" onClick={handleLogout}>
          <img className="icon-logout2" src={logoutIcon2} alt="Logout" />
          <span>Cerrar Sesión</span>
        </button>

        {/* FOOTER */}
        <div className="sidebar-footer">
          © {new Date().getFullYear()} SK GLOBAL SERVICES
        </div>
      </div>
    </div>
  );
};

export default Slidebar;
