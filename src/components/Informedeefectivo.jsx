import React, { useState, useEffect, useMemo } from "react";
import { sanitizeForLog } from "../utils/security";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Slidebar from "./Slidebar";
import excel_icon from "../assets/img/excel_icon.jpg";
import pdf_icon from "../assets/img/pdf_icon.jpg";
import Swal from "sweetalert2";
import Clock from "./Clock";
import InformeFiltersPanel from "./InformeFiltersPanel";
import { useInformeSourceData } from "../hooks/UseInformeHook";
import { useInformeEfectivoProjection } from "../hooks/UseInformeEfectivoProjection";
import { useInformeFilters } from "../hooks/useInformeFilters";
import { useInformePagination } from "../hooks/useInformePagination";
import { useInformeEfectivoGuards } from "../hooks/useInformeEfectivoGuards";
import { exportInformePdf, exportInformeXlsx } from "../services/informeExportService";
import { auditBulkUpdate, auditCreate, auditRemove } from "../utils/auditLogger";
import {
  formatDateWithHyphen,
  getEfectivoValue,
  getMetodoPagoColor,
  getUserDisplayName,
  parseDateStringToDate,
} from "../utils/informeUtils";
import {
  markInformeLoadComplete,
  markInformeLoadStart,
  trackInformeWrites,
} from "../utils/informeMetrics";

const Informedeefectivo = () => {
  const {
    registroFechasData,
    dataData,
    dataInformedeefectivoData,
    allUsers,
    clients,
    loading: sourceLoading,
  } = useInformeSourceData();
  const users = useMemo(() => {
    const fetchedUsers = allUsers
      .filter((user) => user?.role !== "admin")
      .filter((user) => user?.role !== "contador")
      .map(({ id, name, role }) => ({ id, name, role }));
    fetchedUsers.sort((a, b) => a.name.localeCompare(b.name));
    return fetchedUsers;
  }, [allUsers]);
  // Filtros y orden reutilizables para no repetir la logica entre pantallas.
  const {
    filters,
    setFilters,
    resetFilters,
    handleDateRangeChange,
    filterRecords,
    sortRecordsByDateAsc,
  } = useInformeFilters();
  // Proyecta y materializa solo los registros de efectivo para que el nodo informe no cargue ruido.
  const projectedInformeEfectivoData = useInformeEfectivoProjection({
    registroFechasData,
    dataData,
    dataInformedeefectivoData,
    loading: sourceLoading,
  });
  const [directions, setDirections] = useState([]);
  const loading = sourceLoading;

  // Estados para edición y último id agregado
  const [, setLastAddedId] = useState(null);
  const [editingRows, setEditingRows] = useState({});

  // Estados locales para campos editables y cambios pendientes.
  const [localValues, setLocalValues] = useState({});
  const [pendingChanges, setPendingChanges] = useState({});

  // Alternar modo edición
  const toggleEditRow = (id) => {
    setEditingRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Actualizar la lista de direcciones usando solo la proyeccion efectiva que ve el informe.
  useEffect(() => {
    const newDirections = new Set();
    projectedInformeEfectivoData.forEach((record) => {
      if (record.direccion && record.direccion.trim() !== "") {
        newDirections.add(record.direccion);
      }
    });
    setDirections([...newDirections].sort());
  }, [projectedInformeEfectivoData]);

  useEffect(() => {
    markInformeLoadStart("Informedeefectivo");
  }, []);

  // --- DEFINICIÓN DE displayedRecords ---
  // Se calculan a partir de la proyeccion efectiva y luego se aplican los filtros visibles.
  const displayedRecords = useMemo(
    () => filterRecords(projectedInformeEfectivoData),
    [filterRecords, projectedInformeEfectivoData]
  );

  // --- CALCULAR EL SALDO ACUMULADO ---
  // Se ordenan de forma ascendente para calcular el saldo acumulado, luego se invierte el arreglo para la tabla.
  const computedRecords = useMemo(() => {
    const ascRecords = sortRecordsByDateAsc(displayedRecords);
    let runningBalance = 0;
    const withSaldo = ascRecords.map((record) => {
      runningBalance += getEfectivoValue(record);
      return { ...record, saldo: runningBalance };
    });
    return withSaldo.reverse();
  }, [displayedRecords, sortRecordsByDateAsc]);

  // La tabla solo muestra el mes de abril hacia adelante, pero el saldo ya viene calculado con el histórico completo.
  const visibleFromCurrentMonthRecords = useMemo(() => {
    const fixedStartDate = new Date(2026, 3, 1); // 1 de Abril de 2026

    return computedRecords.filter((record) => {
      const recordDate = parseDateStringToDate(record.fecha);
      return recordDate && recordDate >= fixedStartDate;
    });
  }, [computedRecords]);

  useEffect(() => {
    if (loading) return;

    markInformeLoadComplete("Informedeefectivo", {
      projectedRecords: projectedInformeEfectivoData.length,
      visibleRecords: visibleFromCurrentMonthRecords.length,
    });
  }, [
    loading,
    projectedInformeEfectivoData.length,
    visibleFromCurrentMonthRecords.length,
  ]);

  const recordsById = useMemo(() => {
    return new Map(
      projectedInformeEfectivoData.map((record) => [record.id, record])
    );
  }, [projectedInformeEfectivoData]);

  const isDirty = useMemo(
    () => Object.keys(pendingChanges).length > 0,
    [pendingChanges]
  );

  useInformeEfectivoGuards({
    isDirty,
    moduleLabel: "Informe de Efectivo",
    entryTitle: "Informe de Efectivo actualizado",
    entryText:
      "Se realizaron cambios en este módulo. Desde ahora, los cambios solo se guardan cuando presionas Guardar Cambios.",
    exitTitle: "Cambios pendientes por guardar",
    exitText:
      "Tienes cambios pendientes en Informe de Efectivo. Si sales sin guardar, perderás esos cambios.",
  });

  // Capa de paginacion reusable para no repetir indices y saltos entre pantallas.
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
  } = useInformePagination(visibleFromCurrentMonthRecords, 50);

  // Cada cambio de filtro vuelve la vista a la primera pagina para no dejar al usuario fuera de rango.
  useEffect(() => {
    resetPage();
  }, [filters, resetPage]);

  // --- FUNCIONALIDAD DE EXPORTACIÓN ---
  const getExportRecords = () => {
    const exportRecords = [];
    for (const rec of visibleFromCurrentMonthRecords) {
      if (rec.saldo <= 0) break;
      exportRecords.push(rec);
    }
    return exportRecords;
  };

  // Guarda el cambio en memoria hasta que el usuario confirme el lote completo.
  const queueFieldChange = (registro, field, rawValue) => {
    const value =
      field === "fecha" && rawValue instanceof Date
        ? formatDateWithHyphen(rawValue)
        : rawValue;
    const originalRecord = recordsById.get(registro.id) ?? registro;
    const originalValue = originalRecord?.[field] ?? "";

    setLocalValues((prev) => ({
      ...prev,
      [`${registro.id}_${field}`]: value,
    }));

    setPendingChanges((prev) => {
      const currentEntry = prev[registro.id] ?? {
        origin: registro.origin,
        sourceFecha: registro.fecha,
        updates: {},
      };
      const nextUpdates = { ...currentEntry.updates };

      if (String(value ?? "") === String(originalValue ?? "")) {
        delete nextUpdates[field];
      } else {
        nextUpdates[field] = value;
      }

      if (field === "direccion") {
        const matchingClient = clients.find(
          (client) => client.direccion === value
        );
        if (matchingClient) {
          nextUpdates.cubicos = matchingClient.cubicos;
        } else {
          delete nextUpdates.cubicos;
        }
      }

      Object.keys(nextUpdates).forEach((key) => {
        const nextValue = nextUpdates[key];
        const originalFieldValue = originalRecord?.[key] ?? "";
        if (String(nextValue ?? "") === String(originalFieldValue ?? "")) {
          delete nextUpdates[key];
        }
      });

      if (Object.keys(nextUpdates).length === 0) {
        const next = { ...prev };
        delete next[registro.id];
        return next;
      }

      return {
        ...prev,
        [registro.id]: {
          ...currentEntry,
          origin: registro.origin,
          sourceFecha: currentEntry.sourceFecha ?? registro.fecha,
          updates: nextUpdates,
        },
      };
    });
  };

  const handleSaveChanges = async () => {
    if (!isDirty) return;

    const batchUpdates = {};

    Object.entries(pendingChanges).forEach(([id, change]) => {
      const originalRecord = recordsById.get(id);
      if (!originalRecord) return;

      const mergedRecord = {
        ...originalRecord,
        ...change.updates,
      };
      delete mergedRecord.saldo;

      if (change.origin === "registrofechas" && change.sourceFecha) {
        const nextFecha = String(change.updates.fecha || change.sourceFecha).trim();
        batchUpdates[`registrofechas/${nextFecha}/${id}`] = mergedRecord;
        if (nextFecha !== change.sourceFecha) {
          batchUpdates[`registrofechas/${change.sourceFecha}/${id}`] = null;
        }
      } else if (change.origin === "data") {
        batchUpdates[`data/${id}`] = mergedRecord;
      } else {
        batchUpdates[`informedeefectivo/${id}`] = mergedRecord;
      }
    });

    if (Object.keys(batchUpdates).length === 0) return;

    try {
      await auditBulkUpdate(batchUpdates, {
        modulo: "Informe De Efectivo",
        registroId: "lote-informe-efectivo",
        extra: `Registros afectados: ${Object.keys(batchUpdates).length}`,
      });
      trackInformeWrites("Informedeefectivo", Object.keys(batchUpdates).length, {
        action: "saveChanges",
      });
      setPendingChanges({});
      setLocalValues({});
      setEditingRows({});
      await Swal.fire({
        icon: "success",
        title: "Cambios guardados",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error al guardar cambios:", sanitizeForLog(error.message));
      await Swal.fire({
        icon: "error",
        title: "No se pudieron guardar los cambios",
        text: "Intenta nuevamente.",
      });
    }
  };

  const handleDiscardChanges = async () => {
    if (!isDirty) {
      setEditingRows({});
      setLocalValues({});
      return;
    }

    const result = await Swal.fire({
      title: "Descartar cambios",
      text: "Se perderán los cambios sin guardar.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, descartar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    setPendingChanges({});
    setLocalValues({});
    setEditingRows({});
  };

  // Elimina el origen real y deja que la proyeccion limpie el espejo cuando la fuente deje de existir.
  const handleDeleteRecord = async (registro) => {
    const result = await Swal.fire({
      title: "¿Eliminar registro?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      if (registro.origin === "registrofechas" && registro.fecha) {
        await auditRemove(`registrofechas/${registro.fecha}/${registro.id}`, {
          modulo: "Informe De Efectivo",
          registroId: registro.id,
          extra: `Eliminación desde ${registro.origin}`,
        });
      } else if (registro.origin === "data") {
        await auditRemove(`data/${registro.id}`, {
          modulo: "Informe De Efectivo",
          registroId: registro.id,
          extra: `Eliminación desde ${registro.origin}`,
        });
      } else {
        await auditRemove(`informedeefectivo/${registro.id}`, {
          modulo: "Informe De Efectivo",
          registroId: registro.id,
          extra: `Eliminación desde ${registro.origin}`,
        });
      }

      trackInformeWrites("Informedeefectivo", 1, {
        action: "delete",
        origin: registro.origin,
      });

      setPendingChanges((prev) => {
        if (!prev[registro.id]) return prev;
        const next = { ...prev };
        delete next[registro.id];
        return next;
      });
      setLocalValues((prev) => {
        const next = { ...prev };
        delete next[`${registro.id}_direccion`];
        delete next[`${registro.id}_efectivo`];
        delete next[`${registro.id}_realizadopor`];
        delete next[`${registro.id}_fecha`];
        return next;
      });
      setEditingRows((prev) => {
        if (!prev[registro.id]) return prev;
        const next = { ...prev };
        delete next[registro.id];
        return next;
      });
    } catch (error) {
      console.error("Error al eliminar:", sanitizeForLog(error.message));
    }
  };

  const getUserName = (userId) => getUserDisplayName(userId, users);

  // FUNCION AUXILIAR PARA EXPORTAR REGISTROS EN XLSX
  const generateXLSX = async () => {
    await exportInformeXlsx({
      records: getExportRecords(),
      getUserName,
    });
  };

  // FUNCION PARA GENERAR PDF USANDO el servicio compartido.
  const generatePDF = async () => {
    await exportInformePdf({
      records: getExportRecords(),
      getUserName,
      title: "Informe De Efectivo",
    });
  };

  // FUNCION PARA MOSTRAR RESUMEN DE "EFECTIVO TOTAL" POR TRABAJADOR
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
          <td style="border: 1px solid #ddd; padding: 8px;">${userName}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${total.toFixed(
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
            <th style="border: 1px solid #ddd; padding: 8px;">Trabajador</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Total Efectivo</th>
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

  const addData = async (realizadopor, direccion, metododepago, efectivo) => {
    if (String(metododepago || "").trim().toLowerCase() !== "efectivo") {
      return;
    }
    const currentFecha = formatDateWithHyphen(new Date());
    const newData = {
      // Se guarda el id del usuario para mantener la relación estable con el catálogo.
      realizadopor: realizadopor,
      fecha: currentFecha,
      metododepago,
      efectivo,
      timestamp: Date.now(),
      origin: "informedeefectivo",
    };
    try {
      const newDataRef = await auditCreate("informedeefectivo", newData, {
        modulo: "Informe De Efectivo",
        extra: "Creación manual desde el informe de efectivo",
      });
      trackInformeWrites("Informedeefectivo", 1, {
        action: "create",
        origin: "informedeefectivo",
      });
      setLastAddedId(newDataRef.key);
    } catch (error) {
      console.error("Error adding data: ", sanitizeForLog(error.message));
    }
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
      <Slidebar />
      <InformeFiltersPanel
        title="Filtros"
        filters={filters}
        setFilters={setFilters}
        onDateRangeChange={handleDateRangeChange}
        resetFilters={resetFilters}
        users={users}
        directions={directions}
      />

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Informe De Efectivo</h1>
          <div className="current-date">
            <div style={{cursor:"default"}}>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        <div className="table-container">
          <datalist id="direccion-options-shared">
            {clients.map((client, idx) => (
              <option key={idx} value={client.direccion} />
            ))}
          </datalist>
          <table className="service-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Realizado Por</th>
                <th className="direccion-fixed-th">Dirección/Nota</th>
                <th>Método De Pago</th>
                <th>Efectivo</th>
                <th>Saldo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.length > 0 ? (
                currentPageData.map((registro) => {
                  const isEditable = editingRows[registro.id] || false;
                  return (
                    <tr key={registro.id}>
                      <td
                        style={{
                          minWidth: "75px",
                          textAlign: "center",
                          fontWeight: "bold",
                          justifyContent: "center",
                          backgroundColor:
                            registro.saldo < 0 ? "red" : "transparent",
                          cursor:
                            isEditable &&
                            registro.origin === "informedeefectivo"
                              ? "default"
                              : "default",
                        }}
                      >
                        {registro.origin === "informedeefectivo" &&
                        isEditable ? (
                          <DatePicker
                            selected={
                              parseDateStringToDate(
                                localValues[`${registro.id}_fecha`] ??
                                  registro.fecha ??
                                  ""
                              )
                            }
                            onChange={(date) => {
                              if (!date) return;
                              queueFieldChange(registro, "fecha", date);
                            }}
                            dateFormat="dd-MM-yyyy"
                            className="calendar-datepicker"
                            placeholderText="Selecciona fecha"
                          />
                        ) : (
                          registro.fecha
                        )}
                      </td>

                      <td>
                        <select
                          value={
                            localValues[`${registro.id}_realizadopor`] ??
                            registro.realizadopor ??
                            ""
                          }
                          onChange={(e) =>
                            queueFieldChange(
                              registro,
                              "realizadopor",
                              e.target.value
                            )
                          }
                          disabled={!isEditable}
                        >
                          <option value=""></option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="direccion-fixed-td">
                        <div className="custom-select-container">
                          <input
                            className="custom-select-input"
                            style={{ width: "18ch" }}
                            type="text"
                            value={
                              localValues[`${registro.id}_direccion`] ??
                              registro.direccion ??
                              ""
                            }
                            onChange={(e) =>
                              setLocalValues((prev) => ({
                                ...prev,
                                [`${registro.id}_direccion`]: e.target.value
                              }))
                            }
                            onBlur={(e) => {
                              if (e.target.value !== (registro.direccion || "")) {
                                queueFieldChange(
                                  registro,
                                  "direccion",
                                  e.target.value
                                );
                              }
                            }}
                            list="direccion-options-shared"
                            disabled={!isEditable}
                          />
                        </div>
                      </td>
                      <td
                        style={{
                          backgroundColor: getMetodoPagoColor(
                            registro.metododepago
                          ),
                          textAlign: "center",
                        }}
                      >
                        <select value={registro.metododepago || ""} disabled>
                          <option value=""></option>
                          <option value="credito">Crédito</option>
                          <option value="cancelado">Cancelado</option>
                          <option value="efectivo">Efectivo</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          style={{ textAlign:"center"}}
                          value={
                            localValues[`${registro.id}_efectivo`] ??
                            registro.efectivo ??
                            ""
                          }
                          onChange={(e) =>
                            setLocalValues((prev) => ({
                              ...prev,
                              [`${registro.id}_efectivo`]: e.target.value
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (registro.efectivo || "")) {
                              queueFieldChange(
                                registro,
                                "efectivo",
                                e.target.value
                              );
                            }
                          }}
                          disabled={
                            !isEditable || registro.metododepago !== "efectivo"
                          }
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {registro.saldo !== undefined
                          ? registro.saldo.toFixed(2)
                          : "0.00"} AWG
                      </td>
                      <td style={{ minWidth: "28ch" }}>
                        {registro.origin === "informedeefectivo" && (
                          <>
                            <button
                              style={{}}
                              onClick={() => toggleEditRow(registro.id)}
                              className={`edit-button ${
                                isEditable ? "editable" : "not-editable"
                              }`}
                            >
                              {isEditable ? "✔" : "Editar"}
                            </button>
                            <button
                              className="edit-button"
                              style={{
                                marginLeft: "5px",
                                backgroundColor: "red",
                                color: "white",
                              }}
                              onClick={() => {
                                handleDeleteRecord(registro);
                              }}
                            >
                              Borrar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7">No hay datos disponibles.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Controles de paginación */}
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

        <div
          className="button-container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button className="filter-button" onClick={handleEfectivoTotal}>
              Efectivo Total
            </button>
            <button
              className="filter-button"
              onClick={handleSaveChanges}
              disabled={!isDirty}
            >
              Guardar Cambios
            </button>
            <button
              className="filter-button"
              onClick={handleDiscardChanges}
              disabled={!isDirty}
            >
              Descartar Cambios
            </button>
          </div>
        </div>
      </div>
      <button className="generate-button1" onClick={generateXLSX}>
        <img className="generate-button-imagen1" src={excel_icon} alt="Excel" />
      </button>
      <button className="generate-button2" onClick={generatePDF}>
        <img className="generate-button-imagen2" src={pdf_icon} alt="PDF" />
      </button>
      <button
        className="create-table-button"
        onClick={() => addData("", "", "efectivo", "")}
      >
        +
      </button>
    </div>
  );
};

export default React.memo(Informedeefectivo);