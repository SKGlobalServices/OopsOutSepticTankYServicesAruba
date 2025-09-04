import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, set, push, onValue, update } from "firebase/database";
import Select from "react-select";
import Slidebar from "./Slidebar";
import filtericon from "../assets/img/filters_icon.jpg";
import Clock from "./Clock";
import Swal from "sweetalert2";

const Clientesfijos = () => {
  // LOADER
  const [loading, setLoading] = useState(true);
  const [loadedClientesFijos, setLoadedClientesFijos] = useState(false);
  const [loadedClients, setLoadedClients] = useState(false);
  
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const filterSlidebarRef = useRef(null);

  const [data, setData] = useState([]);
  const [localValues, setLocalValues] = useState({});
  const [showDireccionAlert, setShowDireccionAlert] = useState(true);

  // clientes para poblar el datalist de Dirección
  const [clients, setClients] = useState([]);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Filtros
  const [filters, setFilters] = useState({
    direccion: [],
    programacion: "", // texto contiene
    cubicos: [],
    valor: [],
  });

  // ====== Utils ======
  const normalize = (s) =>
    String(s ?? "")
      .toLowerCase()
      .trim();

  const sortData = (arr) =>
    [...arr].sort((a, b) => {
      const dir = a.direccion.localeCompare(b.direccion);
      if (dir !== 0) return dir;
      return (a.programacion || "").localeCompare(b.programacion || "");
    });

  // ====== Carga de datos (clientesfijos) ======
  useEffect(() => {
    const dbRef = ref(database, "clientesfijos");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (!snapshot.exists()) {
        setData([]);
        setLoadedClientesFijos(true);
        return;
      }
      const all = snapshot.val();
      const arr = Object.entries(all).map(([id, r]) => ({
        id,
        direccion: r?.direccion ?? "",
        programacion: r?.programacion ?? "",
        cubicos: r?.cubicos ?? "",
        valor: r?.valor ?? "",
      }));
      setData(sortData(arr));
      setLoadedClientesFijos(true);
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
            direccion: client?.direccion ?? "",
            cubicos: client?.cubicos ?? "",
            valor: client?.valor ?? "",
            anombrede: client?.anombrede ?? "",
          })
        );
        setClients(fetchedClients);
        setLoadedClients(true);
      } else {
        setClients([]);
        setLoadedClients(true);
      }
    });
    return () => unsubscribe();
  }, []);

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

  // Actualizar Campos
  const handleFieldChange = async (item, field, value) => {
    const numericFields = ["cubicos", "valor"];
    const safeValue = numericFields.includes(field)
      ? value === "" || value === null || value === undefined
        ? ""
        : Number(value)
      : value ?? "";

    try {
      const itemRef = ref(database, `clientesfijos/${item.id}`);
      // ✅ Persistir en Firebase
      await update(itemRef, { [field]: safeValue });

      // ✅ Reflejar el cambio en UI
      setData((prev) =>
        sortData(
          prev.map((it) =>
            it.id === item.id ? { ...it, [field]: safeValue } : it
          )
        )
      );

      // ✅ Limpiar el localValue de ese input (para que quede lo que viene de data)
      setLocalValues((prev) => {
        const k = `${item.id}_${field}`;
        if (prev[k] === undefined) return prev;
        const { [k]: _, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      console.error("Error actualizando campo:", field, err);
    }
  };

  const addData = async () => {
    const dbRef = ref(database, "clientesfijos");
    const newRef = push(dbRef);
    await set(newRef, {
      direccion: "",
      programacion: "",
      cubicos: "",
      valor: "",
    }).catch(console.error);
  };

  // ====== Opciones para filtros (react-select) ======
  const direccionOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(new Set(data.map((it) => it.direccion).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v })),
  ];

  const cubicosOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(data.map((it) => it.cubicos).filter((v) => v !== "" && v != null))
    )
      .sort((a, b) => Number(a) - Number(b))
      .map((v) => ({ value: String(v), label: String(v) })),
  ];

  const valorOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(data.map((it) => it.valor).filter((v) => v !== "" && v != null))
    )
      .sort((a, b) => Number(a) - Number(b))
      .map((v) => ({ value: String(v), label: String(v) })),
  ];

  // ====== Filtrado ======
  const filteredData = data.filter((item) => {
    // Dirección (multi)
    const matchMulti = (filterArr, field) =>
      filterArr.length === 0 ||
      filterArr.some((f) => {
        if (f.value === "__EMPTY__") {
          const fieldValue = item[field];
          return (
            fieldValue === "" || fieldValue === null || fieldValue === undefined
          );
        }
        return normalize(item[field]) === normalize(f.value);
      });

    if (!matchMulti(filters.direccion, "direccion")) return false;
    if (!matchMulti(filters.cubicos, "cubicos")) return false;
    if (!matchMulti(filters.valor, "valor")) return false;

    // Programación (texto contiene)
    if (
      filters.programacion &&
      !normalize(item.programacion).includes(normalize(filters.programacion))
    ) {
      return false;
    }

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

  // ====== Autocompletar cubicos/valor al elegir dirección ======
  const tryAutofillFromClients = async (
    item,
    direccionValue,
    kCubicos,
    kValor
  ) => {
    const found = clients.find(
      (c) => normalize(c.direccion) === normalize(direccionValue)
    );
    if (!found) return;

    const updates = {};
    const lvUpdates = {};

    if ((item.cubicos ?? "") !== (found.cubicos ?? "")) {
      updates.cubicos = found.cubicos ?? "";
      lvUpdates[kCubicos] = found.cubicos ?? "";
    }
    if ((item.valor ?? "") !== (found.valor ?? "")) {
      updates.valor = found.valor ?? "";
      lvUpdates[kValor] = found.valor ?? "";
    }

    if (Object.keys(updates).length > 0) {
      await update(ref(database, `clientesfijos/${item.id}`), updates).catch(
        console.error
      );
      setData((prev) =>
        sortData(
          prev.map((it) => (it.id === item.id ? { ...it, ...updates } : it))
        )
      );
      if (Object.keys(lvUpdates).length > 0) {
        setLocalValues((p) => ({ ...p, ...lvUpdates }));
      }
    }
  };

  // Cuando todas las fuentes de datos estén listas, oculta el loader
  useEffect(() => {
    if (loadedClientesFijos && loadedClients) {
      setLoading(false);
    }
  }, [loadedClientesFijos, loadedClients]);

  // Loading
  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  // Agrega esta función para eliminar
  const handleDelete = (itemId) => {
    Swal.fire({
      title: "¿Deseas eliminar el registro?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        set(ref(database, `clientesfijos/${itemId}`), null)
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
        <h2 style={{color:"white"}}>Filtros</h2>
        <br />
        <hr />

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

        {/* Programación (texto) */}
        <label style={{ marginTop: 12 }}>Programación</label>
        <input
          type="text"
          value={filters.programacion}
          onChange={(e) =>
            setFilters((f) => ({ ...f, programacion: e.target.value }))
          }
          placeholder="Buscar texto en 'Programación'..."
          className="filter-text-input"
          style={{ width: "100%", padding: "6px 8px" }}
        />

        {/* Cúbicos */}
        <label style={{ marginTop: 12 }}>Cúbicos</label>
        <Select
          isClearable
          isMulti
          options={cubicosOptions}
          value={filters.cubicos}
          onChange={(opts) =>
            setFilters((f) => ({ ...f, cubicos: opts || [] }))
          }
          placeholder="Selecciona cúbicos..."
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

        <button
          className="discard-filter-button"
          style={{ marginTop: 16 }}
          onClick={() =>
            setFilters({
              direccion: [],
              programacion: "",
              cubicos: [],
              valor: [],
            })
          }
        >
          Descartar Filtros
        </button>
      </div>

      {/* Título */}
      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Clientes Fijos</h1>
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
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th className="direccion-fixed-th">Dirección</th>
                <th>Programación</th>
                <th>Cúbicos</th>
                <th>Valor</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.length > 0 ? (
                currentPageData.map((item) => {
                  const kDir = `${item.id}_direccion`;
                  const kProg = `${item.id}_programacion`;
                  const kCub = `${item.id}_cubicos`;
                  const kVal = `${item.id}_valor`;

                  const isDireccionDuplicada =
                    direccionCounts[(item.direccion || "").trim()] > 1;

                  return (
                    <tr
                      key={item.id}
                      className={
                        isDireccionDuplicada ? "direccion-duplicada" : ""
                      }
                    >
                      {/* DIRECCIÓN: datalist basado en clientes */}
                      <td className="direccion-fixed-td">
                        <div className="custom-select-container">
                          <input
                            className="direccion-fixed-input custom-select-input"
                            type="text"
                            style={{ width: "22ch" }}
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
                            onBlur={async (e) => {
                              setTimeout(
                                () => e.target.removeAttribute("list"),
                                200
                              );
                              const newDir = e.target.value;
                              if (newDir !== (item.direccion || "")) {
                                await handleFieldChange(
                                  item,
                                  "direccion",
                                  newDir
                                );
                              }
                              await tryAutofillFromClients(
                                item,
                                newDir,
                                kCub,
                                kVal
                              );
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

                      {/* PROGRAMACIÓN: texto */}
                      <td>
                        <input
                          type="text"
                          value={
                            localValues[kProg] !== undefined
                              ? localValues[kProg]
                              : item.programacion ?? ""
                          }
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kProg]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const v = e.target.value ?? "";
                            if (v !== (item.programacion ?? "")) {
                              handleFieldChange(item, "programacion", v);
                            }
                          }}
                          style={{ width: "24ch" }}
                        />
                      </td>

                      {/* CÚBICOS */}
                      <td>
                        <input
                          type="number"
                          value={
                            localValues[kCub] !== undefined
                              ? localValues[kCub]
                              : item.cubicos ?? ""
                          }
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kCub]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const raw = e.target.value;
                            const val = raw === "" ? "" : Number(raw);
                            if (val !== (item.cubicos ?? "")) {
                              handleFieldChange(item, "cubicos", val); // ← antes pasabas raw
                            }
                          }}
                          style={{ width: "10ch", textAlign: "center", paddingLeft: "14px" }}
                        />
                      </td>

                      {/* VALOR */}
                      <td>
                        <input
                          type="number"
                          value={
                            localValues[kVal] !== undefined
                              ? localValues[kVal]
                              : item.valor ?? ""
                          }
                          onChange={(e) =>
                            setLocalValues((p) => ({
                              ...p,
                              [kVal]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const raw = e.target.value;
                            const val = raw === "" ? "" : Number(raw);
                            if (val !== (item.valor ?? "")) {
                              handleFieldChange(item, "valor", val);
                            }
                          }}
                          style={{ width: "12ch", textAlign: "center", paddingLeft: "14px" }}
                        />
                      </td>
                      {/* BOTÓN ELIMINAR */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="delete-button"
                          style={{ marginLeft: "10px", marginRight: "6px" }}
                          onClick={() => handleDelete(item.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4">No hay registros disponibles</td>
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

export default React.memo(Clientesfijos);
