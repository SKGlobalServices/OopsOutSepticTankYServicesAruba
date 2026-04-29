import React, { useEffect, useMemo } from "react";
import { decryptData } from "../utils/security";
import Slidebaruser from "./Slidebaruser";
import excel_icon from "../assets/img/excel_icon.jpg";
import pdf_icon from "../assets/img/pdf_icon.jpg";
import Swal from "sweetalert2";
import Clock from "./Clock";
import InformeFiltersPanel from "./InformeFiltersPanel";
import { useInformeSourceData } from "../hooks/UseInformeHook";
import { useInformeEfectivoProjection } from "../hooks/UseInformeEfectivoProjection";
import { useInformeFilters } from "../hooks/useInformeFilters";
import { useInformePagination } from "../hooks/useInformePagination";
import { exportInformePdf, exportInformeXlsx } from "../services/informeExportService";
import {
  getEfectivoValue,
  getMetodoPagoColor,
  getUserDisplayName,
} from "../utils/informeUtils";
import {
  markInformeLoadComplete,
  markInformeLoadStart,
} from "../utils/informeMetrics";

const INFORME_USUARIO_METRICS_SCOPE = "Informedeefectivousuario";

const Informedeefectivousuario = () => {
  const {
    registroFechasData,
    dataData,
    dataInformedeefectivoData,
    allUsers,
    loading: sourceLoading,
  } = useInformeSourceData();

  const users = useMemo(() => {
    const fetchedUsers = allUsers
      .filter((user) => user?.role !== "admin")
      .filter((user) => user?.role !== "contador")
      .filter((user) => user?.role !== "usernotactive")
      .filter((user) => user?.name !== "IT")
      .map(({ id, name }) => ({ id, name }));
    fetchedUsers.sort((a, b) => a.name.localeCompare(b.name));
    return fetchedUsers;
  }, [allUsers]);

  const projectedInformeEfectivoData = useInformeEfectivoProjection({
    registroFechasData,
    dataData,
    dataInformedeefectivoData,
    loading: sourceLoading,
  });

  // No escribimos en Firebase desde esta vista; solo normalizamos en memoria los nombres viejos de usuarios.
  const projectedInformeEfectivoReadableData = useMemo(() => {
    return projectedInformeEfectivoData.map((record) => {
      const rawRealizadoPor = String(record.realizadopor || "").trim();
      if (!rawRealizadoPor) return record;

      if (users.some((user) => user.id === rawRealizadoPor)) {
        return record;
      }

      const matchedUser = users.find(
        (user) =>
          String(user.name || "").trim().toLowerCase() ===
          rawRealizadoPor.toLowerCase()
      );

      return matchedUser
        ? { ...record, realizadopor: matchedUser.id }
        : record;
    });
  }, [projectedInformeEfectivoData, users]);

  // Filtros y orden compartidos para evitar duplicar lógica entre módulos.
  const {
    filters,
    setFilters,
    resetFilters,
    handleDateRangeChange,
    filterRecords,
    sortRecordsByDateAsc,
  } = useInformeFilters();

  const loading = sourceLoading;

  const loggedUser = decryptData(localStorage.getItem("user"));
  const myUserId = loggedUser?.id;

  // La lista de direcciones sale solo de la proyección efectiva visible.
  const directions = useMemo(() => {
    const newDirections = new Set();
    projectedInformeEfectivoReadableData.forEach((record) => {
      if (record.direccion) newDirections.add(record.direccion);
    });
    return [...newDirections].sort();
  }, [projectedInformeEfectivoReadableData]);

  useEffect(() => {
    markInformeLoadStart(INFORME_USUARIO_METRICS_SCOPE);
  }, []);

  // Solo los registros del usuario actual y visibles tras la proyección entran al informe.
  const displayedRecords = useMemo(
    () =>
      filterRecords(projectedInformeEfectivoReadableData, {
        restrictToUserId: myUserId,
      }),
    [filterRecords, myUserId, projectedInformeEfectivoReadableData]
  );

  useEffect(() => {
    if (loading) return;

    markInformeLoadComplete(INFORME_USUARIO_METRICS_SCOPE, {
      projectedRecords: projectedInformeEfectivoReadableData.length,
      visibleRecords: displayedRecords.length,
    });
  }, [displayedRecords.length, loading, projectedInformeEfectivoReadableData.length]);

  // Calcula el saldo acumulado y conserva el comportamiento de cortar al primer saldo no positivo.
  const computedRecords = useMemo(() => {
    const ascRecords = sortRecordsByDateAsc(displayedRecords);
    let runningBalance = 0;

    const withSaldo = ascRecords.map((record) => {
      runningBalance += getEfectivoValue(record);
      return { ...record, saldo: runningBalance };
    });

    const reversed = withSaldo.reverse();
    const filteredRecords = [];

    for (const record of reversed) {
      filteredRecords.push(record);
      if (record.saldo <= 0) break;
    }

    return filteredRecords;
  }, [displayedRecords, sortRecordsByDateAsc]);

  // Paginación reusable para mantener la misma lógica que el módulo principal.
  const {
    currentPage,
    itemsPerPage,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    currentPageData,
    goToFirstPage,
    goToLastPage,
    goToPreviousPage,
    goToNextPage,
    handleItemsPerPageChange,
    resetPage,
  } = useInformePagination(computedRecords, 25);

  useEffect(() => {
    resetPage();
  }, [filters, resetPage]);

  // Devuelve el conjunto de exportación ya recortado por saldo.
  const getExportRecords = () => computedRecords;

  const getUserName = (userId) => getUserDisplayName(userId, users);

  // Genera un archivo XLSX con la vista actual del informe.
  const generateXLSX = async () => {
    await exportInformeXlsx({
      records: getExportRecords(),
      getUserName,
    });
  };

  // Genera el PDF con la misma tabla que la exportación Excel.
  const generatePDF = async () => {
    await exportInformePdf({
      records: getExportRecords(),
      getUserName,
      title: "Informe De Efectivo",
    });
  };

  // Muestra un resumen del efectivo total por trabajador para la vista filtrada.
  const handleEfectivoTotal = () => {
    const filteredData = displayedRecords.filter(
      (record) => String(record.realizadopor || "").trim() !== ""
    );

    const totals = {};
    filteredData.forEach((record) => {
      const key = record.realizadopor;
      const efectivoValue = getEfectivoValue(record);
      totals[key] = totals[key] ? totals[key] + efectivoValue : efectivoValue;
    });

    const overallTotal = filteredData.reduce(
      (acc, record) => acc + getEfectivoValue(record),
      0
    );

    const tableRows = Object.entries(totals)
      .map(([userId, total]) => {
        const userName = getUserName(userId) || "Desconocido";
        return `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${userName}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${total.toFixed(
            2
          )}</td>
        </tr>
      `;
      })
      .join("");

    const tableHTML = `
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Trabajador</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Total Efectivo</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">${overallTotal.toFixed(
              2
            )}</th>
          </tr>
        </tbody>
      </table>
    `;

    Swal.fire({
      title: "Suma Total De Efectivo Por Trabajador",
      html: tableHTML,
      width: "50%",
      showCloseButton: true,
    });
  };

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  return (
    <div className="homepage-container">
      <Slidebaruser />
      <InformeFiltersPanel
        title="Filtros"
        filters={filters}
        setFilters={setFilters}
        onDateRangeChange={handleDateRangeChange}
        resetFilters={resetFilters}
        directions={directions}
        showUserFilter={false}
      />

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Informe De Efectivo</h1>
          <div className="current-date">
            <div style={{ cursor: "default" }}>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Realizado Por</th>
                <th className="direccion-fixed-th">Dirección/Nota</th>
                <th>Método De Pago</th>
                <th>Efectivo</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.length > 0 ? (
                currentPageData.map((registro) => {
                  return (
                    <tr key={registro.id}>
                      <td
                        style={{
                          minWidth: "75px",
                          textAlign: "center",
                          fontWeight: "bold",
                          justifyContent: "center",
                          backgroundColor: registro.saldo < 0 ? "red" : "transparent",
                          cursor: "default",
                        }}
                      >
                        {registro.fecha || ""}
                      </td>

                      <td style={{ textAlign: "center" }}>
                        {getUserName(registro.realizadopor)}
                      </td>

                      <td className="direccion-fixed-td">{registro.direccion || ""}</td>

                      <td
                        style={{
                          backgroundColor: getMetodoPagoColor(registro.metododepago),
                          textAlign: "center",
                          color: "white",
                        }}
                      >
                        {registro.metododepago || ""}
                      </td>

                      <td style={{ textAlign: "center" }}>{registro.efectivo || ""}</td>

                      <td style={{ textAlign: "center" }}>
                        {registro.saldo !== undefined ? registro.saldo.toFixed(2) : "0.00"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6">No hay datos disponibles.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-container">
          <div className="pagination-info">
            <span>
              Mostrando {startIndex + 1}-{Math.min(endIndex, totalItems)} de {totalItems} registros
            </span>
            <div className="items-per-page">
              <label>Mostrar:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
              <span>por página</span>
            </div>
          </div>

          <div className="pagination-controls">
            <button onClick={goToFirstPage} disabled={currentPage === 1} title="Primera página">
              ««
            </button>
            <button onClick={goToPreviousPage} disabled={currentPage === 1} title="Página anterior">
              «
            </button>
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <button onClick={goToNextPage} disabled={currentPage === totalPages} title="Página siguiente">
              »
            </button>
            <button onClick={goToLastPage} disabled={currentPage === totalPages} title="Última página">
              »»
            </button>
          </div>
        </div>

        <div
          className="button-container"
          style={{
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            width: "100%",
            gap: "12px",
          }}
        >
          <button className="filter-button" onClick={handleEfectivoTotal}>
            Efectivo Total
          </button>
        </div>
      </div>

      <button className="generate-button1" onClick={generateXLSX}>
        <img className="generate-button-imagen1" src={excel_icon} alt="Excel" />
      </button>
      <button className="generate-button2" onClick={generatePDF}>
        <img className="generate-button-imagen2" src={pdf_icon} alt="PDF" />
      </button>
    </div>
  );
};

export default React.memo(Informedeefectivousuario);