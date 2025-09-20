import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, set, push, onValue, update } from "firebase/database";
import Select from "react-select";
import Slidebar from "./Slidebar";
import filtericon from "../assets/img/filters_icon.jpg";
import Clock from "./Clock";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Swal from "sweetalert2";

const Ciclodefacturacion = () => {
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const filterSlidebarRef = useRef(null);
  const [deletingId, setDeletingId] = useState(null);
  const [data, setData] = useState([]);
  const [clients, setClients] = useState([]);
  const [loadedClients, setLoadedClients] = useState(false);
  const [localValues, setLocalValues] = useState({});
  const [showDuplicatesAlert, setShowDuplicatesAlert] = useState(true);
  const MIN_H = 35;
  const MAX_H = 200;
  const MIN_H_VAL = 35;
  const MAX_H_VAL = 200;

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Mostrar/ocultar datepicker
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Filtros
  const [filters, setFilters] = useState({
    cliente: [],
    direccion: [],
    valor: [],
    notas: [],
    fechaInicio: null,
    fechaFin: null,
    año: new Date().getFullYear(),
  });

  // ====== Carga de datos (ciclodefacturacion) ======
  useEffect(() => {
    const dbRef = ref(database, "ciclodefacturacion");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (!snapshot.exists()) {
        setData([]);
        return;
      }
      const all = snapshot.val();
      const arr = Object.entries(all).map(([id, r]) => ({
        id,
        // Campos según TH
        fecha: r?.fecha ?? "",
        cliente: r?.cliente ?? "",
        direccion: r?.direccion ?? "",
        valor: r?.valor ?? "",
        notas: r?.notas ?? "",
        enero: !!r?.enero,
        febrero: !!r?.febrero,
        marzo: !!r?.marzo,
        abril: !!r?.abril,
        mayo: !!r?.mayo,
        junio: !!r?.junio,
        julio: !!r?.julio,
        agosto: !!r?.agosto,
        septiembre: !!r?.septiembre,
        octubre: !!r?.octubre,
        noviembre: !!r?.noviembre,
        diciembre: !!r?.diciembre,
      }));
      setData(sortByFechaDesc(arr));
    });
    return unsubscribe;
  }, []);

  // Cargar "clientes" para datalist de Cliente y Dirección
  useEffect(() => {
    const dbRef = ref(database, "clientes");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedClients = Object.entries(snapshot.val()).map(
          ([id, client]) => ({
            id,
            anombrede: client?.anombrede ?? "",
            direccion: client?.direccion ?? "",
            cubicos: client?.cubicos, // si lo necesitas luego
          })
        );
        setClients(fetchedClients);
      } else {
        setClients([]);
      }
      setLoadedClients(true);
    });
    return () => unsubscribe();
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

  const dmyToInput = (dmy) => {
    const d = parseFecha(dmy);
    if (!d) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

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
    const safeValue = value ?? (typeof value === "boolean" ? false : "");
    try {
      const itemRef = ref(database, `ciclodefacturacion/${item.id}`);
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
      const itemRef = ref(database, `ciclodefacturacion/${item.id}`);
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

  // Crea un nuevo registro con todos los campos del TH
  const addData = async () => {
    const hoy = new Date();
    const dd = String(hoy.getDate()).padStart(2, "0");
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const yyyy = hoy.getFullYear();
    const fecha = `${dd}-${mm}-${yyyy}`;

    const dbRef = ref(database, "ciclodefacturacion");
    const newRef = push(dbRef);
    await set(newRef, {
      fecha,
      cliente: "",
      direccion: "",
      valor: "",
      notas: "",
      enero: false,
      febrero: false,
      marzo: false,
      abril: false,
      mayo: false,
      junio: false,
      julio: false,
      agosto: false,
      septiembre: false,
      octubre: false,
      noviembre: false,
      diciembre: false,
    });
  };

  // ====== Opciones para filtros (react-select & selects) ======
  const uniqueSorted = (arr) =>
    Array.from(new Set(arr.filter((v) => v != null))).map((v) =>
      typeof v === "string" ? v.trim() : v
    );

  const clienteOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...uniqueSorted(data.map((it) => (it.cliente ?? "").trim()))
      .filter((v) => v !== "")
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v })),
  ];

  const direccionOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...uniqueSorted(data.map((it) => (it.direccion ?? "").trim()))
      .filter((v) => v !== "")
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v })),
  ];

  const valorOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(data.map((it) => it.valor).filter((v) => v !== "" && v != null))
    )
      .sort((a, b) => Number(a) - Number(b))
      .map((v) => ({ value: String(v), label: String(v) })),
  ];

  const notasOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...uniqueSorted(data.map((it) => (it.notas ?? "").trim()))
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

  // ====== Filtrado ======
  const filteredData = data.filter((item) => {
    const d = parseFecha(item.fecha); // Date | null

    // 1) filtro por rango de fechas
    if (filters.fechaInicio || filters.fechaFin) {
      if (!d) return false; // si no hay fecha válida, excluye
      if (filters.fechaInicio && d < filters.fechaInicio) return false;
      if (filters.fechaFin && d > filters.fechaFin) return false;
    }

    // 2) filtro por año
    if (filters.año != null) {
      if (!d) return false;
      const añoItem = d.getFullYear();
      if (añoItem !== filters.año) return false;
    }

    // 3) filtros multi-select exactos (incluye opción "__EMPTY__")
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

    if (!matchMulti(filters.cliente, "cliente")) return false;
    if (!matchMulti(filters.direccion, "direccion")) return false;
    if (!matchMulti(filters.valor, "valor")) return false;
    if (!matchMulti(filters.notas, "notas")) return false;

    return true;
  });

  // ====== Conteo de clientes duplicados (para alerta/⚠️) ======
  const clientCounts = {};
  filteredData.forEach((it) => {
    const c = (it.cliente || "").trim();
    if (c) clientCounts[c] = (clientCounts[c] || 0) + 1;
  });

  // ====== Paginación sobre datos filtrados ======
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

  // Confirmar y eliminar un registro del ciclo de facturación
  const handleDelete = async (itemId) => {
    const result = await Swal.fire({
      title: "¿Eliminar registro?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
      allowOutsideClick: false,
      heightAuto: false,
      backdrop: "rgba(0,0,0,0.4)",
    });

    if (!result.isConfirmed) return;

    try {
      setDeletingId(itemId);
      await set(ref(database, `ciclodefacturacion/${itemId}`), null);

      // Eliminación optimista en estado (por si el onValue tarda)
      setData((prev) => prev.filter((r) => r.id !== itemId));

      await Swal.fire({
        title: "¡Registro eliminado!",
        text: "El registro ha sido eliminado exitosamente.",
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
        heightAuto: false,
        position: "center",
        backdrop: "rgba(0,0,0,0.4)",
        didOpen: () => {
          document.body.style.overflow = "auto";
        },
        willClose: () => {
          document.body.style.overflow = "";
        },
      });
    } catch (err) {
      await Swal.fire("Error", "No se pudo eliminar: " + err.message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  // ====== Datalists de Cliente y Dirección ======
  const clienteNombres = Array.from(
    new Set(
      clients
        .map((c) => (c.anombrede || "").trim())
        .filter((v) => v && v.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  const direcciones = Array.from(
    new Set(
      clients
        .map((c) => (c.direccion || "").trim())
        .filter((v) => v && v.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  function autoResize(el) {
    if (!el) return;
    el.style.height = "auto"; // reset para medir
    const next = Math.max(MIN_H, Math.min(el.scrollHeight, MAX_H));
    el.style.height = next + "px";
  }

  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      document
        .querySelectorAll(
          "textarea.ta-direccion, textarea.ta-notas, textarea.ta-valor"
        )
        .forEach((el) => autoResize(el));
    });
  }, [currentPageData, localValues]);

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

        {/* Año */}
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

        {/* Cliente */}
        <label style={{ marginTop: 12 }}>Cliente</label>
        <Select
          isClearable
          isMulti
          options={clienteOptions}
          value={filters.cliente}
          onChange={(opts) =>
            setFilters((f) => ({ ...f, cliente: opts || [] }))
          }
          placeholder="Selecciona cliente(s)..."
        />

        {/* Dirección */}
        <label style={{ marginTop: 12 }}>Dirección</label>
        <Select
          isClearable
          isMulti
          options={direccionOptions}
          value={filters.direccion}
          onChange={(opts) =>
            setFilters((f) => ({ ...f, direccion: opts || [] }))
          }
          placeholder="Selecciona dirección(es)..."
        />

        {/* Valor */}
        <label style={{ marginTop: 12 }}>Valor</label>
        <Select
          isClearable
          isMulti
          options={valorOptions}
          value={filters.valor}
          onChange={(opts) => setFilters((f) => ({ ...f, valor: opts || [] }))}
          placeholder="Selecciona valor(es)..."
        />

        {/* Notas */}
        <label style={{ marginTop: 12 }}>Notas</label>
        <Select
          isClearable
          isMulti
          options={notasOptions}
          value={filters.notas}
          onChange={(opts) => setFilters((f) => ({ ...f, notas: opts || [] }))}
          placeholder="Selecciona nota(s)..."
        />

        <button
          className="discard-filter-button"
          onClick={() =>
            setFilters({
              cliente: [],
              direccion: [],
              valor: [],
              notas: [],
              fechaInicio: null,
              fechaFin: null,
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
          <h1 className="title-page">Ciclo De Facturación Mensual</h1>
          <div className="current-date">
            <div style={{cursor:"default"}}>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      {/* Alerta de clientes duplicados */}
      {showDuplicatesAlert &&
        Object.keys(clientCounts).filter((c) => clientCounts[c] > 1).length >
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
              <b>¡Atención!</b> Hay clientes duplicados en los registros
              filtrados:
              <ul
                style={{
                  margin: "6px 0 0 18px",
                  fontWeight: "normal",
                  fontSize: "14px",
                }}
              >
                {Object.entries(clientCounts)
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

      {/* DATALISTS GLOBALES para inputs en tabla */}
      <datalist id="clientes-datalist">
        {clienteNombres.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="direcciones-datalist">
        {direcciones.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>

      {/* Tabla */}
      <div className="homepage-card">
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Dirección</th>
                <th>Valor</th>
                <th>Notas</th>
                <th>Enero</th>
                <th>Febrero</th>
                <th>Marzo</th>
                <th>Abril</th>
                <th>Mayo</th>
                <th>Junio</th>
                <th>Julio</th>
                <th>Agosto</th>
                <th>Septiembre</th>
                <th>Octubre</th>
                <th>Noviembre</th>
                <th>Diciembre</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.length > 0 ? (
                currentPageData.map((item) => {
                  const kFecha = `${item.id}_fecha_${item.fecha}`;
                  const prevFechaDMY = item.fecha;
                  const currentInputValue =
                    localValues[kFecha] !== undefined
                      ? localValues[kFecha]
                      : dmyToInput(item.fecha);

                  const kCliente = `${item.id}_cliente`;
                  const kDireccion = `${item.id}_direccion`;
                  const kValor = `${item.id}_valor`;
                  const kNotas = `${item.id}_notas`;

                  const monthFields = [
                    "enero",
                    "febrero",
                    "marzo",
                    "abril",
                    "mayo",
                    "junio",
                    "julio",
                    "agosto",
                    "septiembre",
                    "octubre",
                    "noviembre",
                    "diciembre",
                  ];

                  return (
                    <tr key={item.id}>
                      {/* CLIENTE */}
                      <td>
                        <input
                          type="text"
                          list="clientes-datalist"
                          value={
                            localValues[kCliente] !== undefined
                              ? localValues[kCliente]
                              : item.cliente ?? ""
                          }
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kCliente]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const v = (e.target.value ?? "").trim();
                            if (v !== (item.cliente ?? "")) {
                              handleFieldChange(item, "cliente", v);
                            }
                          }}
                          style={{ width: "22ch" }}
                        />
                      </td>

                      {/* DIRECCIÓN */}
                      <td>
                        <textarea
                          className="ta-direccion"
                          value={
                            localValues[kDireccion] !== undefined
                              ? localValues[kDireccion]
                              : item.direccion ?? ""
                          }
                          onInput={(e) => autoResize(e.currentTarget)}
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kDireccion]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const v = (e.target.value ?? "").trim();
                            if (v !== (item.direccion ?? "")) {
                              handleFieldChange(item, "direccion", v);
                            }
                          }}
                          style={{
                            display: "block",
                            minWidth: "120px",
                            maxWidth: "250px",
                            width: "200px",
                            height: MIN_H,
                            minHeight: MIN_H,
                            maxHeight: MAX_H,
                            overflow: "hidden",
                            resize: "none",
                            marginBottom: "10px",
                            boxSizing: "border-box",
                            marginBottom:"0em",
                            border:"none"
                          }}
                        />
                      </td>

                      {/* VALOR */}
                      <td>
                        <textarea
                          className="ta-valor"
                          value={
                            localValues[kValor] !== undefined
                              ? localValues[kValor]
                              : item.valor ?? ""
                          }
                          onInput={(e) => autoResize(e.currentTarget)} // igual que dirección/notas
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kValor]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const v = (e.target.value ?? "").trim(); // guarda crudo, sin formato
                            if (v !== (item.valor ?? "")) {
                              handleFieldChange(item, "valor", v);
                            }
                          }}
                          style={{
                            display: "block",
                            minWidth: "80px", // más pequeño
                            maxWidth: "140px", // más pequeño
                            width: "110px", // más pequeño
                            height: MIN_H_VAL,
                            minHeight: MIN_H_VAL,
                            maxHeight: MAX_H_VAL,
                            overflow: "hidden",
                            resize: "none",
                            marginBottom: "10px",
                            boxSizing: "border-box",
                            textAlign: "center",
                            marginBottom:"0em",
                            border:"none"
                          }}
                        />
                      </td>

                      {/* NOTAS */}
                      <td>
                        <textarea
                          className="ta-notas"
                          value={
                            localValues[kNotas] !== undefined
                              ? localValues[kNotas]
                              : item.notas ?? ""
                          }
                          onInput={(e) => autoResize(e.currentTarget)}
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kNotas]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const v = (e.target.value ?? "").trim();
                            if (v !== (item.notas ?? "")) {
                              handleFieldChange(item, "notas", v);
                            }
                          }}
                          style={{
                            display: "block",
                            minWidth: "120px",
                            maxWidth: "250px",
                            width: "200px",
                            height: MIN_H,
                            minHeight: MIN_H,
                            maxHeight: MAX_H,
                            overflow: "hidden",
                            resize: "none",
                            marginBottom: "10px",
                            boxSizing: "border-box",
                            marginBottom:"0em",
                            border:"none"
                          }}
                        />
                      </td>

                      {/* MESES */}
                      {monthFields.map((mf) => (
                        <td
                          key={`${item.id}_${mf}`}
                          style={{ textAlign: "center" }}
                        >
                          <input
                            type="checkbox"
                            style={{
                              width: "3ch",
                              height: "3ch",
                            }}
                            checked={!!item[mf]}
                            onChange={(e) =>
                              handleFieldChange(item, mf, e.target.checked)
                            }
                          />
                        </td>
                      ))}
                      {/* ACCIÓN: BOTÓN ELIMINAR */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="delete-button"
                          style={{
                            marginLeft: "8px",
                            marginRight: "6px",
                            minWidth: 92,
                          }}
                          onClick={() => handleDelete(item.id)}
                          title="Eliminar registro"
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id
                            ? "Eliminando..."
                            : "Eliminar"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="17">No hay registros disponibles</td>
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

export default React.memo(Ciclodefacturacion);
