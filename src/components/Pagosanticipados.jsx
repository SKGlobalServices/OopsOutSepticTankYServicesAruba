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

const Pagosanticipados = () => {
  // LOADER
  // const [loading, setLoading] = useState(true);
  // const [loadedData, setLoadedData] = useState(false);
  
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const filterSlidebarRef = useRef(null);

  // arriba junto a otros estados
  const [deletingId, setDeletingId] = useState(null);
  const [data, setData] = useState([]);
  const [localValues, setLocalValues] = useState({});
  const [showDuplicatesAlert, setShowDuplicatesAlert] = useState(true);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Mostrar/ocultar datepicker
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Filtros (alineados a los th)
  const [filters, setFilters] = useState({
    compania: [], // multi
    monto: [], // multi (num)
    servicios: [], // multi (num)
    fechaInicio: null,
    fechaFin: null,
    mes: null,
    anio: null,
  });

  // ====== Carga de datos (pagosanticipados) ======
  useEffect(() => {
    const dbRef = ref(database, "pagosanticipados");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (!snapshot.exists()) {
        setData([]);
        return;
      }
      const all = snapshot.val();
      const arr = Object.entries(all).map(([id, r]) => ({
        id,
        fecha: r?.fecha ?? "",
        compania: r?.compania ?? "",
        monto: r?.monto ?? "", // número o ""
        servicios: r?.servicios ?? "", // número o ""
        montoafavor: r?.montoafavor ?? "", // número o "" (nuevo)
      }));
      setData(sortByFechaDesc(arr));
      // setLoadedData(true);
    });
    return unsubscribe;
  }, []);

  // Cuando los datos estén cargados, oculta el loader
  // useEffect(() => {
  //   if (loadedData) {
  //     setLoading(false);
  //   }
  // }, [loadedData]);

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

  const inputToDmy = (ymd) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
    const [yyyy, mm, dd] = ymd.split("-");
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (
      d.getFullYear() !== Number(yyyy) ||
      d.getMonth() !== Number(mm) - 1 ||
      d.getDate() !== Number(dd)
    )
      return "";
    return `${dd}-${mm}-${yyyy}`;
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

  // ====== helpers numéricos ======
  const isNum = (v) =>
    v !== "" && v !== null && v !== undefined && !Number.isNaN(Number(v));

  // calcula valor para GUARDAR en DB:
  // si ambos vacíos => "", si no => (monto||0) - (servicios||0)
  const calcMontoAFavorForStorage = (monto, servicios) => {
    if (!isNum(monto) && !isNum(servicios)) return "";
    const m = isNum(monto) ? Number(monto) : 0;
    const s = isNum(servicios) ? Number(servicios) : 0;
    return m - s;
  };

  // calcula para mostrar (fallback si no existe en DB)
  const calcMontoAFavorDisplay = (montoafavor, monto, servicios) => {
    if (isNum(montoafavor)) return Number(montoafavor);
    return calcMontoAFavorForStorage(monto, servicios) || "";
  };

  // actualizar un campo en Firebase y en estado local ---------
  const handleFieldChange = async (item, field, value) => {
    const numericFields = ["monto", "servicios"];
    const safeValue = numericFields.includes(field)
      ? value === "" || value === null || value === undefined
        ? ""
        : Number(value)
      : value ?? "";

    try {
      const itemRef = ref(database, `pagosanticipados/${item.id}`);

      // si cambia monto o servicios, recalcular y guardar también montoafavor
      if (field === "monto" || field === "servicios") {
        const next = {
          ...item,
          [field]: safeValue,
        };
        const nuevoMontoAFavor = calcMontoAFavorForStorage(
          next.monto,
          next.servicios
        );

        await update(itemRef, {
          [field]: safeValue,
          montoafavor: nuevoMontoAFavor,
        });

        setData((prev) =>
          sortByFechaDesc(
            prev.map((it) =>
              it.id === item.id
                ? { ...it, [field]: safeValue, montoafavor: nuevoMontoAFavor }
                : it
            )
          )
        );
      } else {
        await update(itemRef, { [field]: safeValue });

        setData((prev) =>
          sortByFechaDesc(
            prev.map((it) =>
              it.id === item.id ? { ...it, [field]: safeValue } : it
            )
          )
        );
      }

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
      const itemRef = ref(database, `pagosanticipados/${item.id}`);
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

  // Crea un nuevo pago (alineado a los th)
  const addData = async () => {
    const hoy = new Date();
    const dd = String(hoy.getDate()).padStart(2, "0");
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const yyyy = hoy.getFullYear();
    const fecha = `${dd}-${mm}-${yyyy}`;

    const dbRef = ref(database, "pagosanticipados");
    const newRef = push(dbRef);
    await set(newRef, {
      fecha, // dd-mm-aaaa
      compania: "",
      monto: "", // num o ""
      servicios: "", // num o ""
      montoafavor: "", // se recalculará al ingresar valores
    });
  };

  // ====== Opciones para filtros (react-select & selects) ======
  const companiaOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(new Set(data.map((it) => (it.compania ?? "").trim())))
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

  const serviciosOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(
        data.map((it) => it.servicios).filter((v) => v !== "" && v != null)
      )
    )
      .sort((a, b) => Number(a) - Number(b))
      .map((v) => ({ value: String(v), label: String(v) })),
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

  // ====== Filtrado ======
  const filteredData = data.filter((item) => {
    const d = parseFecha(item.fecha); // Date | null

    // 1) rango de fechas
    if (filters.fechaInicio || filters.fechaFin) {
      if (!d) return false;
      if (filters.fechaInicio && d < filters.fechaInicio) return false;
      if (filters.fechaFin && d > filters.fechaFin) return false;
    }

    // 2) mes
    if (filters.mes != null) {
      if (!d) return false;
      const mesItem = d.getMonth() + 1;
      if (mesItem !== filters.mes) return false;
    }

    // 3) año
    if (filters.anio != null) {
      if (!d) return false;
      const anioItem = d.getFullYear();
      if (anioItem !== filters.anio) return false;
    }

    // 4) multi-selects (compañía, monto, servicios)
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
    if (!matchMulti(filters.monto, "monto")) return false;
    if (!matchMulti(filters.servicios, "servicios")) return false;

    return true;
  });

  // ====== Conteo de compañías duplicadas (para alerta/⚠️) ======
  const companyCounts = {};
  filteredData.forEach((it) => {
    const c = (it.compania || "").trim();
    if (c) companyCounts[c] = (companyCounts[c] || 0) + 1;
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

  // FUNCIÓN PARA ELIMINAR REGISTRO
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
    });

    if (!result.isConfirmed) return;

    try {
      setDeletingId(itemId);
      await set(ref(database, `pagosanticipados/${itemId}`), null);

      // quita del estado sin esperar a que onValue vuelva a disparar
      setData((prev) => prev.filter((r) => r.id !== itemId));

      await Swal.fire({
        title: "¡Eliminado!",
        text: "Registro eliminado exitosamente.",
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

  // // Loading
  // if (loading) {
  //   return (
  //     <div className="loader-container">
  //       <div className="loader" />
  //     </div>
  //   );
  // }

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

        {/* Mes */}
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

        {/* Año */}
        <label style={{ marginTop: 12 }}>Año</label>
        <select
          value={filters.anio ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              anio: e.target.value === "" ? null : Number(e.target.value),
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

        {/* Servicios */}
        <label style={{ marginTop: 12 }}>Servicios</label>
        <Select
          isClearable
          isMulti
          options={serviciosOptions}
          value={filters.servicios}
          onChange={(opts) =>
            setFilters((f) => ({ ...f, servicios: opts || [] }))
          }
          placeholder="Selecciona servicios..."
        />

        <button
          className="discard-filter-button"
          onClick={() =>
            setFilters({
              compania: [],
              monto: [],
              servicios: [],
              fechaInicio: null,
              fechaFin: null,
              mes: null,
              anio: null,
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
          <h1 className="title-page">Pagos Anticipados</h1>
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
                <th>Fecha</th>
                <th>Compañia</th>
                <th>Monto</th>
                <th>Servicios</th>
                <th>Monto A Favor</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.length > 0 ? (
                currentPageData.map((item) => {
                  const kFecha = `${item.id}_fecha_${item.fecha}`;
                  const kCompania = `${item.id}_compania`;
                  const kMonto = `${item.id}_monto`;
                  const kServicios = `${item.id}_servicios`;

                  const prevFechaDMY = item.fecha;
                  const currentInputValue =
                    localValues[kFecha] !== undefined
                      ? localValues[kFecha]
                      : dmyToInput(item.fecha);

                  const montoAFavorToShow = calcMontoAFavorDisplay(
                    item.montoafavor,
                    item.monto,
                    item.servicios
                  );

                  return (
                    <tr key={item.id}>
                      {/* FECHA */}
                      <td>
                        <input
                          type="date"
                          value={currentInputValue}
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kFecha]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const oldDmy = prevFechaDMY;
                            const newYmd = e.target.value;
                            const newDmy = inputToDmy(newYmd);

                            if (!newDmy) {
                              setLocalValues((p) => ({
                                ...p,
                                [kFecha]: dmyToInput(oldDmy),
                              }));
                              alert("Fecha inválida.");
                              return;
                            }
                            if (newDmy === oldDmy) return;

                            const revert = () =>
                              setLocalValues((p) => ({
                                ...p,
                                [kFecha]: dmyToInput(oldDmy),
                              }));

                            handleFechaChange(item, newDmy, revert);
                          }}
                          style={{ width: "14ch", textAlign: "center" }}
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

                      {/* MONTO */}
                      <td>
                        <input
                          type="number"
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
                            const raw = e.target.value;
                            const val = raw === "" ? "" : Number(raw);
                            if (val !== (item.monto ?? "")) {
                              handleFieldChange(item, "monto", val);
                            }
                          }}
                          style={{
                            width: "12ch",
                            textAlign: "center",
                            paddingLeft: "10px",
                          }}
                        />
                      </td>

                      {/* SERVICIOS */}
                      <td>
                        <input
                          type="number"
                          value={
                            localValues[kServicios] !== undefined
                              ? localValues[kServicios]
                              : item.servicios ?? ""
                          }
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kServicios]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const raw = e.target.value;
                            const val = raw === "" ? "" : Number(raw);
                            if (val !== (item.servicios ?? "")) {
                              handleFieldChange(item, "servicios", val);
                            }
                          }}
                          style={{
                            width: "12ch",
                            textAlign: "center",
                            paddingLeft: "10px",
                          }}
                        />
                      </td>

                      {/* MONTO A FAVOR (almacenado/calculado) */}
                      <td
                        style={{
                          textAlign: "center",
                          paddingLeft: "5px",
                          fontWeight: "bold",
                        }}
                      >
                        {montoAFavorToShow} AWG
                      </td>
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
                  <td colSpan="6">No hay registros disponibles</td>{" "}
                  {/* ← Actualiza el colspan */}
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

      {/* Crear nuevo (alineado a th; fecha por defecto = hoy) */}
      <button className="create-table-button" onClick={addData}>
        +
      </button>
    </div>
  );
};

export default React.memo(Pagosanticipados);
