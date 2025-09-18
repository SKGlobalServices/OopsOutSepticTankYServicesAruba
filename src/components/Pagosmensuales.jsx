import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, set, push, onValue, update } from "firebase/database";
import Select from "react-select";
import Slidebar from "./Slidebar";
import filtericon from "../assets/img/filters_icon.jpg";
import Clock from "./Clock";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Swal from "sweetalert2";

const Pagosmensuales = () => {
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const filterSlidebarRef = useRef(null);

  const [data, setData] = useState([]);
  const [localValues, setLocalValues] = useState({});
  const [showDuplicatesAlert, setShowDuplicatesAlert] = useState(true);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Mostrar/ocultar datepicker
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Filtros (se filtra por el campo 'fecha')
  const [filters, setFilters] = useState({
    compania: [],
    concepto: [],
    monto: [],
    estado: [],
    fechaInicio: null,
    fechaFin: null,
    mes: null,
    año: null,
  });

  // ====== Carga de datos (Pagos Mensuales) ======
  useEffect(() => {
    const dbRef = ref(database, "pagosmensuales");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (!snapshot.exists()) {
        setData([]);
        return;
      }
      const all = snapshot.val();
      const arr = Object.entries(all).map(([id, r]) => ({
        id,
        // se mantiene 'fecha' para ordenar/filtrar
        fecha: r?.fecha ?? "",
        // nuevos campos visibles en tabla
        mes: r?.mes ?? "",
        fechaPago: r?.fechaPago ?? "",
        // resto
        compania: r?.compania ?? "",
        concepto: r?.concepto ?? "",
        monto: r?.monto ?? "",
        estado: r?.estado ?? "",
      }));
      setData(sortByFechaDesc(arr));
    });
    return unsubscribe;
  }, []);

  // ====== Utils fecha ======
  const parseFecha = (dmy) => {
    if (!/^\d{2}-\d{2}-\d{4}$/.test(dmy)) return null;
    const [dd, mm, yyyy] = dmy.split("-").map((x) => parseInt(x, 10));
    const date = new Date(yyyy, mm - 1, dd);
    if (
      date.getFullYear() !== yyyy ||
      date.getMonth() !== mm - 1 ||
      date.getDate() !== dd
    )
      return null;
    return date;
  };

  const sortByFechaDesc = (arr) =>
    [...arr].sort((a, b) => {
      const A = parseFecha(a.fecha);
      const B = parseFecha(b.fecha);
      if (!A && !B) return 0;
      if (!A) return 1;
      if (!B) return -1;
      return B - A;
    });

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

  // actualizar un campo en Firebase y en estado local ---------
  const handleFieldChange = async (item, field, value) => {
    const safeValue = value ?? "";
    try {
      const itemRef = ref(database, `pagosmensuales/${item.id}`);
      await update(itemRef, { [field]: safeValue });

      setData((prev) =>
        sortByFechaDesc(
          prev.map((it) =>
            it.id === item.id ? { ...it, [field]: safeValue } : it
          )
        )
      );

      setLocalValues((prev) => {
        const k = `${item.id}_${field}`;
        if (prev[k] === undefined) return prev;
        const { [k]: _omit, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      console.error("Error actualizando", field, err);
      alert("No se pudo guardar el cambio.");
    }
  };

  // (Se mantiene por si quieres editar 'fecha' desde otro flujo/UI)
  const handleFechaChange = async (item, nuevaFechaDMY, revert) => {
    const nuevaFecha = (nuevaFechaDMY || "").trim();
    const parsed = parseFecha(nuevaFecha);
    if (!parsed) {
      if (revert) revert();
      alert("Fecha inválida. Usa el formato dd-mm-aaaa.");
      return;
    }
    if (nuevaFecha === item.fecha) return;

    try {
      const itemRef = ref(database, `pagosmensuales/${item.id}`);
      await update(itemRef, { fecha: nuevaFecha });

      setData((prev) =>
        sortByFechaDesc(
          prev.map((it) =>
            it.id === item.id ? { ...it, fecha: nuevaFecha } : it
          )
        )
      );
    } catch (err) {
      console.error(err);
      if (revert) revert();
      alert("No se pudo cambiar la fecha.");
    }
  };

  // Crea un nuevo pago (fecha = hoy para filtros; mes/fechaPago quedan en blanco)
  const addData = async () => {
    const hoy = new Date();
    const dd = String(hoy.getDate()).padStart(2, "0");
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const yyyy = hoy.getFullYear();
    const fecha = `${dd}-${mm}-${yyyy}`;

    const dbRef = ref(database, "pagosmensuales");
    const newRef = push(dbRef);
    await set(newRef, {
      fecha,          // dd-mm-aaaa (para filtros/orden)
      mes: "",        // texto visible en tabla
      fechaPago: "",  // texto visible en tabla
      compania: "",
      concepto: "",
      monto: "",
      estado: "",
    });
  };

  // ====== Opciones para filtros ======
  const companiaOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(new Set(data.map((it) => (it.compania ?? "").trim())))
      .filter((v) => v !== "")
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v })),
  ];

  const conceptoOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(new Set(data.map((it) => (it.concepto ?? "").trim())))
      .filter((v) => v !== "")
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v })),
  ];

  const montoOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(data.map((it) => it.monto).filter((v) => v !== "" && v != null))
    )
      .sort((a, b) => Number(a) - Number(b))
      .map((v) => ({ value: String(v), label: String(v) })),
  ];

  const estadoOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(new Set(data.map((it) => (it.estado ?? "").trim())))
      .filter((v) => v !== "")
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v })),
  ];

  const availableYears = Array.from(
    new Set(
      data
        .map((it) => parseFecha(it.fecha)?.getFullYear())
        .filter((y) => Number.isInteger(y))
    )
  ).sort((a, b) => b - a);

  const monthNames = [
    "",
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  // ====== Filtrado (por 'fecha') ======
  const filteredData = data.filter((item) => {
    const d = parseFecha(item.fecha); // Date | null

    // 1) filtro por rango de fechas
    if (filters.fechaInicio || filters.fechaFin) {
      if (!d) return false;
      if (filters.fechaInicio && d < filters.fechaInicio) return false;
      if (filters.fechaFin && d > filters.fechaFin) return false;
    }

    // 2) filtro por mes (numérico, tomado de 'fecha')
    if (filters.mes != null) {
      if (!d) return false;
      const mesItem = d.getMonth() + 1;
      if (mesItem !== filters.mes) return false;
    }

    // 3) filtro por año (de 'fecha')
    if (filters.año != null) {
      if (!d) return false;
      const añoItem = d.getFullYear();
      if (añoItem !== filters.año) return false;
    }

    // 4) filtros multi-select
    const matchMulti = (filterArr, field) =>
      filterArr.length === 0 ||
      filterArr.some((f) => {
        if (f.value === "__EMPTY__") {
          const fieldValue = item[field];
          return (
            fieldValue === "" || fieldValue === null || fieldValue === undefined
          );
        }
        return (
          String(item[field] ?? "")
            .toLowerCase()
            .trim() === String(f.value).toLowerCase().trim()
        );
      });

    if (!matchMulti(filters.compania, "compania")) return false;
    if (!matchMulti(filters.concepto, "concepto")) return false;
    if (!matchMulti(filters.monto, "monto")) return false;
    if (!matchMulti(filters.estado, "estado")) return false;

    return true;
  });

  // ====== Conteo de compañías duplicadas ======
  const companyCounts = {};
  filteredData.forEach((it) => {
    const c = (it.compania || "").trim();
    if (c) companyCounts[c] = (companyCounts[c] || 0) + 1;
  });

  // ====== Paginación ======
  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredData.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    setCurrentPage(page);
  };
  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const goToPreviousPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  const handleItemsPerPageChange = (newSize) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  // ====== DatePicker (rango) ======
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

  // Eliminar registro
  const handleDelete = (itemId) => {
    Swal.fire({
      title: "¿Eliminar registro?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        set(ref(database, `pagosmensuales/${itemId}`), null)
          .then(() => {
            Swal.fire({
              title: "¡Eliminado!",
              text: "Registro eliminado exitosamente.",
              icon: "success",
              timer: 1800,
              showConfirmButton: false,
            });
          })
          .catch((err) =>
            Swal.fire("Error", "No se pudo eliminar: " + err.message, "error")
          );
      }
    });
  };

  return (
    <div className="homepage-container">
      <Slidebar />
      <div onClick={() => toggleSlidebar(!showSlidebar)}></div>

      {/* FILTROS */}
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

        {/* Fecha (rango) */}
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

        {/* Mes numérico (desde 'fecha') */}
        <label style={{ marginTop: 12 }}>Mes</label>
        <select
          value={filters.mes ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              mes: e.target.value === "" ? null : Number(e.target.value),
            }))
          }
        >
          <option value="">Todos</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {monthNames[m]}
            </option>
          ))}
        </select>

        {/* Año (desde 'fecha') */}
        <label style={{ marginTop: 12 }}>Año</label>
        <select
          value={filters.año ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              año: e.target.value === "" ? null : Number(e.target.value),
            }))
          }
        >
          <option value="">Todos</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {/* Compañía */}
        <label style={{ marginTop: 12 }}>Compañía</label>
        <Select
          isClearable
          isMulti
          options={companiaOptions}
          value={filters.compania}
          onChange={(opts) =>
            setFilters((f) => ({ ...f, compania: opts || [] }))
          }
          placeholder="Selecciona compañía(s)..."
        />

        {/* Concepto */}
        <label style={{ marginTop: 12 }}>Concepto</label>
        <Select
          isClearable
          isMulti
          options={conceptoOptions}
          value={filters.concepto}
          onChange={(opts) =>
            setFilters((f) => ({ ...f, concepto: opts || [] }))
          }
          placeholder="Selecciona concepto(s)..."
        />

        {/* Monto */}
        <label style={{ marginTop: 12 }}>Monto</label>
        <Select
          isClearable
          isMulti
          options={montoOptions}
          value={filters.monto}
          onChange={(opts) => setFilters((f) => ({ ...f, monto: opts || [] }))}
          placeholder="Selecciona monto(s)..."
        />

        {/* Estado */}
        <label style={{ marginTop: 12 }}>Estado</label>
        <Select
          isClearable
          isMulti
          options={estadoOptions}
          value={filters.estado}
          onChange={(opts) => setFilters((f) => ({ ...f, estado: opts || [] }))}
          placeholder="Selecciona estado(s)..."
        />

        <button
          className="discard-filter-button"
          onClick={() =>
            setFilters({
              compania: [],
              concepto: [],
              monto: [],
              estado: [],
              fechaInicio: null,
              fechaFin: null,
              mes: null,
              año: null,
            })
          }
          style={{ marginTop: 12 }}
        >
          Descartar Filtros
        </button>
      </div>

      {/* Título */}
      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Pagos Mensuales</h1>
          <div className="current-date">
            <div>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      {/* Alerta de compañías duplicadas */}
      {showDuplicatesAlert &&
        Object.keys(companyCounts).filter((c) => companyCounts[c] > 1).length >
          0 && (
          <div
            style={{
              background: "#fff3cd",
              color: "#856404",
              border: "1px solid #ffeeba",
              borderRadius: "6px",
              padding: "10px 16px",
              marginBottom: "12px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "15px",
              position: "relative",
            }}
          >
            <span style={{ fontSize: "1.3em" }}>⚠️</span>
            <span style={{ flex: 1 }}>
              <b>¡Atención!</b> Hay compañías duplicadas en los registros
              filtrados:
              <ul
                style={{
                  margin: "6px 0 0 18px",
                  fontWeight: "normal",
                  fontSize: "14px",
                }}
              >
                {Object.entries(companyCounts)
                  .filter(([_, count]) => count > 1)
                  .map(([c, count]) => (
                    <li key={c}>
                      <b>{c}</b> ({count} veces)
                    </li>
                  ))}
              </ul>
            </span>
            <button
              onClick={() => setShowDuplicatesAlert(false)}
              style={{
                background: "#ffeeba",
                color: "#856404",
                border: "1px solid #ffeeba",
                borderRadius: "4px",
                padding: "2px 10px",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "13px",
                position: "absolute",
                top: "8px",
                right: "8px",
              }}
            >
              Ocultar
            </button>
          </div>
        )}

      {/* Tabla */}
      <div className="homepage-card">
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Fecha de pago</th>
                <th>Compañía</th>
                <th>Concepto</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.length > 0 ? (
                currentPageData.map((item) => {
                  const kMes = `${item.id}_mes`;
                  const kFechaPago = `${item.id}_fechaPago`;
                  const kCompania = `${item.id}_compania`;
                  const kConcepto = `${item.id}_concepto`;
                  const kMonto = `${item.id}_monto`;
                  const kEstado = `${item.id}_estado`;

                  return (
                    <tr key={item.id}>
                      {/* MES */}
                      <td>
                        <input
                          type="text"
                          value={
                            localValues[kMes] !== undefined
                              ? localValues[kMes]
                              : item.mes ?? ""
                          }
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kMes]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const v = e.target.value ?? "";
                            if (v !== (item.mes ?? "")) {
                              handleFieldChange(item, "mes", v);
                            }
                          }}
                          style={{ width: "16ch", textAlign: "center" }}
                        />
                      </td>

                      {/* FECHA DE PAGO */}
                      <td>
                        <input
                          type="text"
                          value={
                            localValues[kFechaPago] !== undefined
                              ? localValues[kFechaPago]
                              : item.fechaPago ?? ""
                          }
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kFechaPago]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const v = e.target.value ?? "";
                            if (v !== (item.fechaPago ?? "")) {
                              handleFieldChange(item, "fechaPago", v);
                            }
                          }}
                          style={{ width: "16ch", textAlign: "center" }}
                        />
                      </td>

                      {/* COMPAÑÍA */}
                      <td>
                        <input
                          type="text"
                          value={
                            localValues[kCompania] !== undefined
                              ? localValues[kCompania]
                              : item.compania ?? ""
                          }
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kCompania]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const v = e.target.value ?? "";
                            if (v !== (item.compania ?? "")) {
                              handleFieldChange(item, "compania", v);
                            }
                          }}
                          style={{ width: "22ch" }}
                        />
                      </td>

                      {/* CONCEPTO */}
                      <td>
                        <input
                          type="text"
                          value={
                            localValues[kConcepto] !== undefined
                              ? localValues[kConcepto]
                              : item.concepto ?? ""
                          }
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kConcepto]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const v = e.target.value ?? "";
                            if (v !== (item.concepto ?? "")) {
                              handleFieldChange(item, "concepto", v);
                            }
                          }}
                          style={{ width: "28ch" }}
                        />
                      </td>

                      {/* MONTO */}
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <input
                            type="text"
                            value={
                              localValues[kMonto] !== undefined
                                ? localValues[kMonto]
                                : item.monto ?? ""
                            }
                            onChange={(e) =>
                              setLocalValues((p) => ({
                                ...p,
                                [kMonto]: e.target.value,
                              }))
                            }
                            onBlur={(e) => {
                              const v = e.target.value ?? "";
                              if (v !== (item.monto ?? "")) {
                                handleFieldChange(item, "monto", v);
                              }
                            }}
                            style={{ width: "10ch", textAlign: "center" }}
                          />
                          <span style={{ marginLeft: "5px" }}>AWG</span>
                        </div>
                      </td>

                      {/* ESTADO */}
                      <td>
                        <input
                          type="text"
                          list={`estado-options-${item.id}`}
                          value={
                            localValues[kEstado] !== undefined
                              ? localValues[kEstado]
                              : item.estado ?? ""
                          }
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kEstado]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const v = (e.target.value ?? "").trim();
                            if (v !== (item.estado ?? "")) {
                              handleFieldChange(item, "estado", v);
                            }
                          }}
                          style={{ width: "14ch" }}
                        />
                        <datalist id={`estado-options-${item.id}`}>
                          <option value="Pago" />
                        </datalist>
                      </td>

                      {/* ACCIÓN */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="delete-button"
                          style={{ marginLeft: "10px", marginRight: "6px" }}
                          onClick={() => handleDelete(item.id)}
                          title="Eliminar registro"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7">No hay registros disponibles</td>
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

      {/* Crear nuevo (fecha por defecto = hoy) */}
      <button className="create-table-button" onClick={addData}>
        +
      </button>
    </div>
  );
};

export default React.memo(Pagosmensuales);
