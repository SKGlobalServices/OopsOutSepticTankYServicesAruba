import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import agendarIcon2 from "../assets/img/agendarIcon2.png";
import logoutIcon2 from "../assets/img/logoutIcon2.png";
import logoutIcon from "../assets/img/logoutIcon.jpg";
import barraIcon from "../assets/img/barra_icon.jpg";

const Slidebarcontador = () => {
  const navigate = useNavigate();
  const [showSlidebar, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const user = JSON.parse(localStorage.getItem("user"));
  
    useEffect(() => {
      if (!user) {
        navigate("/");
        return;
      }
  
      if (user.role === "admin") {
        navigate("/agendaexpress");
      } else if (user.role === "user") {
        navigate("/agendadeldiausuario");
      }
    }, [user, navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  const toggleSlidebar = () => setShowSlidebar(!showSlidebar);

  const handleClickOutside = (e) => {
    if (
      slidebarRef.current &&
      !slidebarRef.current.contains(e.target) &&
      !e.target.closest(".show-slidebar-button")
    ) {
      setShowSlidebar(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="homepage-container">
      {/* SLIDEBAR MOVILES */}
      {/* SLIDEBAR MOVILES */}
      {/* SLIDEBAR MOVILES */}
      {/* SLIDEBAR MOVILES */}
      {/* SLIDEBAR MOVILES */}
      {/* SLIDEBAR MOVILES */}
      {/* SLIDEBAR MOVILES */}
      {/* SLIDEBAR MOVILES */}
      {/* SLIDEBAR MOVILES */}
      {/* SLIDEBAR MOVILES */}

      <button className="show-slidebar-button" onClick={toggleSlidebar}>
        <img src={barraIcon} alt="Menú" className="barra-icon-img" />
      </button>

      <div
        ref={slidebarRef}
        className={`slidebar ${showSlidebar ? "show" : ""}`}
      >
        <button
          className="btn-agendar2"
          onClick={() => navigate("/agendaexpress")}
          style={{ visibility: "hidden" }}
        >
          <img
            className="icon-agendar2"
            src={agendarIcon2}
            alt="Agenda Express"
          />
          <span>Agenda Express</span>
        </button>
        <button className="btn-logout2" onClick={handleLogout}>
          <img className="icon-logout2" src={logoutIcon2} alt="Logout" />
          <span>Cerrar Sesión</span>
        </button>
      </div>

      {/* SLIDEBAR PC */}
      {/* SLIDEBAR PC */}
      {/* SLIDEBAR PC */}
      {/* SLIDEBAR PC */}
      {/* SLIDEBAR PC */}
      {/* SLIDEBAR PC */}
      {/* SLIDEBAR PC */}
      {/* SLIDEBAR PC */}
      {/* SLIDEBAR PC */}
      {/* SLIDEBAR PC */}

      <button className="icon-button-logout" onClick={handleLogout}>
        <img className="icon-image-logout" src={logoutIcon} alt="logout" />
      </button>
    </div>
  );
};

export default Slidebarcontador;
