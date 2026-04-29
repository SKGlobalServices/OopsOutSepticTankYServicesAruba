import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { createHashRouter, RouterProvider } from "react-router-dom";
import PageWrapper from "./components/PageWrapper.jsx";
import Homepage from "./components/Hojadeservicios.jsx";
import Agendaexpress from "./components/Agendaexpress.jsx";
import Hojamañana from "./components/Hojamañana.jsx";
import Hojapasadomañana from "./components/Hojapasadomañana.jsx";
import Hojadefechas from "./components/Hojadefechas.jsx";
import Facturasemitidas from "./components/Facturasemitidas.jsx";
import Cotizacion from "./components/Cotizacion.jsx";
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
import Clientesnuevos from "./components/Clientesnuevos.jsx";
import HistorialCambios from "./components/HistorialCambios.jsx";

const root = ReactDOM.createRoot(document.getElementById("root"));

const router = createHashRouter([
  { path: "/", element: <App /> },
  {
    path: "/homepage",
    element: (
      <PageWrapper>
        <Homepage />
      </PageWrapper>
    ),
  },
  {
    path: "/agendaexpress",
    element: (
      <PageWrapper>
        <Agendaexpress />
      </PageWrapper>
    ),
  },
  {
    path: "/hojamañana",
    element: (
      <PageWrapper>
        <Hojamañana />
      </PageWrapper>
    ),
  },
  {
    path: "/hojapasadomañana",
    element: (
      <PageWrapper>
        <Hojapasadomañana />
      </PageWrapper>
    ),
  },
  {
    path: "/hojadefechas",
    element: (
      <PageWrapper>
        <Hojadefechas />
      </PageWrapper>
    ),
  },
  {
    path: "/facturasemitidas",
    element: (
      <PageWrapper>
        <Facturasemitidas />
      </PageWrapper>
    ),
  },
  {
    path: "/cotizacion",
    element: (
      <PageWrapper>
        <Cotizacion />
      </PageWrapper>
    ),
  },
  {
    path: "/clientes",
    element: (
      <PageWrapper>
        <Clientes />
      </PageWrapper>
    ),
  },
  {
    path: "/clientesfijos",
    element: (
      <PageWrapper>
        <Clientesfijos />
      </PageWrapper>
    ),
  },
  {
    path: "/usuarios",
    element: (
      <PageWrapper>
        <Usuarios />
      </PageWrapper>
    ),
  },
  {
    path: "/informedeefectivousuario",
    element: (
      <PageWrapper>
        <Informedeefectivousuario />
      </PageWrapper>
    ),
  },
  {
    path: "/agendadeldiausuario",
    element: (
      <PageWrapper>
        <Agendadeldiausuario />
      </PageWrapper>
    ),
  },
  {
    path: "/agendamañanausuario",
    element: (
      <PageWrapper>
        <Agendamañanausuario />
      </PageWrapper>
    ),
  },
  {
    path: "/informedeefectivo",
    element: (
      <PageWrapper>
        <Informedeefectivo />
      </PageWrapper>
    ),
  },
  {
    path: "/informedetransferencias",
    element: (
      <PageWrapper>
        <Informedetransferencias />
      </PageWrapper>
    ),
  },
  {
    path: "/informedecobranza",
    element: (
      <PageWrapper>
        <Informedecobranza />
      </PageWrapper>
    ),
  },
  {
    path: "/fastmark",
    element: (
      <PageWrapper>
        <Fastmark />
      </PageWrapper>
    ),
  },
  {
    path: "/clientesnuevos",
    element: (
      <PageWrapper>
        <Clientesnuevos />
      </PageWrapper>
    ),
  },
  {
    path: "/nomina",
    element: (
      <PageWrapper>
        <Nomina />
      </PageWrapper>
    ),
  },
  {
    path: "/gastos",
    element: (
      <PageWrapper>
        <Gastos />
      </PageWrapper>
    ),
  },
  {
    path: "/pagosmensuales",
    element: (
      <PageWrapper>
        <Pagosmensuales />
      </PageWrapper>
    ),
  },
  {
    path: "/pagosanticipados",
    element: (
      <PageWrapper>
        <Pagosanticipados />
      </PageWrapper>
    ),
  },
  {
    path: "/ciclodefacturacion",
    element: (
      <PageWrapper>
        <Ciclodefacturacion />
      </PageWrapper>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <PageWrapper>
        <Dashboard />
      </PageWrapper>
    ),
  },
  {
    path: "/extras",
    element: (
      <PageWrapper>
        <Extras />
      </PageWrapper>
    ),
  },
  {
    path: "/deducciones",
    element: (
      <PageWrapper>
        <Deducciones />
      </PageWrapper>
    ),
  },
  {
    path: "/calendarioadmin",
    element: (
      <PageWrapper>
        <Calendarioadmin />
      </PageWrapper>
    ),
  },
  {
    path: "/calendariouser",
    element: (
      <PageWrapper>
        <Calendariouser />
      </PageWrapper>
    ),
  },
  {
    path: "/informedeserviciosextras",
    element: (
      <PageWrapper>
        <Informedeserviciosextras />
      </PageWrapper>
    ),
  },
  {
    path: "/informedetransferenciascontador",
    element: (
      <PageWrapper>
        <Informedetransferenciascontador />
      </PageWrapper>
    ),
  },
  {
    path: "/facturasemitidascontador",
    element: (
      <PageWrapper>
        <Facturasemitidascontador />
      </PageWrapper>
    ),
  },
  {
    path: "/reprogramacion",
    element: (
      <PageWrapper>
        <Reprogramacion />
      </PageWrapper>
    ),
  },
  {
    path: "/historialcambios",
    element: (
      <PageWrapper>
        <HistorialCambios />
      </PageWrapper>
    ),
  },
]);

root.render(
  <RouterProvider router={router} />
);