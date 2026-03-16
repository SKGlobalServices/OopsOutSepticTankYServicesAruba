import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, onValue, remove } from "firebase/database";
import Slidebar from "./Slidebar";
import Clock from "./Clock";
import Swal from "sweetalert2";

const HistorialCambios = () => {
  const [data, setData] = useState([]);
  const [, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);

  // LOADER
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

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

  // Cálculos de paginación
  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = data.slice(startIndex, endIndex);

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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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
          <div
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
          </div>

          <div className="table-container">
            <table className="service-table">
              <thead>
                <tr>
                  <th style={{ minWidth: "80px", whiteSpace: "nowrap" }}>Fecha</th>
                  <th style={{ minWidth: "80px", whiteSpace: "nowrap" }}>Hora</th>
                  <th style={{ minWidth: "150px", whiteSpace: "nowrap" }}>Quien</th>
                  <th style={{ minWidth: "150px", whiteSpace: "nowrap" }}>Modulo de Cambio</th>
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
                    <td style={{ textAlign: "center" }}>{item.detalle || ""}</td>
                  </tr>
                ))
              ) : (
                <tr className="no-data">
                  <td colSpan="5">No hay registros disponibles</td>
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
