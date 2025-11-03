import React, { useState, useEffect, useRef, useMemo } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, push, onValue, set, update, remove } from "firebase/database";
import { decryptData } from "../utils/security";
import Swal from "sweetalert2";
import Slidebar from "./Slidebar";
import Clock from "./Clock";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Select from "react-select";
import filtericon from "../assets/img/filters_icon.jpg";

const formatDateWithHyphen = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// Helper para mostrar moneda
const formatCurrency = (amount) =>
  Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const Extras = () => {
  // CSS embebido para mejoras móviles
  const mobileStyles = `
    /* Estilos para texto ajustable */
  .texto-ajustable {
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* Media Queries - Estilos para móviles (768px y menos) */
    @media (max-width: 768px) {
      /* Inputs y Selects más grandes en móviles */
      .filter-slidebar input, .filter-slidebar select {
        font-size: 13px !important;
        padding: 6px 8px;
        min-height: 32px;
      }

      /* Botones más grandes en móviles */
      .filter-button, .discard-filter-button {
        font-size: 13px;
        padding: 6px 12px;
        min-height: 32px;
      }

      .delete-button {
        font-size: 13px !important;
        padding: 4px 8px !important;
        min-height: 30px;
        min-width: 70px !important;
      }

      .create-table-button {
        width: 55px;
        height: 55px;
        font-size: 26px;
      }

      /* Texto de párrafos más grande */
      p {
        font-size: 13px !important;
      }

      /* Labels más grandes */
      label {
        font-size: 13px;
      }

      /* Headers de tabla más grandes */
      .service-table th {
        font-size: 13px !important;
        padding: 6px 4px;
      }

      /* Contenido de celdas de tabla */
      .service-table td {
        font-size: 13px !important;
        padding: 4px 3px;
      }

      /* Inputs dentro de la tabla */
      .service-table input[type="number"],
      .service-table select {
        font-size: 13px !important;
        padding: 4px 6px !important;
        min-height: 30px;
      }

      /* DatePicker en tabla */
      .calendar-datepicker {
        font-size: 13px !important;
        padding: 4px 6px !important;
        min-height: 30px;
        width: 120px !important;
      }

      /* Controles de paginación más grandes */
      .pagination-info span {
        font-size: 13px;
      }

      .pagination-controls button {
        font-size: 13px;
        padding: 4px 8px;
        min-height: 32px;
      }

      .pagination-controls span {
        font-size: 13px;
        padding: 4px 10px;
      }

      .items-per-page label,
      .items-per-page span {
        font-size: 13px;
      }

      .items-per-page select {
        font-size: 13px;
        padding: 6px 8px;
        min-height: 32px;
      }

      /* Filtros en slidebar */
      .filter-slidebar h2 {
        font-size: 16px;
      }

      .filter-slidebar label {
        font-size: 13px;
      }

      /* React-Select components */
      .css-1s2u09g-control,
      .css-1pahdxg-control {
        min-height: 32px !important;
        font-size: 13px !important;
      }

      .css-1wa3eu0-placeholder,
      .css-1dimb5e-singleValue {
        font-size: 13px !important;
      }

      /* DatePicker */
      .react-datepicker {
        font-size: 13px !important;
      }

      .react-datepicker__day,
      .react-datepicker__day-name,
      .react-datepicker__current-month {
        font-size: 13px !important;
      }

      /* Title */
      .title-page {
        font-size: 20px !important;
      }

      .current-date {
        font-size: 13px !important;
      }

      /* Card de total */
      .homepage-card div[style*="display: flex"] div {
        font-size: 13px !important;
      }

      .homepage-card div[style*="display: flex"] div p {
        font-size: 13px !important;
      }

      /* Asegurar que todos los elementos de tabla sean legibles */
      .service-table {
        font-size: 13px;
      }

      /* No hay registros mensaje */
      .service-table td[colspan] {
        font-size: 13px !important;
        text-align: center;
        padding: 20px;
      }

      /* Valores calculados en tabla */
      .service-table td[style*="fontWeight: \"bold\""] {
        font-size: 13px !important;
      }

      /* Selects específicos de la tabla */
      .service-table select[style*="width: 140px"],
      .service-table select[style*="width: 150px"] {
        font-size: 13px !important;
        min-width: 120px !important;
      }

      /* Input de valor para "Otros" */
      .service-table input[style*="width: 80px"] {
        font-size: 13px !important;
        min-width: 70px !important;
      }
    }
  `;

  const [extras, setExtras] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedExtras, setLoadedExtras] = useState(false);
  const [loadedUsers, setLoadedUsers] = useState(false);
  const [localValues, setLocalValues] = useState({});

  // Manejo de notas
  const handleNotesClick = (id, currentNotes) => {
    Swal.fire({
      title: "Notas",
      input: "textarea", 
      inputValue: currentNotes || "",
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        const notes = result.value;
        handleFieldChange(id, "notas", notes);
        Swal.fire("Guardado", "Notas guardadas correctamente", "success");
      }
    });
  };

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Filtros
  const [filters, setFilters] = useState({
    realizado: [],
    servicioAdicional: [],
    fechaInicio: null,
    fechaFin: null,
  });
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const filterSlidebarRef = useRef(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const serviciosAdicionales = {
    Semanal: 15,
    Dominical: 50,
    Emergencia: 50,
    Otros: "",
  };
  const isOtros = (servicio) =>
    String(servicio || "").toLowerCase() === "otros";

  // Cargar usuarios excluyendo usernotactive
  useEffect(() => {
    const usersRef = ref(database, "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const usersList = Object.entries(usersData)
          .filter(
            ([, user]) => user.role !== "usernotactive" && user.name !== "IT"
          )
          .map(([id, user]) => ({ id, name: user.name }));
        usersList.sort((a, b) => a.name.localeCompare(b.name));
        setUsers(usersList);
      } else {
        setUsers([]);
      }
      setLoadedUsers(true);
    });
    return () => unsubscribe();
  }, []);

  // Cargar extras ordenados por timestamp (más reciente primero)
  useEffect(() => {
    const extrasRef = ref(database, "extras");
    const unsubscribe = onValue(extrasRef, (snapshot) => {
      if (snapshot.exists()) {
        const extrasData = snapshot.val();
        const extrasList = Object.entries(extrasData)
          .map(([id, extra]) => ({ id, ...extra }))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setExtras(extrasList);
      } else {
        setExtras([]);
      }
      setLoadedExtras(true);
    });
    return () => unsubscribe();
  }, []);

  // Control de carga
  useEffect(() => {
    if (loadedExtras && loadedUsers) {
      setLoading(false);
    }
  }, [loadedExtras, loadedUsers]);

  // Actualizar campos
  const handleFieldChange = async (id, field, value) => {
    try {
      const currentExtra = extras.find((e) => e.id === id) || {};
      let updateData = { [field]: value };

      const nextServicio =
        field === "servicioAdicional" ? value : currentExtra.servicioAdicional;
      const nextCantidadRaw =
        field === "cantidad" ? value : currentExtra.cantidad;
      const nextCantidad = isOtros(nextServicio)
        ? 1
        : parseFloat(nextCantidadRaw) || 0;

      if (field === "servicioAdicional") {
        if (isOtros(value)) {
          updateData.cantidad = 1;
          updateData.valor =
            currentExtra.valor != null ? currentExtra.valor : 0;
        } else {
          const tarifa = serviciosAdicionales[value] || 0;
          updateData.valor = nextCantidad * tarifa;
        }
      }

      if (field === "cantidad") {
        if (isOtros(nextServicio)) {
          updateData.cantidad = 1;
          updateData.valor =
            currentExtra.valor != null ? currentExtra.valor : 0;
        } else {
          const tarifa = serviciosAdicionales[nextServicio] || 0;
          updateData.valor = nextCantidad * tarifa;
        }
      }

      if (field === "valor") {
        const num = parseFloat(value);
        updateData.valor = Number.isFinite(num) ? num : 0;
      }

      await update(ref(database, `extras/${id}`), updateData);

      setExtras((prev) =>
        prev
          .map((extra) => (extra.id === id ? { ...extra, ...updateData } : extra))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      );

      setLocalValues((prev) => {
        const nxt = { ...prev };
        if (updateData.cantidad !== undefined)
          nxt[`${id}_cantidad`] = updateData.cantidad;
        if (updateData.valor !== undefined)
          nxt[`${id}_valor`] = updateData.valor;
        return nxt;
      });
    } catch (error) {
      console.error("Error updating field:", error);
      Swal.fire("Error", "No se pudo actualizar el campo", "error");
    }
  };

  // Agregar nuevo registro
  const addData = async () => {
    const hoy = formatDateWithHyphen(new Date());
    const newData = {
      fecha: hoy,
      cantidad: "",
      servicioAdicional: "",
      realizado: "",
      notas: "",
      valor: 0,
      timestamp: Date.now(),
      createdBy: decryptData(localStorage.getItem("user"))?.name || "Admin",
    };

    try {
      const extrasRef = ref(database, "extras");
      const newRef = push(extrasRef);
      await set(newRef, newData);
    } catch (error) {
      console.error("Error adding data:", error);
      Swal.fire("Error", "No se pudo agregar el registro", "error");
    }
  };

  // Eliminar registro
  const deleteRecord = async (id) => {
    const result = await Swal.fire({
      title: "¿Eliminar registro?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await remove(ref(database, `extras/${id}`));
        Swal.fire("Eliminado", "El registro ha sido eliminado", "success");
      } catch (error) {
        console.error("Error deleting record:", error);
        Swal.fire("Error", "No se pudo eliminar el registro", "error");
      }
    }
  };

  // Obtener nombre de usuario
  const getUserName = (userId) => {
    const user = users.find((u) => u.id === userId);
    return user ? user.name : "";
  };

  // Filtrado y ordenamiento por fecha
  const filteredExtras = extras
    .filter((extra) => {
      if (filters.fechaInicio && filters.fechaFin) {
        const [day, month, year] = extra.fecha.split("-");
        const itemDate = new Date(year, month - 1, day);
        if (itemDate < filters.fechaInicio || itemDate > filters.fechaFin)
          return false;
      }

      if (filters.realizado.length > 0) {
        const matchRealizado = filters.realizado.some((filterValue) => {
          if (filterValue === "__EMPTY__") {
            return !extra.realizado || extra.realizado.trim() === "";
          }
          return extra.realizado === filterValue;
        });
        if (!matchRealizado) return false;
      }

      if (filters.servicioAdicional.length > 0) {
        const matchServicio = filters.servicioAdicional.some((filterValue) => {
          if (filterValue === "__EMPTY__") {
            return (
              !extra.servicioAdicional || extra.servicioAdicional.trim() === ""
            );
          }
          return extra.servicioAdicional === filterValue;
        });
        if (!matchServicio) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const [dayA, monthA, yearA] = (a.fecha || "").split("-");
      const [dayB, monthB, yearB] = (b.fecha || "").split("-");
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateB - dateA; // Más reciente primero
    });

  // >>> Total General (suma de "valor" sobre el conjunto filtrado) <<<
  const totalGeneralValor = useMemo(
    () =>
      filteredExtras.reduce(
        (sum, item) => sum + (parseFloat(item.valor) || 0),
        0
      ),
    [filteredExtras]
  );

  // Paginación
  const totalItems = filteredExtras.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredExtras.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const goToPreviousPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  const handleItemsPerPageChange = (newSize) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  // Manejo del rango de fechas
  const handleDateRangeChange = (dates) => {
    const [start, end] = dates;
    setFilters((prev) => ({
      ...prev,
      fechaInicio: start
        ? new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
            0,
            0,
            0
          )
        : null,
      fechaFin: end
        ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59)
        : null,
    }));
  };

  // Slidebar de filtros
  const toggleFilterSlidebar = () => setShowFilterSlidebar(!showFilterSlidebar);
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

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  return (
    <div className="homepage-container">
      {/* Inyectar estilos CSS para móviles */}
      <style>{mobileStyles}</style>
      
      <Slidebar />

      {/* Filtros */}
      <div onClick={() => toggleFilterSlidebar(!showFilterSlidebar)}>
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

        <button
          onClick={() => setShowDatePicker((s) => !s)}
          className="filter-button"
        >
          {showDatePicker
            ? "Ocultar selector de fechas"
            : "Filtrar por rango de fechas"}
        </button>
        {showDatePicker && (
          <DatePicker
            selected={filters.fechaInicio}
            onChange={handleDateRangeChange}
            startDate={filters.fechaInicio}
            endDate={filters.fechaFin}
            selectsRange
            inline
          />
        )}

        <label>Realizado Por</label>
        <Select
          isClearable
          isMulti
          options={[
            { value: "__EMPTY__", label: "🚫 Vacío" },
            ...users.map((u) => ({ value: u.id, label: u.name })),
          ]}
          placeholder="Usuario(s)..."
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              realizado: opts ? opts.map((o) => o.value) : [],
            }))
          }
          value={filters.realizado.map((id) => ({
            value: id,
            label:
              id === "__EMPTY__"
                ? "🚫 Vacío"
                : users.find((u) => u.id === id)?.name || id,
          }))}
        />

        <label>Servicio Adicional</label>
        <Select
          isClearable
          isMulti
          options={[
            { value: "__EMPTY__", label: "🚫 Vacío" },
            ...Object.keys(serviciosAdicionales).map((servicio) => ({
              value: servicio,
              label: servicio,
            })),
          ]}
          placeholder="Servicio(s)..."
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              servicioAdicional: opts ? opts.map((o) => o.value) : [],
            }))
          }
          value={filters.servicioAdicional.map((servicio) => ({
            value: servicio,
            label: servicio === "__EMPTY__" ? "🚫 Vacío" : servicio,
          }))}
        />

        <button
          className="discard-filter-button"
          onClick={() =>
            setFilters({
              realizado: [],
              servicioAdicional: [],
              fechaInicio: null,
              fechaFin: null,
            })
          }
        >
          Descartar Filtros
        </button>
      </div>

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Extras</h1>
          <div className="current-date">
            <div style={{cursor:"default"}}>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        {/* === NUEVO: Tarjeta Total General Valor (sobre los registros filtrados) === */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "10px",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              border: "1px solid #ddd",
              color: "#fff",
              borderRadius: "6px",
              padding: "8px",
              flex: 1,
              textAlign: "center",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              backgroundColor: "#28a745",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-6px) scale(1.01)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
              e.currentTarget.style.borderColor = "#ddd";
              e.currentTarget.style.backgroundColor = "#218838";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
              e.currentTarget.style.borderColor = "#ddd";
              e.currentTarget.style.backgroundColor = "#28a745";
            }}
          >
            <p
              style={{
                margin: "0",
                fontSize: "12px",
                pointerEvents: "none",
                fontWeight: "bold",
              }}
            >
              Total General (Valor)
            </p>
            <p
              style={{
                margin: "0",
                fontSize: "12px",
                pointerEvents: "none",
                fontWeight: "bold",
              }}
            >
              AWG {formatCurrency(totalGeneralValor)}
            </p>
          </div>
        </div>

        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th style={{ textAlign: "center" }}>Fecha</th>
                <th>Cantidad</th>
                <th>Servicio Adicional</th>
                <th>Realizado</th>
                <th>Notas</th>
                <th>Valor</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.length > 0 ? (
                currentPageData.map((extra) => {
                  return (
                    <tr key={extra.id}>
                      <td style={{ minWidth: "120px", textAlign: "center" }}>
                        <DatePicker
                          selected={
                            extra.fecha
                              ? new Date(
                                  extra.fecha.split("-")[2],
                                  extra.fecha.split("-")[1] - 1,
                                  extra.fecha.split("-")[0]
                                )
                              : null
                          }
                          onChange={(date) => {
                            const nuevaFecha = formatDateWithHyphen(date);
                            handleFieldChange(extra.id, "fecha", nuevaFecha);
                          }}
                          dateFormat="dd-MM-yyyy"
                          className="calendar-datepicker"
                          placeholderText="Selecciona fecha"
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          value={
                            isOtros(extra.servicioAdicional)
                              ? 1
                              : localValues[`${extra.id}_cantidad`] ??
                                extra.cantidad ??
                                ""
                          }
                          onChange={(e) =>
                            setLocalValues((prev) => ({
                              ...prev,
                              [`${extra.id}_cantidad`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (isOtros(extra.servicioAdicional)) {
                              handleFieldChange(extra.id, "cantidad", 1);
                              return;
                            }
                            if (e.target.value !== (extra.cantidad || "")) {
                              handleFieldChange(
                                extra.id,
                                "cantidad",
                                e.target.value
                              );
                            }
                          }}
                          min="0"
                          step="1"
                          style={{ width: "80px", textAlign: "center" }}
                          disabled={isOtros(extra.servicioAdicional)}
                        />
                      </td>

                      <td>
                        <select
                          value={extra.servicioAdicional || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              extra.id,
                              "servicioAdicional",
                              e.target.value
                            )
                          }
                          style={{ width: "140px" }}
                        >
                          <option value=""></option>
                          {Object.entries(serviciosAdicionales).map(
                            ([servicio, valor]) => (
                              <option key={servicio} value={servicio}>
                                {servicio} (AWG {valor})
                              </option>
                            )
                          )}
                        </select>
                      </td>

                      <td>
                        <select
                          value={extra.realizado || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              extra.id,
                              "realizado",
                              e.target.value
                            )
                          }
                          style={{ width: "150px" }}
                        >
                          <option value=""></option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <button
                          style={{
                            border: "none",
                            backgroundColor: "transparent", 
                            borderRadius: "0.25em",
                            color: "black",
                            cursor: "pointer",
                            fontSize: "1em",
                            maxWidth: "20ch",
                            textAlign: "left",
                            width: "100%",
                          }}
                          onClick={() => handleNotesClick(extra.id, extra.notas)}
                        >
                          {extra.notas ? (
                            <p className="texto-ajustable">
                              {extra.notas || ""}
                            </p>
                          ) : (
                            <span
                              style={{
                                width: "100%",
                                display: "inline-block",
                              }}
                            ></span>
                          )}
                        </button>
                      </td>

                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        {isOtros(extra.servicioAdicional) ? (
                          <input
                            type="number"
                            value={
                              localValues[`${extra.id}_valor`] ??
                              extra.valor ??
                              0
                            }
                            onChange={(e) =>
                              setLocalValues((prev) => ({
                                ...prev,
                                [`${extra.id}_valor`]: e.target.value,
                              }))
                            }
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v !== String(extra.valor ?? "")) {
                                handleFieldChange(extra.id, "valor", v);
                              }
                            }}
                            step="0.01"
                            style={{ width: "80px", fontWeight: "bold", textAlign: "center" }}
                          />
                        ) : (
                          <>{(extra.valor || 0).toFixed(2)} AWG</>
                        )}
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <button
                          style={{ marginRight: "16px" }}
                          className="delete-button"
                          onClick={() => deleteRecord(extra.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6">No hay registros disponibles</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Controles de paginación */}
        <div className="pagination-container">
          <div className="pagination-info">
            <span>
              Mostrando {totalItems === 0 ? 0 : startIndex + 1}-
              {Math.min(endIndex, totalItems)} de {totalItems} registros
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

      {/* Botón para agregar nuevo registro */}
      <button className="create-table-button" onClick={addData}>
        +
      </button>
    </div>
  );
};

export default React.memo(Extras);
