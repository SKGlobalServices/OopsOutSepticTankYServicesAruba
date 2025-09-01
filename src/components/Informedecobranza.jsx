import React, { useState, useEffect, useRef, useMemo } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, set, push, onValue, update } from "firebase/database";
import Slidebar from "./Slidebar";
import filtericon from "../assets/img/filters_icon.jpg";
import Clock from "./Clock";
import Swal from "sweetalert2";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// ======================
// Helpers de fecha (dd-mm-yyyy) ⇆ input[type="date"] (yyyy-mm-dd)
// ======================
const fmtHoy = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const parseDMY = (dmy) => {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(dmy || "")) return null;
  const [dd, mm, yyyy] = dmy.split("-").map((x) => parseInt(x, 10));
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd)
    return null;
  return d;
};

const dmyToInput = (dmy) => {
  const d = parseDMY(dmy);
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const inputToDmy = (ymd) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || "")) return "";
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

// normaliza un Date a 00:00
const startOfDay = (d) =>
  d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0) : null;
// normaliza un Date a fin de día
const endOfDay = (d) =>
  d
    ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
    : null;

// ======================
// Helpers de dinero (mismo patrón Fastmark)
// ======================
const formatMoney = (val) => {
  const n = Number(val);
  if (Number.isNaN(n)) return "";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Permite "1.000,5", "1,000.5", etc. y devuelve número o "".
const parseMoney = (str) => {
  if (str === "" || str == null) return "";
  const s = String(str).trim().replace(/\s+/g, "");
  const normalized = s
    .replace(/\.(?=.*\.)/g, "") // quita puntos intermedios/miles extra
    .replace(/,(?=.*[,])/g, "") // quita comas intermedias/miles extra
    .replace(/,/, "."); // coma decimal final -> punto
  const n = Number(normalized);
  return Number.isFinite(n) ? n : "";
};

const Informedecobranza = () => {
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const filterSlidebarRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]); // para datalist de dirección
  const [localValues, setLocalValues] = useState({}); // valores temporales de inputs

  // === FILTROS ===
  const [dir3Filter, setDir3Filter] = useState(""); // Dirección3
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDateRangeChange = (dates) => {
    const [start, end] = dates;
    setDateFrom(
      start
        ? new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
            0,
            0,
            0
          )
        : null
    );
    setDateTo(
      end
        ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59)
        : null
    );
  };

  const toggleSlidebar = () => setShowSlidebar(!showSlidebar);
  const toggleFilterSlidebar = () => setShowFilterSlidebar(!showFilterSlidebar);

  // ===== Cargar registros de informedecobranza
  useEffect(() => {
    const dbRef = ref(database, "informedecobranza");
    return onValue(dbRef, (snap) => {
      if (!snap.exists()) {
        setRows([]);
        return;
      }
      const val = snap.val();
      const list = Object.entries(val).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => {
        const pa = (a.fecha || "").split("-").reverse().join("-");
        const pb = (b.fecha || "").split("-").reverse().join("-");
        return pb.localeCompare(pa);
      });
      setRows(list);
    });
  }, []);

  // ===== Cargar clientes (para datalist de direcciones)
  useEffect(() => {
    const dbRef = ref(database, "clientes");
    const unsub = onValue(dbRef, (snap) => {
      if (!snap.exists()) {
        setClients([]);
        return;
      }
      const arr = Object.entries(snap.val()).map(([id, c]) => ({
        id,
        direccion: c?.direccion ?? "",
      }));
      setClients(arr);
    });
    return unsub;
  }, []);

  // Cerrar slidebars al clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        slidebarRef.current &&
        !slidebarRef.current.contains(e.target) &&
        !e.target.closest(".show-slidebar-button")
      ) {
        setShowSlidebar(false);
      }
      if (
        filterSlidebarRef.current &&
        !filterSlidebarRef.current.contains(e.target) &&
        !e.target.closest(".show-filter-slidebar-button")
      ) {
        setShowFilterSlidebar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ======================
  // MOVERS (se mantienen)
  // ======================
  const moveFields = async (
    rowId,
    fromSuffix, // "", "2", "3"
    toSuffix, // "", "2", "3"
    { setDateWhenTo3 = false, clearOrigin = false } = {}
  ) => {
    const row = rows.find((r) => r.id === rowId) || {};
    const field = (base, suf) => (suf ? `${base}${suf}` : base);
    const get = (k) => row[k] ?? "";

    const srcDireccion = (get(field("direccion", fromSuffix)) || "").trim();
    const srcValor = (get(field("valor", fromSuffix)) || "").toString().trim();
    const srcNotas = (get(field("notas", fromSuffix)) || "").trim();

    const sourceIsEmpty = !srcDireccion && !srcValor && !srcNotas;
    if (sourceIsEmpty) return;

    const payload = {
      [field("direccion", toSuffix)]: srcDireccion,
      [field("valor", toSuffix)]: srcValor,
      [field("notas", toSuffix)]: srcNotas,
    };

    if (clearOrigin) {
      payload[field("direccion", fromSuffix)] = "";
      payload[field("valor", fromSuffix)] = "";
      payload[field("notas", fromSuffix)] = "";
    }

    if (setDateWhenTo3) {
      payload["fecha"] = fmtHoy();
    }

    if (clearOrigin && fromSuffix === "3" && toSuffix === "2") {
      payload["fecha"] = "";
    }

    await update(ref(database, `informedecobranza/${rowId}`), payload);
  };

  const move1to2 = (rowId) =>
    moveFields(rowId, "", "2", { clearOrigin: false });
  const move2to1 = (rowId) => moveFields(rowId, "2", "", { clearOrigin: true });
  const move2to3 = (rowId) =>
    moveFields(rowId, "2", "3", { setDateWhenTo3: true, clearOrigin: false });
  const move3to2 = (rowId) =>
    moveFields(rowId, "3", "2", { clearOrigin: true });

  // ======================
  // CRUD / Guardado puntual por campo
  // ======================
  const saveField = async (rowId, field, value) => {
    const itemRef = ref(database, `informedecobranza/${rowId}`);
    await update(itemRef, { [field]: value ?? "" }).catch(console.error);
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: value ?? "" } : r))
    );
  };

  // Handlers estandarizados (texto)
  const handleTextBlur = (rowId, field, keyInLocal) => (e) => {
    const v = (e.target.value || "").trim();
    if (keyInLocal) {
      setLocalValues((p) => ({ ...p, [keyInLocal]: v }));
    }
    saveField(rowId, field, v);
  };

  // Handlers de monto (formateo al perder foco, crudo al enfocar)
  const handleMoneyFocus = (row, field, key) => (e) => {
    const raw =
      row[field] === "" || row[field] == null ? "" : String(Number(row[field]));
    setLocalValues((p) => ({ ...p, [key]: raw }));
    setTimeout(() => {
      e.target.selectionStart = e.target.value.length;
      e.target.selectionEnd = e.target.value.length;
    }, 0);
  };

  const handleMoneyChange = (key) => (e) => {
    const v = e.target.value;
    if (/^[\d\s,.\-]*$/.test(v)) {
      setLocalValues((p) => ({ ...p, [key]: v }));
    }
  };

  const handleMoneyBlur = (rowId, field, key) => (e) => {
    const parsed = parseMoney(e.target.value);
    saveField(rowId, field, parsed);
    setLocalValues((p) => ({
      ...p,
      [key]: parsed === "" ? "" : formatMoney(parsed),
    }));
  };

  // Handler de fecha
  const handleDateBlur = (row, key) => (e) => {
    const oldDmy = row.fecha || "";
    const newYmd = e.target.value;
    const newDmy = inputToDmy(newYmd);
    if (!newDmy) {
      // revertir visualmente
      setLocalValues((p) => ({ ...p, [key]: dmyToInput(oldDmy) }));
      alert("Fecha inválida. Usa el selector de fecha o formato dd-mm-aaaa.");
      return;
    }
    if (newDmy === oldDmy) return;
    saveField(row.id, "fecha", newDmy);
  };

  // Crear registro vacío
  const addData = async () => {
    const dbRef = ref(database, "informedecobranza");
    const newRef = push(dbRef);
    await set(newRef, {
      direccion: "",
      valor: "",
      notas: "",
      direccion2: "",
      valor2: "",
      notas2: "",
      direccion3: "",
      valor3: "",
      notas3: "",
      fecha: fmtHoy(),
    });
  };

  // Eliminar registro
  const handleDeleteRow = (rowId) => {
    Swal.fire({
      title: "¿Deseas eliminar el registro?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        set(ref(database, `informedecobranza/${rowId}`), null)
          .then(() => {
            Swal.fire({
              title: "¡Registro eliminado!",
              text: "El registro ha sido eliminado exitosamente.",
              icon: "success",
              position: "center",
              backdrop: "rgba(0,0,0,0.4)",
              timer: 2000,
              showConfirmButton: false,
              heightAuto: false,
              didOpen: () => {
                document.body.style.overflow = "auto";
              },
              willClose: () => {
                document.body.style.overflow = "";
              },
            });
          })
          .catch((err) =>
            Swal.fire("Error", "No se pudo eliminar: " + err.message, "error")
          );
      }
    });
  };

  // === OPCIONES ÚNICAS PARA Dirección3 (filtro)
  const dir3Options = useMemo(() => {
    const setU = new Set(
      rows.map((r) => (r.direccion3 || "").trim()).filter((x) => x)
    );
    return Array.from(setU).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // === APLICAR FILTROS ===
  const filteredRows = useMemo(() => {
    const from = startOfDay(dateFrom);
    const to = endOfDay(dateTo);
    return rows.filter((r) => {
      if (dir3Filter && (r.direccion3 || "").trim() !== dir3Filter)
        return false;
      if (from || to) {
        const d = parseDMY(r.fecha);
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      return true;
    });
  }, [rows, dir3Filter, dateFrom, dateTo]);

  const clearFilters = () => {
    setDir3Filter("");
    setDateFrom(null);
    setDateTo(null);
  };

  // Datalist de direcciones (desde clientes)
  const direccionChoices = useMemo(() => {
    return Array.from(
      new Set(clients.map((c) => c.direccion).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [clients]);

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
            selected={dateFrom}
            onChange={handleDateRangeChange}
            startDate={dateFrom}
            endDate={dateTo}
            selectsRange
            inline
          />
        )}

        {/* Dirección3 */}
        <label style={{ color: "white" }}>Dirección3</label>
        <select
          value={dir3Filter}
          onChange={(e) => setDir3Filter(e.target.value)}
        >
          <option value="">(Todos)</option>
          {dir3Options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <button className="discard-filter-button" onClick={clearFilters}>
          Descartar Filtros
        </button>
      </div>

      {/* Título */}
      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Informe De Cobranza</h1>
          <div className="current-date">
            <div>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        <div className="table-container" style={{ borderTop: "none" }}>
          <table className="service-table">
            <thead>
              <tr>
                <th colSpan={4} style={{ background: "#b90000ff" }}>
                  PENDIENTES POR PAGAR
                </th>
                <th colSpan={5} style={{ background: "#007cb6ff" }}>
                  CONFIRMACIÓN DE PAGOS
                </th>
                <th colSpan={6} style={{ background: "#006b04ff" }}>
                  EFECTIVO RECIBIDO
                </th>
              </tr>
              <tr>
                <th>Dirección</th>
                <th>Monto</th>
                <th>Notas</th>
                <th>Acción</th>
                <th>Acción</th>
                <th>Dirección</th>
                <th>Monto</th>
                <th>Notas</th>
                <th>Acción</th>
                <th>Acción</th>
                <th>Fecha</th>
                <th>Dirección</th>
                <th>Monto</th>
                <th>Notas</th>
                <th>Acción</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={14}
                    style={{ textAlign: "center", color: "#888" }}
                  >
                    Sin registros
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  // keys locales por celda
                  const kFec = `${r.id}_fecha`;
                  const kD1 = `${r.id}_direccion`;
                  const kV1 = `${r.id}_valor`;
                  const kN1 = `${r.id}_notas`;
                  const kD2 = `${r.id}_direccion2`;
                  const kV2 = `${r.id}_valor2`;
                  const kN2 = `${r.id}_notas2`;
                  const kD3 = `${r.id}_direccion3`;
                  const kV3 = `${r.id}_valor3`;
                  const kN3 = `${r.id}_notas3`;

                  return (
                    <tr key={r.id}>
                      {/* Columna 1: direccion / valor / notas */}
                      <td>
                        <div className="custom-select-container">
                          <input
                            type="text"
                            style={{ width: "20ch" }}
                            value={
                              localValues[kD1] !== undefined
                                ? localValues[kD1]
                                : r.direccion || ""
                            }
                            onChange={(e) =>
                              setLocalValues((p) => ({
                                ...p,
                                [kD1]: e.target.value,
                              }))
                            }
                            onFocus={(e) =>
                              e.target.setAttribute("list", `dir-opt-1-${r.id}`)
                            }
                            onBlur={(e) => {
                              setTimeout(
                                () => e.target.removeAttribute("list"),
                                200
                              );
                              if (e.target.value !== (r.direccion || "")) {
                                saveField(r.id, "direccion", e.target.value);
                              }
                            }}
                            list={`dir-opt-1-${r.id}`}
                          />
                          <datalist id={`dir-opt-1-${r.id}`}>
                            {direccionChoices.map((d) => (
                              <option key={d} value={d} />
                            ))}
                          </datalist>
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          style={{
                            minWidth: "8ch",
                            width: "12ch",
                            textAlign: "center",
                          }}
                          value={
                            localValues[kV1] !== undefined
                              ? localValues[kV1]
                              : formatMoney(r.valor || 0)
                          }
                          onFocus={handleMoneyFocus(r, "valor", kV1)}
                          onChange={handleMoneyChange(kV1)}
                          onBlur={handleMoneyBlur(r.id, "valor", kV1)}
                          placeholder="0.00"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          style={{
                            maxWidth: 220,
                            width: 220,
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                          }}
                          value={
                            localValues[kN1] !== undefined
                              ? localValues[kN1]
                              : r.notas || ""
                          }
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kN1]: e.target.value,
                            }))
                          }
                          onBlur={handleTextBlur(r.id, "notas", kN1)}
                          placeholder="Nota"
                        />
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <button
                          className="filter-button"
                          onClick={() => move1to2(r.id)}
                        >
                          1 → 2
                        </button>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="filter-button"
                          onClick={() => move2to1(r.id)}
                        >
                          2 → 1
                        </button>
                      </td>

                      {/* Columna 2 */}
                      <td>
                        <div className="custom-select-container">
                          <input
                            type="text"
                            style={{ width: "20ch" }}
                            value={
                              localValues[kD2] !== undefined
                                ? localValues[kD2]
                                : r.direccion2 || ""
                            }
                            onChange={(e) =>
                              setLocalValues((p) => ({
                                ...p,
                                [kD2]: e.target.value,
                              }))
                            }
                            onFocus={(e) =>
                              e.target.setAttribute("list", `dir-opt-2-${r.id}`)
                            }
                            onBlur={(e) => {
                              setTimeout(
                                () => e.target.removeAttribute("list"),
                                200
                              );
                              if (e.target.value !== (r.direccion2 || "")) {
                                saveField(r.id, "direccion2", e.target.value);
                              }
                            }}
                            list={`dir-opt-2-${r.id}`}
                          />
                          <datalist id={`dir-opt-2-${r.id}`}>
                            {direccionChoices.map((d) => (
                              <option key={d} value={d} />
                            ))}
                          </datalist>
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          style={{
                            minWidth: "8ch",
                            width: "12ch",
                            textAlign: "center",
                          }}
                          value={
                            localValues[kV2] !== undefined
                              ? localValues[kV2]
                              : formatMoney(r.valor2 || 0)
                          }
                          onFocus={handleMoneyFocus(r, "valor2", kV2)}
                          onChange={handleMoneyChange(kV2)}
                          onBlur={handleMoneyBlur(r.id, "valor2", kV2)}
                          placeholder="0.00"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          style={{
                            maxWidth: 220,
                            width: 220,
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                          }}
                          value={
                            localValues[kN2] !== undefined
                              ? localValues[kN2]
                              : r.notas2 || ""
                          }
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kN2]: e.target.value,
                            }))
                          }
                          onBlur={handleTextBlur(r.id, "notas2", kN2)}
                          placeholder="Nota"
                        />
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <button
                          className="filter-button"
                          onClick={() => move2to3(r.id)}
                        >
                          2 → 3
                        </button>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="filter-button"
                          onClick={() => move3to2(r.id)}
                        >
                          3 → 2
                        </button>
                      </td>

                      {/* Fecha */}
                      <td>
                        <input
                          type="date"
                          value={
                            localValues[kFec] !== undefined
                              ? localValues[kFec]
                              : dmyToInput(r.fecha)
                          }
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kFec]: e.target.value,
                            }))
                          }
                          onBlur={handleDateBlur(r, kFec)}
                          style={{ width: "14ch", textAlign: "center" }}
                        />
                      </td>

                      {/* Columna 3 */}
                      <td>
                        <div className="custom-select-container">
                          <input
                            type="text"
                            style={{ width: "20ch" }}
                            value={
                              localValues[kD3] !== undefined
                                ? localValues[kD3]
                                : r.direccion3 || ""
                            }
                            onChange={(e) =>
                              setLocalValues((p) => ({
                                ...p,
                                [kD3]: e.target.value,
                              }))
                            }
                            onFocus={(e) =>
                              e.target.setAttribute("list", `dir-opt-3-${r.id}`)
                            }
                            onBlur={(e) => {
                              setTimeout(
                                () => e.target.removeAttribute("list"),
                                200
                              );
                              if (e.target.value !== (r.direccion3 || "")) {
                                saveField(r.id, "direccion3", e.target.value);
                              }
                            }}
                            list={`dir-opt-3-${r.id}`}
                          />
                          <datalist id={`dir-opt-3-${r.id}`}>
                            {direccionChoices.map((d) => (
                              <option key={d} value={d} />
                            ))}
                          </datalist>
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          style={{
                            minWidth: "8ch",
                            width: "12ch",
                            textAlign: "center",
                          }}
                          value={
                            localValues[kV3] !== undefined
                              ? localValues[kV3]
                              : formatMoney(r.valor3 || 0)
                          }
                          onFocus={handleMoneyFocus(r, "valor3", kV3)}
                          onChange={handleMoneyChange(kV3)}
                          onBlur={handleMoneyBlur(r.id, "valor3", kV3)}
                          placeholder="0.00"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          style={{
                            maxWidth: 220,
                            width: 220,
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                          }}
                          value={
                            localValues[kN3] !== undefined
                              ? localValues[kN3]
                              : r.notas3 || ""
                          }
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kN3]: e.target.value,
                            }))
                          }
                          onBlur={handleTextBlur(r.id, "notas3", kN3)}
                          placeholder="Nota"
                        />
                      </td>

                      {/* Eliminar */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="delete-button"
                          style={{
                            marginLeft: 10,
                            marginRight: 6,
                            cursor: "pointer",
                          }}
                          onClick={() => handleDeleteRow(r.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Crear nuevo */}
      <button className="create-table-button" onClick={addData}>
        +
      </button>
    </div>
  );
};

export default Informedecobranza;
