import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, set, push, onValue, update } from "firebase/database";
import Select from "react-select";
import Slidebar from "./Slidebar";
import filtericon from "../assets/img/filters_icon.jpg";
import Clock from "./Clock";
import Swal from "sweetalert2";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const Fastmark = () => {
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const filterSlidebarRef = useRef(null);

  const [data, setData] = useState([]);
  const [localValues, setLocalValues] = useState({});
  const [showDireccionAlert, setShowDireccionAlert] = useState(true);

  // clientes para poblar el datalist de Dirección (igual que en Homepage)
  const [clients, setClients] = useState([]);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Mostrar/ocultar datepicker
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ===== Estados de carga (mismo patrón del otro componente)
  const [loading, setLoading] = useState(true);
  const [loadedFastmark, setLoadedFastmark] = useState(false);
  const [loadedClientes, setLoadedClientes] = useState(false);

  // Filtros
  const [filters, setFilters] = useState({
    direccion: [],
    monto: [],
    fechaInicio: null,
    fechaFin: null,
  });

  // ==== Helpers de dinero ====
  const formatMoney = (val) => {
    const n = Number(val);
    if (Number.isNaN(n)) return "";
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Permite escribir "1,000.5", "1000,5", " 1 000 ", etc. y lo convierte a número o "".
  const parseMoney = (str) => {
    if (str === "" || str == null) return "";
    const s = String(str).trim().replace(/\s+/g, "");
    // Cambia coma decimal por punto si aplica y elimina separadores de miles
    const normalized = s
      .replace(/\.(?=.*\.)/g, "") // quita puntos intermedios (como miles)
      .replace(/,(?=.*[,])/g, "") // quita comas intermedias (como miles)
      .replace(/,/, "."); // usa coma final como decimal
    const n = Number(normalized);
    return Number.isFinite(n) ? n : "";
  };

  // ====== Carga de datos (fastmark) ======
  useEffect(() => {
    const dbRef = ref(database, "fastmark");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (!snapshot.exists()) {
        setData([]);
        setLoadedFastmark(true);
        return;
      }
      const all = snapshot.val();
      const arr = Object.entries(all).map(([id, r]) => ({
        id,
        fecha: r?.fecha ?? "",
        direccion: r?.direccion ?? "",
        monto: r?.monto ?? "",
      }));
      setData(sortByFechaDesc(arr));
      setLoadedFastmark(true);
    });
    return unsubscribe;
  }, []);

  // ====== Carga de clientes (para el datalist de Dirección) ======
  useEffect(() => {
    const dbRef = ref(database, "clientes");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedClients = Object.entries(snapshot.val()).map(
          ([id, client]) => ({
            id,
            direccion: client.direccion,
            cubicos: client.cubicos,
            valor: client.valor,
            anombrede: client.anombrede,
          })
        );
        setClients(fetchedClients);
        setLoadedClientes(true);
      } else {
        setClients([]);
        setLoadedClientes(true);
      }
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

  // --------- CRUD ---------
  const handleFieldChange = async (item, field, value) => {
    const safeValue =
      field === "monto" ? (value === "" ? "" : Number(value)) : value ?? "";
    const itemRef = ref(database, `fastmark/${item.id}`);
    await update(itemRef, { [field]: safeValue }).catch(console.error);

    setData((prev) =>
      sortByFechaDesc(
        prev.map((it) =>
          it.id === item.id ? { ...it, [field]: safeValue } : it
        )
      )
    );
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
      const itemRef = ref(database, `fastmark/${item.id}`);
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

  const addData = async (fecha, direccion, monto) => {
    const parsed = parseFecha(fecha);
    if (!parsed) {
      alert("Selecciona una fecha válida (dd-mm-aaaa).");
      return;
    }
    const dbRef = ref(database, "fastmark");
    const newRef = push(dbRef);
    await set(newRef, {
      fecha,
      direccion: direccion ?? "",
      monto: monto === "" ? "" : Number(monto ?? 0),
    }).catch(console.error);
  };

  // ====== Opciones para filtros (react-select) ======
  const direccionOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(new Set(data.map((it) => it.direccion).filter(Boolean)))
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

  // ====== Filtrado ======
  const filteredData = data.filter((item) => {
    // 1) filtro por fechas
    const d = parseFecha(item.fecha); // Date | null
    if (filters.fechaInicio || filters.fechaFin) {
      // si no hay fecha válida en el item y hay filtro activo, lo excluimos
      if (!d) return false;
      if (filters.fechaInicio && d < filters.fechaInicio) return false;
      if (filters.fechaFin && d > filters.fechaFin) return false;
    }

    // 2) filtros multi-select
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

    if (!matchMulti(filters.direccion, "direccion")) return false;
    if (!matchMulti(filters.monto, "monto")) return false;

    return true;
  });

  // ====== Conteo de direcciones (para alerta/⚠️) ======
  const direccionCounts = {};
  filteredData.forEach((it) => {
    const dir = (it.direccion || "").trim();
    if (dir) direccionCounts[dir] = (direccionCounts[dir] || 0) + 1;
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

  // ====== useEffect de loader ======
  useEffect(() => {
    if (loadedFastmark && loadedClientes) {
      setLoading(false);
    }
  }, [loadedFastmark, loadedClientes]);

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
        <h2 style={{color:"white"}}>Filtros</h2>
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

        {/* Dirección */}
        <label>Dirección</label>
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

        {/* Monto */}
        <label>Monto</label>
        <Select
          isClearable
          isMulti
          options={montoOptions}
          value={filters.monto}
          onChange={(opts) => setFilters((f) => ({ ...f, monto: opts || [] }))}
          placeholder="Selecciona monto(s)..."
        />

        <button
          className="discard-filter-button"
          onClick={() =>
            setFilters({
              direccion: [],
              monto: [],
              fechaInicio: null,
              fechaFin: null,
            })
          }
        >
          Descartar Filtros
        </button>
      </div>

      {/* Título */}
      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Fast Mark</h1>
          <div className="current-date">
            <div>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      {/* Alerta de direcciones duplicadas */}
      {showDireccionAlert &&
        Object.keys(direccionCounts).filter((dir) => direccionCounts[dir] > 1)
          .length > 0 && (
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
              <b>¡Atención!</b> Hay direcciones duplicadas en los registros
              filtrados:
              <ul
                style={{
                  margin: "6px 0 0 18px",
                  fontWeight: "normal",
                  fontSize: "14px",
                }}
              >
                {Object.entries(direccionCounts)
                  .filter(([_, count]) => count > 1)
                  .map(([dir, count]) => (
                    <li key={dir}>
                      <b>{dir}</b> ({count} veces)
                    </li>
                  ))}
              </ul>
            </span>
            <button
              onClick={() => setShowDireccionAlert(false)}
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
        {/* Total superior */}
        <div
          style={{
            border: "1px solid #ddd",
            color: "#fff",
            borderRadius: "6px",
            padding: "8px",
            flex: 1,
            textAlign: "center",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            backgroundColor: "#5271ff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-6px) scale(1.01)";
            e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
            e.currentTarget.style.borderColor = "#ddd";
            e.currentTarget.style.backgroundColor = "#375bffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
            e.currentTarget.style.borderColor = "#ddd";
            e.currentTarget.style.backgroundColor = "#5271ff";
          }}
        >
          Total AWG{" "}
          {data
            .reduce((acc, item) => acc + Number(item.monto || 0), 0)
            .toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
        </div>
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="direccion-fixed-th">Dirección</th>
                <th>Monto</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.length > 0 ? (
                currentPageData.map((item) => {
                  const kFecha = `${item.id}_fecha_${item.fecha}`;
                  const kDir = `${item.id}_direccion_${item.fecha}`;
                  const kMonto = `${item.id}_monto_${item.fecha}`;

                  const prevFechaDMY = item.fecha;
                  const currentInputValue =
                    localValues[kFecha] !== undefined
                      ? localValues[kFecha]
                      : dmyToInput(item.fecha);

                  const isDireccionDuplicada =
                    direccionCounts[(item.direccion || "").trim()] > 1;

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

                      {/* DIRECCIÓN: datalist basado en clientes */}
                      <td className="direccion-fixed-td">
                        <div className="custom-select-container">
                          <input
                            className="direccion-fixed-input custom-select-input"
                            type="text"
                            style={{ width: "20ch" }}
                            value={
                              localValues[kDir] !== undefined
                                ? localValues[kDir]
                                : item.direccion || ""
                            }
                            onChange={(e) =>
                              setLocalValues((p) => ({
                                ...p,
                                [kDir]: e.target.value,
                              }))
                            }
                            onFocus={(e) =>
                              e.target.setAttribute(
                                "list",
                                `direccion-options-${item.id}`
                              )
                            }
                            onBlur={(e) => {
                              setTimeout(
                                () => e.target.removeAttribute("list"),
                                200
                              );
                              if (e.target.value !== (item.direccion || "")) {
                                handleFieldChange(
                                  item,
                                  "direccion",
                                  e.target.value
                                );
                              }
                            }}
                          />

                          {isDireccionDuplicada && (
                            <span
                              title="Dirección duplicada (en la data filtrada)"
                              style={{
                                color: "#d9534f",
                                fontWeight: "bold",
                                marginLeft: "6px",
                                fontSize: "1.2em",
                                verticalAlign: "middle",
                              }}
                            >
                              &#9888;
                            </span>
                          )}

                          <datalist
                            id={`direccion-options-${item.id}`}
                            style={{
                              height: "20px",
                              maxHeight: "20px",
                              overflowY: "auto",
                            }}
                          >
                            {Array.from(
                              new Set(
                                clients
                                  .map((client) => client.direccion)
                                  .filter(Boolean)
                              )
                            )
                              .sort((a, b) => a.localeCompare(b))
                              .map((direccion, index) => (
                                <option key={index} value={direccion} />
                              ))}
                          </datalist>
                        </div>
                      </td>

                      {/* MONTO */}
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
                            localValues[kMonto] !== undefined
                              ? localValues[kMonto]
                              : formatMoney(item.monto || 0)
                          }
                          onFocus={(e) => {
                            // Al enfocar, muestra el valor "crudo" (sin separadores) para editar fácil
                            const raw =
                              item.monto === "" || item.monto == null
                                ? ""
                                : String(Number(item.monto));
                            setLocalValues((p) => ({ ...p, [kMonto]: raw }));
                            // Posiciona el cursor al final
                            setTimeout(() => {
                              e.target.selectionStart = e.target.value.length;
                              e.target.selectionEnd = e.target.value.length;
                            }, 0);
                          }}
                          onChange={(e) => {
                            // Permite solo dígitos, coma, punto y espacios temporales mientras escribe
                            const v = e.target.value;
                            if (/^[\d\s,.\-]*$/.test(v)) {
                              setLocalValues((p) => ({ ...p, [kMonto]: v }));
                            }
                          }}
                          onBlur={(e) => {
                            const parsed = parseMoney(e.target.value);
                            // Guarda "" si está vacío; si no, guarda número
                            handleFieldChange(item, "monto", parsed);
                            // Regresa al formateo bonito
                            setLocalValues((p) => ({
                              ...p,
                              [kMonto]:
                                parsed === "" ? "" : formatMoney(parsed),
                            }));
                          }}
                          placeholder="0.00"
                        />
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <button
                          className="delete-button"
                          style={{ marginLeft: "10px", marginRight: "6px" }}
                          onClick={() => {
                            Swal.fire({
                              title: "¿Deseas eliminar el registro?",
                              text: "Esta acción no se puede deshacer.",
                              icon: "warning",
                              showCancelButton: true,
                              confirmButtonText: "Sí, eliminar",
                              cancelButtonText: "Cancelar",
                            }).then((result) => {
                              if (result.isConfirmed) {
                                set(ref(database, `fastmark/${item.id}`), null)
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
                                    Swal.fire(
                                      "Error",
                                      "No se pudo eliminar: " + err.message,
                                      "error"
                                    )
                                  );
                              }
                            });
                          }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="3">No hay registros disponibles</td>
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
      <button
        className="create-table-button"
        onClick={() => {
          const hoy = new Date();
          const dd = String(hoy.getDate()).padStart(2, "0");
          const mm = String(hoy.getMonth() + 1).padStart(2, "0");
          const yyyy = hoy.getFullYear();
          addData(`${dd}-${mm}-${yyyy}`, "", "");
        }}
      >
        +
      </button>
    </div>
  );
};

export default React.memo(Fastmark);
