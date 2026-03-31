import React, { useState, useEffect, useRef, useMemo } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, onValue, remove } from "firebase/database";
import Slidebar from "./Slidebar";
import Clock from "./Clock";
import Swal from "sweetalert2";
import filtericon from "../assets/img/filters_icon.jpg";

const parseDateToTimestamp = (value) => {
  if (!value) return null;

  // yyyy-mm-dd (input date)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  // dd/mm/yyyy o dd-mm-yyyy
  const match = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
  }

  return null;
};

const isInDateRange = (value, from, to) => {
  if (!from && !to) return true;
  const ts = parseDateToTimestamp(value);
  if (ts === null) return false;
  const fromTs = from ? parseDateToTimestamp(from) : null;
  const toTs = to ? parseDateToTimestamp(to) : null;
  if (fromTs !== null && ts < fromTs) return false;
  if (toTs !== null && ts > toTs) return false;
  return true;
};

const HistorialCambios = () => {
  const [data, setData] = useState([]);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const filterSlidebarRef = useRef(null);

  // LOADER
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Filtros
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroDireccion, setFiltroDireccion] = useState("");
  const [filtroAnombrede, setFiltroAnombrede] = useState("");
  const [fechaCambioDesde, setFechaCambioDesde] = useState("");
  const [fechaCambioHasta, setFechaCambioHasta] = useState("");
  const [fechaRegistroDesde, setFechaRegistroDesde] = useState("");
  const [fechaRegistroHasta, setFechaRegistroHasta] = useState("");

  // Escucha de Firebase para "historialcambios"
  useEffect(() => {
    const dbRef = ref(database, "historialcambios");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const entries = Object.entries(snapshot.val());
        // Ordenar por timestamp descendente (más reciente primero)
        entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
        setData(entries);
      } else {
        setData([]);
      }
      setLoadedData(true);
    }, (error) => {
      console.error("Error en historialcambios listener:", error);
      setLoadedData(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loadedData) {
      setLoading(false);
    }
  }, [loadedData]);

  const usuarioOptions = useMemo(
    () => [...new Set(data.map(([, item]) => item.usuario).filter(Boolean))].sort(),
    [data]
  );

  const direccionOptions = useMemo(
    () => [...new Set(data.map(([, item]) => item.direccionRegistro).filter(Boolean))].sort(),
    [data]
  );

  const anombredeOptions = useMemo(
    () => [...new Set(data.map(([, item]) => item.anombredeRegistro).filter(Boolean))].sort(),
    [data]
  );

  const filteredData = useMemo(() => {
    return data.filter(([, item]) => {
      if (filtroUsuario && item.usuario !== filtroUsuario) return false;
      if (filtroDireccion && item.direccionRegistro !== filtroDireccion) return false;
      if (filtroAnombrede && item.anombredeRegistro !== filtroAnombrede) return false;

      if (!isInDateRange(item.fecha, fechaCambioDesde, fechaCambioHasta)) return false;
      if (!isInDateRange(item.fechaRegistro, fechaRegistroDesde, fechaRegistroHasta)) return false;

      return true;
    });
  }, [
    data,
    filtroUsuario,
    filtroDireccion,
    filtroAnombrede,
    fechaCambioDesde,
    fechaCambioHasta,
    fechaRegistroDesde,
    fechaRegistroHasta,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    filtroUsuario,
    filtroDireccion,
    filtroAnombrede,
    fechaCambioDesde,
    fechaCambioHasta,
    fechaRegistroDesde,
    fechaRegistroHasta,
  ]);

  // Cálculos de paginación
  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredData.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };
  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const goToPreviousPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  const handleItemsPerPageChange = (newSize) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setFiltroUsuario("");
    setFiltroDireccion("");
    setFiltroAnombrede("");
    setFechaCambioDesde("");
    setFechaCambioHasta("");
    setFechaRegistroDesde("");
    setFechaRegistroHasta("");
  };

  const handleClickOutsideFilter = (e) => {
    if (
      filterSlidebarRef.current &&
      !filterSlidebarRef.current.contains(e.target) &&
      !e.target.closest(".show-filter-slidebar-button")
    ) {
      setShowFilterSlidebar(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutsideFilter);
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideFilter);
    };
  }, []);

  const handleDeleteAllHistory = async () => {
    const result = await Swal.fire({
      title: "¿Eliminar todo el historial?",
      text: "Esta acción eliminará todos los registros de cambios y no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar todo",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d33",
    });

    if (!result.isConfirmed) return;

    try {
      setIsDeleting(true);
      await remove(ref(database, "historialcambios"));
      setData([]);

      await Swal.fire({
        title: "Historial eliminado",
        text: "Todos los registros fueron eliminados correctamente.",
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error eliminando historialcambios:", error);
      await Swal.fire({
        title: "Error",
        text: "No se pudieron eliminar los registros del historial.",
        icon: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  return (
    <>
      <div className="homepage-container">
        <Slidebar />

        <div onClick={() => setShowFilterSlidebar((prev) => !prev)}>
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
          <h2 style={{ color: "white" }}>Filtros</h2>
          <br />
          <hr />

          <label>Quien hizo el cambio</label>
          <select
            value={filtroUsuario}
            onChange={(e) => setFiltroUsuario(e.target.value)}
          >
            <option value="">Todos</option>
            {usuarioOptions.map((usuario) => (
              <option key={usuario} value={usuario}>
                {usuario}
              </option>
            ))}
          </select>

          <label>Dirección</label>
          <select
            value={filtroDireccion}
            onChange={(e) => setFiltroDireccion(e.target.value)}
          >
            <option value="">Todas</option>
            {direccionOptions.map((direccion) => (
              <option key={direccion} value={direccion}>
                {direccion}
              </option>
            ))}
          </select>

          <label>A Nombre De</label>
          <select
            value={filtroAnombrede}
            onChange={(e) => setFiltroAnombrede(e.target.value)}
          >
            <option value="">Todos</option>
            {anombredeOptions.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>

          <label>Fecha de cambio (desde)</label>
          <input
            type="date"
            value={fechaCambioDesde}
            onChange={(e) => setFechaCambioDesde(e.target.value)}
          />

          <label>Fecha de cambio (hasta)</label>
          <input
            type="date"
            value={fechaCambioHasta}
            onChange={(e) => setFechaCambioHasta(e.target.value)}
          />

          <label>Fecha del registro (desde)</label>
          <input
            type="date"
            value={fechaRegistroDesde}
            onChange={(e) => setFechaRegistroDesde(e.target.value)}
          />

          <label>Fecha del registro (hasta)</label>
          <input
            type="date"
            value={fechaRegistroHasta}
            onChange={(e) => setFechaRegistroHasta(e.target.value)}
          />

          <button className="discard-filter-button" onClick={clearAllFilters}>
            Limpiar filtros
          </button>
        </div>

        <div className="homepage-title">
          <div className="homepage-card">
            <h1 className="title-page">Historial de Cambios</h1>
            <div className="current-date">
              <div style={{ cursor: "default" }}>
                {new Date().toLocaleDateString()}
              </div>
              <Clock />
            </div>
          </div>
        </div>

        <div className="homepage-card">

            {/* boton opcional para eliminar el historial */}
          {/* <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "10px",
            }}
          >
            <button
              onClick={handleDeleteAllHistory}
              disabled={isDeleting || data.length === 0}
              style={{
                backgroundColor: "#d33",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "8px 12px",
                cursor: isDeleting || data.length === 0 ? "not-allowed" : "pointer",
                opacity: isDeleting || data.length === 0 ? 0.6 : 1,
                fontWeight: 600,
              }}
            >
              {isDeleting ? "Eliminando..." : "Eliminar Todo el Historial"}
            </button>
          </div> */}

          <div className="table-container">
            <table className="service-table">
              <thead>
                <tr>
                  <th style={{ minWidth: "60px", whiteSpace: "nowrap" }}>Fecha</th>
                  <th style={{ minWidth: "50px", whiteSpace: "nowrap" }}>Hora</th>
                  <th style={{ minWidth: "130px", whiteSpace: "nowrap" }}>Quien</th>
                  <th style={{ minWidth: "100px", whiteSpace: "nowrap" }}>Modulo de Cambio</th>
                  <th style={{ minWidth: "50px", whiteSpace: "nowrap" }}>Fecha Registro</th>
                  <th style={{ minWidth: "60px", whiteSpace: "nowrap" }}>Dirección</th>
                  <th style={{ minWidth: "100px", whiteSpace: "nowrap" }}>A Nombre De</th>
                  <th style={{ width: "100%" }}>Cambio</th>
                </tr>
              </thead>
              <tbody>
              {currentPageData.length > 0 ? (
                currentPageData.map(([id, item]) => (
                  <tr key={id}>
                    <td style={{ textAlign: "center" }}>{item.fecha || ""}</td>
                    <td style={{ textAlign: "center" }}>{item.hora || ""}</td>
                    <td style={{ textAlign: "center" }}>{item.usuario || ""}</td>
                    <td style={{ textAlign: "center" }}>{item.modulo || ""}</td>
                    <td style={{ textAlign: "center" }}>{item.fechaRegistro || ""}</td>
                    <td style={{ textAlign: "center" }}>{item.direccionRegistro || ""}</td>
                    <td style={{ textAlign: "center" }}>{item.anombredeRegistro || ""}</td>
                    <td style={{ textAlign: "center" }}>{item.detalle || ""}</td>
                  </tr>
                ))
              ) : (
                <tr className="no-data">
                  <td colSpan="8">No hay registros disponibles</td>
                </tr>
              )}
            </tbody>
            </table>
          </div>

          <div className="pagination-container">
            <div className="pagination-info">
              <span>
                Mostrando {totalItems > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, totalItems)} de {totalItems} registros
              </span>
              <div className="items-per-page">
                <label>Mostrar:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
                <span>por página</span>
              </div>
            </div>

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
        </div>
      </div>
    </>
  );
};

export default React.memo(HistorialCambios);
