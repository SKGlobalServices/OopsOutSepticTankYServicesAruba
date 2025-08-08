import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { HashRouter, Routes, Route } from "react-router-dom";
import { iniciarSeguimientoHistorial } from "./services/historialTracker";
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
import Informedeefectivousuario from "./components/Informedeefectivousuario.jsx";
import Historialdecambios from "./components/Historialdecambios.jsx";
import Informedecobranza from "./components/Informedecobranza.jsx";
import Informedetransferencias from "./components/Informedetransferencias.jsx";
import Estadoderesultado from "./components/Estadoderesultado.jsx";
import Ingresos from "./components/Ingresos.jsx";
import Nomina from "./components/Nomina.jsx";
import Gastos from "./components/Gastos.jsx";

// Iniciar seguimiento de historial
iniciarSeguimientoHistorial();

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
      <Route path="/informedeefectivousuario" element={<Informedeefectivousuario />} />
      <Route path="/agendadeldiausuario" element={<Agendadeldiausuario />} />
      <Route path="/agendamañanausuario" element={<Agendamañanausuario />} />
      <Route path="/agendadinamicacontador" element={<Agendadinamicacontador />} />
      <Route path="/historialdecambios" element={<Historialdecambios />} />
      <Route path="/informedecobranza" element={<Informedecobranza />} />
      <Route path="/informedetransferencias" element={<Informedetransferencias />} />
      <Route path="/estadoderesultado" element={<Estadoderesultado />} />
      <Route path="/ingresos" element={<Ingresos />} />
      <Route path="/nomina" element={<Nomina />} />
      <Route path="/gastos" element={<Gastos />} />
    </Routes>
  </HashRouter>
);