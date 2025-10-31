import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { HashRouter, Routes, Route } from "react-router-dom";
import PageWrapper from "./components/PageWrapper.jsx";
import Homepage from "./components/Hojadeservicios.jsx";
import Agendaexpress from "./components/Agendaexpress.jsx";
import Hojamañana from "./components/Hojamañana.jsx";
import Hojapasadomañana from "./components/Hojapasadomañana.jsx";
import Hojadefechas from "./components/Hojadefechas.jsx";
import Facturasemitidas from "./components/Facturasemitidas.jsx";
import Clientes from "./components/Hojaclientes.jsx";
import Reprogramacion from "./components/Reprogramacion.jsx";
import Usuarios from "./components/Configuraciondeusuarios.jsx"
import Informedeefectivo from "./components/Informedeefectivo.jsx"
import Agendadeldiausuario from "./components/Agendadeldiausuario.jsx"
import Agendamañanausuario from "./components/Agendamañanausuario.jsx"
import Informedeefectivousuario from "./components/Informedeefectivousuario.jsx";
import Informedecobranza from "./components/Informedecobranza.jsx";
import Informedetransferencias from "./components/Informedetransferencias.jsx";
import Nomina from "./components/Nomina.jsx";
import Gastos from "./components/Gastos.jsx";
import Fastmark from "./components/Fastmark.jsx";
import Clientesfijos from "./components/Clientesfijos.jsx";
import Pagosmensuales from "./components/Pagosmensuales.jsx";
import Pagosanticipados from "./components/Pagosanticipados.jsx";
import Ciclodefacturacion from "./components/Ciclodefacturacion.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Extras from "./components/Extras.jsx";
import Deducciones from "./components/Deducciones.jsx";
import Calendarioadmin from "./components/Calendarioadmin.jsx";
import Calendariouser from "./components/Calendariouser.jsx";
import Informedeserviciosextras from "./components/Informedeserviciosextras.jsx";
import Informedetransferenciascontador from "./components/Informedetransferenciascontador.jsx";
import Facturasemitidascontador from "./components/Facturasemitidascontador.jsx";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <HashRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/homepage" element={<PageWrapper><Homepage /></PageWrapper>} />
      <Route path="/agendaexpress" element={<PageWrapper><Agendaexpress /></PageWrapper>} />
      <Route path="/hojamañana" element={<PageWrapper><Hojamañana /></PageWrapper>} />
      <Route path="/hojapasadomañana" element={<PageWrapper><Hojapasadomañana /></PageWrapper>} />
      <Route path="/hojadefechas" element={<PageWrapper><Hojadefechas /></PageWrapper>} />
      <Route path="/facturasemitidas" element={<PageWrapper><Facturasemitidas /></PageWrapper>} />
      <Route path="/clientes" element={<PageWrapper><Clientes /></PageWrapper>} />
      <Route path="/clientesfijos" element={<PageWrapper><Clientesfijos /></PageWrapper>} />
      <Route path="/usuarios" element={<PageWrapper><Usuarios /></PageWrapper>} />
      <Route path="/informedeefectivousuario" element={<PageWrapper><Informedeefectivousuario /></PageWrapper>} />
      <Route path="/agendadeldiausuario" element={<PageWrapper><Agendadeldiausuario /></PageWrapper>} />
      <Route path="/agendamañanausuario" element={<PageWrapper><Agendamañanausuario /></PageWrapper>} />
      <Route path="/informedeefectivo" element={<PageWrapper><Informedeefectivo /></PageWrapper>} />
      <Route path="/informedetransferencias" element={<PageWrapper><Informedetransferencias /></PageWrapper>} />
      <Route path="/informedecobranza" element={<PageWrapper><Informedecobranza /></PageWrapper>} />
      <Route path="/fastmark" element={<PageWrapper><Fastmark /></PageWrapper>} />
      <Route path="/nomina" element={<PageWrapper><Nomina /></PageWrapper>} />
      <Route path="/gastos" element={<PageWrapper><Gastos /></PageWrapper>} />
      <Route path="/pagosmensuales" element={<PageWrapper><Pagosmensuales /></PageWrapper>} />
      <Route path="/pagosanticipados" element={<PageWrapper><Pagosanticipados /></PageWrapper>} />
      <Route path="/ciclodefacturacion" element={<PageWrapper><Ciclodefacturacion /></PageWrapper>} />
      <Route path="/dashboard" element={<PageWrapper><Dashboard /></PageWrapper>} />
      <Route path="/extras" element={<PageWrapper><Extras /></PageWrapper>} />
      <Route path="/deducciones" element={<PageWrapper><Deducciones /></PageWrapper>} />
      <Route path="/calendarioadmin" element={<PageWrapper><Calendarioadmin /></PageWrapper>} />
      <Route path="/calendariouser" element={<PageWrapper><Calendariouser /></PageWrapper>} />
      <Route path="/informedeserviciosextras" element={<PageWrapper><Informedeserviciosextras /></PageWrapper>} />
      <Route path="/informedetransferenciascontador" element={<PageWrapper><Informedetransferenciascontador /></PageWrapper>} />
      <Route path="/facturasemitidascontador" element={<PageWrapper><Facturasemitidascontador /></PageWrapper>} />
      <Route path="/reprogramacion" element={<PageWrapper><Reprogramacion /></PageWrapper>} />
    </Routes>
  </HashRouter>
);