import React, { useState, useEffect, useRef, useMemo } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, onChildAdded, query, orderByChild } from "firebase/database";
import Slidebar from "./Slidebar";
import Clock from "./Clock";
import filtericon from "../assets/img/filters_icon.jpg";

const Historialdecambios = () => {
  const [registros, setRegistros] = useState([]);
  const [filtrados, setFiltrados] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const filterSlidebarRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    fecha: "",
    usuario: "",
    lugar: "",
    textoCambio: "",
    tipoAccion: "",
  });

  // Convierte "yyyy-mm-dd" a "dd-mm-yyyy"
  const convertirFechaFormato = (fechaInput) => {
    if (!fechaInput) return "";
    const [yyyy, mm, dd] = fechaInput.split("-");
    return `${dd}-${mm}-${yyyy}`;
  };

  // Cargar historial con throttle
  useEffect(() => {
    const historialRef = ref(database, "historialdecambios");
    let isInitialLoad = true;

    const throttledUpdate = (snap) => {
      const dato = snap.val();
      const id = snap.key;

      setRegistros((prev) => {
        // Evitar duplicados
        const exists = prev.some((item) => item.id === id);
        if (exists) return prev;

        // Agregar al inicio, limitar a 1000 registros para rendimiento
        const newList = [{ ...dato, id }, ...prev].slice(0, 1000);
        return newList;
      });

      if (isInitialLoad) {
        setLoading(false);
        isInitialLoad = false;
      }
    };

    const unsubscribe = onChildAdded(historialRef, throttledUpdate);
    const timeoutId = setTimeout(() => setLoading(false), 2000);

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  // Función de filtrado simple
  const filtrarRegistros = (datos, filtros) => {
    return datos.filter((item) => {
      if (filtros.usuario && item.usuario !== filtros.usuario) return false;
      if (filtros.lugar && item.lugar !== filtros.lugar) return false;
      if (filtros.fecha && item.fecha !== convertirFechaFormato(filtros.fecha))
        return false;
      if (
        filtros.textoCambio &&
        !item.cambio.toLowerCase().includes(filtros.textoCambio.toLowerCase())
      )
        return false;
      if (
        filtros.tipoAccion &&
        !item.cambio.toLowerCase().includes(filtros.tipoAccion.toLowerCase())
      )
        return false;
      return true;
    });
  };

  // Actualizar filtrados con debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Ordenar solo si hay registros
      if (registros.length === 0) {
        setFiltrados([]);
        return;
      }

      // Ordenar por fecha más reciente, luego por hora más reciente
      const ordenados = [...registros].sort((a, b) => {
        // Convertir fecha DD-MM-YYYY a objeto Date
        const [diaA, mesA, añoA] = a.fecha.split("-");
        const [diaB, mesB, añoB] = b.fecha.split("-");

        const fechaA = new Date(añoA, mesA - 1, diaA);
        const fechaB = new Date(añoB, mesB - 1, diaB);

        // Primero ordenar por fecha (más reciente primero)
        if (fechaA.getTime() !== fechaB.getTime()) {
          return fechaB.getTime() - fechaA.getTime();
        }

        // Si es la misma fecha, ordenar por hora (más reciente primero)
        const [horaA, minA, segA] = a.hora.split(":");
        const [horaB, minB, segB] = b.hora.split(":");

        const tiempoA =
          parseInt(horaA) * 3600 + parseInt(minA) * 60 + parseInt(segA);
        const tiempoB =
          parseInt(horaB) * 3600 + parseInt(minB) * 60 + parseInt(segB);

        return tiempoB - tiempoA; // Hora más reciente primero
      });

      // Filtrar
      const filtradosNuevos = filtrarRegistros(ordenados, filters);
      setFiltrados(filtradosNuevos);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [registros, filters]);

  // Cálculos de paginación
  const totalItems = filtrados.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageRecords = filtrados.slice(startIndex, endIndex);

  // Funciones de navegación
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const goToPreviousPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  // Función para cambiar tamaño de página
  const handleItemsPerPageChange = (newSize) => {
    setItemsPerPage(newSize);
    setCurrentPage(1); // Resetear a página 1
  };

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Mostrar/ocultar slidebars
  const toggleSlidebar = () => setShowSlidebar(!showSlidebar);
  const toggleFilterSlidebar = () => setShowFilterSlidebar(!showFilterSlidebar);

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

  useEffect(() => {
    const handleClickOutsideFilter = (e) => {
      if (
        filterSlidebarRef.current &&
        !filterSlidebarRef.current.contains(e.target) &&
        !e.target.closest(".show-filter-slidebar-button")
      ) {
        setShowFilterSlidebar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutsideFilter);
    return () =>
      document.removeEventListener("mousedown", handleClickOutsideFilter);
  }, []);

if (loading) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  return (
    <div className="homepage-container">
      <Slidebar />
      <div onClick={toggleSlidebar}></div>

      {/* FILTROS */}
      <div onClick={toggleFilterSlidebar}>
        <img
          src={filtericon}
          className="show-filter-slidebar-button"
          alt="Filtros"
        />
      </div>
      <div
        ref={filterSlidebarRef}
        className={`filter-slidebar ${showFilterSlidebar ? "show" : ""}`}
      >
        <h2>Filtros</h2>

        <label>Fecha</label>
        <input
          type="date"
          value={filters.fecha}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, fecha: e.target.value }))
          }
        />

        <label>Usuario</label>
        <select
          value={filters.usuario}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, usuario: e.target.value }))
          }
        >
          <option value="">Todos</option>
          {[...new Set(registros.map((r) => r.usuario).filter(Boolean))].map(
            (u, i) => (
              <option key={i} value={u}>
                {u}
              </option>
            )
          )}
        </select>

        <label>Lugar</label>
        <select
          value={filters.lugar}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, lugar: e.target.value }))
          }
        >
          <option value="">Todos</option>
          {[...new Set(registros.map((r) => r.lugar).filter(Boolean))].map(
            (l, i) => (
              <option key={i} value={l}>
                {l}
              </option>
            )
          )}
        </select>

        <label>Tipo de Acción</label>
        <select
          value={filters.tipoAccion}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, tipoAccion: e.target.value }))
          }
        >
          <option value="">Todos</option>
          <option value="CREADO">Creado</option>
          <option value="EDITADO">Editado</option>
          <option value="ELIMINADO">Eliminado</option>
        </select>

        <label>Búsqueda en cambio</label>
        <input
          type="text"
          placeholder="Buscar palabra clave"
          value={filters.textoCambio}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, textoCambio: e.target.value }))
          }
        />

        <button
          className="discard-filter-button"
          onClick={() =>
            setFilters({
              fecha: "",
              usuario: "",
              lugar: "",
              textoCambio: "",
              tipoAccion: "",
            })
          }
        >
          Descartar Filtros
        </button>
      </div>

      {/* TÍTULO */}
      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Historial De Cambios</h1>
          <div className="current-date">
            <div>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      <section className="homepage-card">
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Usuario</th>
                <th>Lugar</th>
                <th className="cambio-column">Cambio</th>
              </tr>
            </thead>
            <tbody>
              {pageRecords.length ? (
                pageRecords.map((r, i) => (
                  <tr key={i}>
                    <td
                      style={{
                        minWidth: window.innerWidth < 768 ? "55px" : "80px",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      {r.fecha}
                    </td>
                    <td
                      style={{
                        minWidth: window.innerWidth < 768 ? "55px" : "80px",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      {r.hora}
                    </td>
                    <td>
                      <input
                        style={{ width: "16ch" }}
                        type="text"
                        value={r.usuario || ""}
                        readOnly
                      />
                    </td>
                    <td>
                      <input
                        style={{ width: "16ch" }}
                        type="text"
                        value={r.lugar || ""}
                        readOnly
                      />
                    </td>
                    <td className="cambio-cell">
                      <textarea
                        className="cambio-textarea"
                        style={{
                          width: "100%",
                          minWidth: "600px",
                          minHeight: "60px",
                          resize: "vertical",
                          border: "1px solid #ccc",
                          padding: "8px",
                          fontSize: "13px",
                          fontFamily: "inherit",
                          backgroundColor: "white",
                          borderRadius: "4px",
                        }}
                        value={r.cambio || ""}
                        readOnly
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="no-data">
                  <td colSpan={5}>No hay registros para mostrar</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Controles de paginación */}
        <div className="pagination-container">
          <div className="pagination-info">
            <span>
              Mostrando {startIndex + 1}-{Math.min(endIndex, totalItems)} de{" "}
              {totalItems} registros
            </span>
            <div className="items-per-page">
              <label>Mostrar:</label>
              <select
                value={itemsPerPage}
                onChange={(e) =>
                  handleItemsPerPageChange(Number(e.target.value))
                }
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
              <span>por página</span>
            </div>
          </div>

          {/* Controles de navegación */}
          <div className="pagination-controls">
            <button
              onClick={goToFirstPage}
              disabled={currentPage === 1}
              title="Primera página"
            >
              ««
            </button>
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              title="Página anterior"
            >
              «
            </button>
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              title="Página siguiente"
            >
              »
            </button>
            <button
              onClick={goToLastPage}
              disabled={currentPage === totalPages}
              title="Última página"
            >
              »»
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Historialdecambios;
