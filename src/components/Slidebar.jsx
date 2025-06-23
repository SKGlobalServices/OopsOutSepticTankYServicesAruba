import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

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

import agendarIcon from "../assets/img/agendarIcon.jpg";
import servicioHoyIcon from "../assets/img/servicioHoyIcon.jpg";
import servicioMananaIcon from "../assets/img/servicioMananaIcon.jpg";
import servicioPasadoMananaIcon from "../assets/img/servicioPasadoMananaIcon.jpg";
import agendaDinamicaIcon from "../assets/img/agendaDinamicaIcon.jpg";
import facturaicon from "../assets/img/factura_icon.jpg";
import clientesIcon from "../assets/img/clientesIcon.jpg";
import reprogramacionIcon from "../assets/img/reprogramacionIcon.jpg";
import informeEfectivoIcon from "../assets/img/informeEfectivoIcon.jpg";
import configuracionUsuariosIcon from "../assets/img/configuracionUsuariosIcon.jpg";
import logoutIcon from "../assets/img/logoutIcon.jpg";

import barraIcon from "../assets/img/barra_icon.jpg"; // ajusta si cambia

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
  const seed = encodeURIComponent(user.username || user.email || user.id || Math.random());
  const placeholderUrl = `https://loremflickr.com/80/80/animal?lock=${seed}`;

  return (
    <div className="homepage-container">
      {/* SLIDEBAR MÓVIL */}
      <button className="show-slidebar-button" onClick={toggleSlidebar}>
        <img src={barraIcon} alt="Menú" className="barra-icon-img" />
      </button>

      <div
        ref={slidebarRef}
        className={`slidebar ${showSlidebar ? "show" : ""}`}
      >
        {/* ===== HEADER USUARIO ===== */}
        <div className="sidebar-user">
          <div className="user-greeting">
            Bienvenido, {user.name || "Invitado"}
          </div>
          <img
            className="user-photo"
            src={user.photoURL || placeholderUrl}
            alt={user.name || "Invitado"}
          />
        </div>

        {/* ===== MENÚ PRINCIPAL ===== */}
        {/* MÓDULO: AGENDA EXPRESS */}
        <details>
          <summary className="module-header">AGENDA EXPRESS</summary>
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
        </details>

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
            <button className="btn-nomina2" style={{cursor: "no-drop"}}>
              <span>Nómina</span>
            </button>
            <button className="btn-gastos2" style={{cursor: "no-drop"}}>
              <span>Gastos</span>
            </button>
            <button className="btn-ingresos2" style={{cursor: "no-drop"}}>
              <span>Ingresos</span>
            </button>
            <button className="btn-edoResul2" style={{cursor: "no-drop"}}>
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
            <button className="btn-infTrans2" style={{cursor: "no-drop"}}>
              <span>Informe De Transferencias</span>
            </button>
            <button className="btn-infCob2" style={{cursor: "no-drop"}}>
              <span>Informe De Cobranza</span>
            </button>
          </div>
        </details>

        {/* MÓDULO: CONFIGURACIÓN */}
        <details>
          <summary className="module-header">CONFIGURACIÓN</summary>
          <div className="module-content">
            <button
              className="btn-clientes2"
              onClick={() => navigate("/clientes")}
            >
              <img
                className="icon-clientes2"
                src={clientesIcon2}
                alt="Clientes"
              />
              <span>Clientes</span>
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
        <details>
          <summary className="module-header">CERRAR SESIÓN</summary>
          <div className="module-content">
            <button className="btn-logout2" onClick={handleLogout}>
              <img
                className="icon-logout2"
                src={logoutIcon2}
                alt="Logout"
              />
              <span>Logout</span>
            </button>
          </div>
        </details>

        {/* FOOTER */}
        <div className="sidebar-footer">
          © {new Date().getFullYear()} SK GLOBAL SERVICES
        </div>
      </div>

      {/* SLIDEBAR PC */}
      <button
        className="icon-button-agendar"
        onClick={() => navigate("/agendaexpress")}
      >
        <img
          className="icon-image-agendar"
          src={agendarIcon}
          alt="Agenda Express"
        />
      </button>
      <button
        className="icon-button-servicioHoy"
        onClick={() => navigate("/homepage")}
      >
        <img
          className="icon-image-servicioHoy"
          src={servicioHoyIcon}
          alt="homepage"
        />
      </button>
      <button
        className="icon-button-servicioManana"
        onClick={() => navigate("/hojamañana")}
      >
        <img
          className="icon-image-servicioManana"
          src={servicioMananaIcon}
          alt="hojamañana"
        />
      </button>
      <button
        className="icon-button-servicioPasadoManana"
        onClick={() => navigate("/hojapasadomañana")}
      >
        <img
          className="icon-image-servicioPasadoManana"
          src={servicioPasadoMananaIcon}
          alt="hojapasadomañana"
        />
      </button>
      <button
        className="icon-button-agendaDinamica"
        onClick={() => navigate("/hojadefechas")}
      >
        <img
          className="icon-image-agendaDinamica"
          src={agendaDinamicaIcon}
          alt="hojadefechas"
        />
      </button>
      <button
        className="icon-button-facturasEmitidas"
        onClick={() => navigate("/facturasemitidas")}
      >
        <img
          className="icon-image-facturasEmitidas"
          src={facturaicon}
          alt="Facturas Emitidas"
        />
      </button>
      <button
        className="icon-button-clientes"
        onClick={() => navigate("/clientes")}
      >
        <img
          className="icon-image-clientes"
          src={clientesIcon}
          alt="clientes"
        />
      </button>
      <button
        className="icon-button-reprogramacionAutomatica"
        onClick={() => navigate("/reprogramacionautomatica")}
      >
        <img
          className="icon-image-reprogramacionAutomatica"
          src={reprogramacionIcon}
          alt="reprogramacionautomatica"
        />
      </button>
      <button
        className="icon-button-informeEfectivo"
        onClick={() => navigate("/informedeefectivo")}
      >
        <img
          className="icon-image-informeEfectivo"
          src={informeEfectivoIcon}
          alt="informedeefectivo"
        />
      </button>
      <button
        className="icon-button-configuracionUsuarios"
        onClick={() => navigate("/usuarios")}
      >
        <img
          className="icon-image-configuracionUsuarios"
          src={configuracionUsuariosIcon}
          alt="usuarios"
        />
      </button>
      <button className="icon-button-logout" onClick={handleLogout}>
        <img
          className="icon-image-logout"
          src={logoutIcon}
          alt="logout"
        />
      </button>
    </div>
  );
};

export default Slidebar;
