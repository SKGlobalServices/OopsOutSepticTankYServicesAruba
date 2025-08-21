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
import Fastmark from "./components/Fastmark.jsx";

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
      <Route path="/reprogramacionautomatica" element={<PageWrapper><Reprogramacionautomatica /></PageWrapper>} />
      <Route path="/usuarios" element={<PageWrapper><Usuarios /></PageWrapper>} />
      <Route path="/informedeefectivousuario" element={<PageWrapper><Informedeefectivousuario /></PageWrapper>} />
      <Route path="/agendadeldiausuario" element={<PageWrapper><Agendadeldiausuario /></PageWrapper>} />
      <Route path="/agendamañanausuario" element={<PageWrapper><Agendamañanausuario /></PageWrapper>} />
      <Route path="/agendadinamicacontador" element={<PageWrapper><Agendadinamicacontador /></PageWrapper>} />
      <Route path="/historialdecambios" element={<PageWrapper><Historialdecambios /></PageWrapper>} />
      <Route path="/informedeefectivo" element={<PageWrapper><Informedeefectivo /></PageWrapper>} />
      <Route path="/informedetransferencias" element={<PageWrapper><Informedetransferencias /></PageWrapper>} />
      <Route path="/informedecobranza" element={<PageWrapper><Informedecobranza /></PageWrapper>} />
      <Route path="/fastmark" element={<PageWrapper><Fastmark /></PageWrapper>} />
      <Route path="/estadoderesultado" element={<PageWrapper><Estadoderesultado /></PageWrapper>} />
      <Route path="/ingresos" element={<PageWrapper><Ingresos /></PageWrapper>} />
      <Route path="/nomina" element={<PageWrapper><Nomina /></PageWrapper>} />
      <Route path="/gastos" element={<PageWrapper><Gastos /></PageWrapper>} />
    </Routes>
  </HashRouter>
);