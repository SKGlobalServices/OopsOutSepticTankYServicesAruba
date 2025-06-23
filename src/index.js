import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { HashRouter, Routes, Route } from "react-router-dom";
import Homepage from "./components/Hojadeservicios.jsx";
import Agendaexpress from "./components/Agendaexpress.jsx";
import Hojamañana from "./components/Hojamañana.jsx";
import Hojapasadomañana from "./components/Hojapasadomañana.jsx";
import Hojadefechas from "./components/Hojadefechas.jsx";
import Facturasemitidas from "./components/Facturasemitidas.jsx";
import Clientes from "./components/Hojaclientes.jsx";
import Reprogramacionautomatica from "./components/Reprogramacionautomatica.jsx";
import Usuarios from "./components/Configuraciondeusuarios.jsx"
import Informedeefectivo from "./components/Informedeefectivo.jsx"
import Agendadeldiausuario from "./components/Agendadeldiausuario.jsx"
import Agendamañanausuario from "./components/Agendamañanausuario.jsx"
import Agendadinamicacontador from "./components/Agendadinamicacontador.jsx"
const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <HashRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/homepage" element={<Homepage />} />
      <Route path="/agendaexpress" element={<Agendaexpress />} />
      <Route path="/hojamañana" element={<Hojamañana />} />
      <Route path="/hojapasadomañana" element={<Hojapasadomañana />} />
      <Route path="/hojadefechas" element={<Hojadefechas />} />
      <Route path="/facturasemitidas" element={<Facturasemitidas />} />
      <Route path="/clientes" element={<Clientes />} />
      <Route path="/reprogramacionautomatica" element={<Reprogramacionautomatica />} />
      <Route path="/usuarios" element={<Usuarios />} />
      <Route path="/informedeefectivo" element={<Informedeefectivo />} />
      <Route path="/agendadeldiausuario" element={<Agendadeldiausuario />} />
      <Route path="/agendamañanausuario" element={<Agendamañanausuario />} />
      <Route path="/agendadinamicacontador" element={<Agendadinamicacontador />} />
    </Routes>
  </HashRouter>
);